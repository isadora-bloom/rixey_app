import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnswerJobs, publicJobView } from '../../server/lib/answer-jobs.js';

/**
 * A fake of the slice of supabase-js that answer-jobs uses: one table, the
 * handful of chained filters, and an error channel that can be switched on.
 *
 * Deliberately not a mock library. The thing worth testing is that a job row
 * exists before the slow work starts and that it always ends up finished or
 * failed, and that reads as evidence only if the rows are real rows.
 */
function fakeSupabase({ failSelect = false, failInsert = false } = {}) {
  const rows = [];
  let nextId = 1;

  function builder(op, payload) {
    const filters = [];
    let limit = null;
    let sort = null;

    const matching = () => rows.filter(row => filters.every(([col, value]) => {
      if (col === 'detail->>weddingId') return row.detail?.weddingId === value;
      return row[col] === value;
    }));

    const run = () => {
      if (op === 'select' && failSelect) return { data: null, error: { message: 'read blew up' } };
      if (op === 'insert') {
        if (failInsert) return { data: null, error: { message: 'insert blew up' } };
        const row = { id: `job-${nextId++}`, processed: 0, failed: 0, ...payload };
        rows.push(row);
        return { data: row, error: null };
      }
      if (op === 'update') {
        const hit = matching();
        for (const row of hit) Object.assign(row, payload);
        return { data: hit, error: null };
      }
      let data = matching();
      if (sort) {
        const [col, ascending] = sort;
        data = [...data].sort((a, b) => String(a[col] || '').localeCompare(String(b[col] || '')) * (ascending ? 1 : -1));
      }
      if (limit !== null) data = data.slice(0, limit);
      return { data, error: null };
    };

    const api = {
      select() { return api; },
      eq(col, value) { filters.push([col, value]); return api; },
      in() { return api; },
      order(col, opts = {}) { sort = [col, opts.ascending !== false]; return api; },
      limit(n) { limit = n; return api; },
      single() {
        const { data, error } = run();
        if (error) return Promise.resolve({ data: null, error });
        const one = Array.isArray(data) ? data[0] : data;
        return Promise.resolve({ data: one || null, error: one ? null : { message: 'no rows' } });
      },
      maybeSingle() {
        const { data, error } = run();
        const one = Array.isArray(data) ? data[0] : data;
        return Promise.resolve({ data: error ? null : (one || null), error: error || null });
      },
      then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
    };
    return api;
  }

  return {
    rows,
    from(table) {
      assert.equal(table, 'sync_jobs');
      return {
        select: (...a) => builder('select', ...a),
        insert: (payload) => builder('insert', payload),
        update: (payload) => builder('update', payload),
      };
    },
  };
}

const WEDDING = '11111111-1111-4111-8111-111111111111';

test('the job row exists before the slow work does', async () => {
  const db = fakeSupabase();
  const { startAnswerJob } = createAnswerJobs(db);

  let release;
  const held = new Promise(resolve => { release = resolve; });

  const { jobId, reused, done } = await startAnswerJob({
    kind: 'highlights',
    weddingId: WEDDING,
    userId: 'user-1',
    input: {},
    worker: async () => { await held; return 'the briefing'; },
  });

  // The request has already been answered at this point; the worker has not.
  assert.ok(jobId);
  assert.equal(reused, false);
  assert.equal(db.rows.length, 1);
  assert.equal(db.rows[0].status, 'running');
  assert.equal(db.rows[0].kind, 'highlights');
  assert.equal(db.rows[0].trigger, 'manual');
  assert.equal(db.rows[0].detail.weddingId, WEDDING);
  assert.equal(db.rows[0].detail.userId, 'user-1');
  assert.ok(db.rows[0].heartbeat_at);

  release();
  await done;
});

test('a finished job carries the answer, its length and the model', async () => {
  const db = fakeSupabase();
  const { startAnswerJob, readAnswerJob } = createAnswerJobs(db);

  const { jobId, done } = await startAnswerJob({
    kind: 'highlights',
    weddingId: WEDDING,
    input: {},
    worker: async () => ({ answer: 'Where this stands: fine.', model: 'claude-sonnet-4-6' }),
  });
  await done;

  const job = await readAnswerJob(jobId);
  assert.equal(job.status, 'finished');
  assert.ok(job.finished_at);
  assert.equal(job.detail.answer, 'Where this stands: fine.');
  assert.equal(job.detail.chars, 'Where this stands: fine.'.length);
  assert.equal(job.detail.model, 'claude-sonnet-4-6');
  assert.equal(job.last_error, undefined);
});

test('a worker that throws leaves the reason on the row', async () => {
  const db = fakeSupabase();
  const { startAnswerJob, readAnswerJob } = createAnswerJobs(db);

  const { jobId, done } = await startAnswerJob({
    kind: 'ask-contracts',
    weddingId: WEDDING,
    input: { question: 'who is catering' },
    worker: async () => { throw new Error('overloaded_error'); },
  });
  // The failure belongs on the row, not on the caller: nobody is waiting.
  await done;

  const job = await readAnswerJob(jobId);
  assert.equal(job.status, 'failed');
  assert.equal(job.last_error, 'overloaded_error');
  assert.ok(job.finished_at);
  assert.equal(job.detail.answer, undefined);
});

test('a second press inside the window joins the job already running', async () => {
  const db = fakeSupabase();
  const { startAnswerJob } = createAnswerJobs(db);

  let release;
  const held = new Promise(resolve => { release = resolve; });
  const worker = async () => { await held; return 'one call, not three'; };

  const first = await startAnswerJob({ kind: 'highlights', weddingId: WEDDING, input: {}, worker });
  const second = await startAnswerJob({ kind: 'highlights', weddingId: WEDDING, input: {}, worker });
  const third = await startAnswerJob({ kind: 'highlights', weddingId: WEDDING, input: {}, worker });

  assert.equal(second.jobId, first.jobId);
  assert.equal(third.jobId, first.jobId);
  assert.equal(second.reused, true);
  // One row, so one Sonnet call, which is the whole point of the guard.
  assert.equal(db.rows.length, 1);

  release();
  await first.done;
});

test('a different wedding, or a different question, is a different job', async () => {
  const db = fakeSupabase();
  const { startAnswerJob } = createAnswerJobs(db);

  let release;
  const held = new Promise(resolve => { release = resolve; });
  const worker = async () => { await held; return 'x'; };

  const a = await startAnswerJob({ kind: 'ask-contracts', weddingId: WEDDING, input: { question: 'who is catering' }, worker });
  const b = await startAnswerJob({ kind: 'ask-contracts', weddingId: WEDDING, input: { question: 'what time is the bar on' }, worker });
  const c = await startAnswerJob({ kind: 'ask-contracts', weddingId: '22222222-2222-4222-8222-222222222222', input: { question: 'who is catering' }, worker });

  assert.notEqual(b.jobId, a.jobId);
  assert.notEqual(c.jobId, a.jobId);
  assert.equal(db.rows.length, 3);

  release();
  await Promise.all([a.done, b.done, c.done]);
});

test('a stale running job is not joined', async () => {
  const db = fakeSupabase();
  const { startAnswerJob } = createAnswerJobs(db);

  db.rows.push({
    id: 'job-dead',
    kind: 'highlights',
    status: 'running',
    started_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    heartbeat_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    detail: { weddingId: WEDDING, userId: null, input: {} },
  });

  const { jobId, reused, done } = await startAnswerJob({
    kind: 'highlights', weddingId: WEDDING, input: {}, worker: async () => 'fresh',
  });
  await done;

  assert.notEqual(jobId, 'job-dead');
  assert.equal(reused, false);
});

test('a read that fails refuses rather than starting a second call', async () => {
  const db = fakeSupabase({ failSelect: true });
  const { startAnswerJob } = createAnswerJobs(db);

  let ran = false;
  await assert.rejects(
    startAnswerJob({ kind: 'highlights', weddingId: WEDDING, input: {}, worker: async () => { ran = true; return 'x'; } }),
    /Could not check for a running highlights job/
  );
  assert.equal(ran, false);
});

test('the latest finished briefing is the one that comes back', async () => {
  const db = fakeSupabase();
  const { startAnswerJob, latestAnswerJob } = createAnswerJobs(db);

  const older = await startAnswerJob({ kind: 'highlights', weddingId: WEDDING, input: {}, worker: async () => 'older' });
  await older.done;
  const other = await startAnswerJob({ kind: 'highlights', weddingId: '33333333-3333-4333-8333-333333333333', input: {}, worker: async () => 'someone else' });
  await other.done;
  const newer = await startAnswerJob({ kind: 'highlights', weddingId: WEDDING, input: {}, worker: async () => 'newer' });
  await newer.done;
  // Two briefings a millisecond apart would be a coin toss, and the point here
  // is the ordering, not the clock.
  db.rows.find(r => r.id === newer.jobId).finished_at = new Date(Date.now() + 60_000).toISOString();

  const job = await latestAnswerJob('highlights', WEDDING);
  assert.equal(job.detail.answer, 'newer');
  assert.equal(job.detail.weddingId, WEDDING);
});

test('the view hands back the answer and nothing else from the file', () => {
  const view = publicJobView({
    id: 'job-1',
    kind: 'ask-contracts',
    status: 'finished',
    started_at: '2026-09-15T10:00:00.000Z',
    finished_at: '2026-09-15T10:01:10.000Z',
    last_error: null,
    detail: { weddingId: WEDDING, userId: 'u', input: { question: 'who is catering' }, answer: 'Hearth and Home.' },
  });

  assert.equal(view.answer, 'Hearth and Home.');
  assert.equal(view.elapsed_ms, 70000);
  assert.equal(view.status, 'finished');
  assert.equal(view.finished_at, '2026-09-15T10:01:10.000Z');
  // The question and the context behind it never leave the server.
  assert.equal(JSON.stringify(view).includes('who is catering'), false);
  assert.equal(view.detail, undefined);
});

test('a job still running has no answer to show yet', () => {
  const view = publicJobView({
    id: 'job-2', kind: 'highlights', status: 'running',
    started_at: new Date(Date.now() - 5000).toISOString(),
    detail: { weddingId: WEDDING, answer: 'half written' },
  });
  assert.equal(view.answer, null);
  assert.ok(view.elapsed_ms >= 4000);
});
