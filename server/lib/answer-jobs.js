/**
 * Long answers run as jobs, not as one very slow request.
 *
 * POST /api/notes-highlights builds a 60k-token file and asks Sonnet to write a
 * briefing off it. On a big wedding that takes 50 to 90 seconds. Railway's edge
 * proxy gives up at about 50 and hands the browser `502 upstream error`, while
 * this server carries on, finishes the call, and logs the usage. So the admin
 * reads "Failed to generate highlights", presses the button again, and pays for
 * a second full Sonnet call that will be thrown away in the same way. Three in
 * fifty seconds for one wedding, all of them completed, none of them seen.
 *
 * The fix is to stop holding the connection open. The route starts a job, hands
 * back an id, and returns in milliseconds. The answer is written to the job row
 * when it is ready and the browser polls for it. Nothing is lost to a proxy
 * timeout because nothing is waiting on the proxy any more.
 *
 * Job rows live in sync_jobs, which already does exactly this shape of
 * bookkeeping for the Gmail, Zoom and Quo imports: status, started_at,
 * finished_at, last_error, and a heartbeat so a killed process can be told from
 * a busy one. Reusing it means the existing boot reaper closes off answer jobs
 * too, and the admin sync panel can show them without new plumbing.
 */

/** Job kinds this module owns. Everything else in sync_jobs is an import. */
export const ANSWER_JOB_KINDS = ['highlights', 'ask-contracts', 'admin-ask'];

/** Bumped this often while a worker runs. See the reaper note above. */
export const HEARTBEAT_MS = 15_000;

/**
 * How recently a running job must have been alive to be handed back to a
 * second caller instead of starting a new one.
 *
 * Measured against the heartbeat rather than the start time. A job with a
 * heartbeat fifteen seconds old is genuinely working, however long it has been
 * going; one whose heartbeat stopped three minutes ago is a dead process, and
 * the next press should start a fresh job rather than wait on a corpse.
 */
export const IN_FLIGHT_MS = 3 * 60 * 1000;

const isoNow = () => new Date().toISOString();

/** Milliseconds since an ISO timestamp, or Infinity when there is not one. */
function ageOf(value) {
  const t = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(t) ? Date.now() - t : Infinity;
}

/**
 * Two requests are the same request when they ask the same thing of the same
 * wedding.
 *
 * The guard is keyed on the input as well as the wedding because two of the
 * three kinds carry a question. Handing a second, different question the first
 * question's job would answer the wrong thing confidently, which is worse than
 * the duplicate call it was meant to prevent. Highlights take no input beyond
 * the wedding, so for the case this was built for the comparison is always true.
 */
function sameInput(a, b) {
  try {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  } catch {
    return false;
  }
}

export function createAnswerJobs(supabase, options = {}) {
  const heartbeatMs = options.heartbeatMs ?? HEARTBEAT_MS;
  const inFlightMs = options.inFlightMs ?? IN_FLIGHT_MS;

  /**
   * Open a job row, return its id, and run the worker detached.
   *
   * The worker is deliberately not awaited: the caller is an Express handler
   * that must answer now. `done` is returned for tests and for anything that
   * genuinely wants to wait; ignoring it is the normal case.
   *
   * @param {object} args
   * @param {string} args.kind        one of ANSWER_JOB_KINDS
   * @param {string} args.weddingId   the wedding this answer is about
   * @param {string|null} args.userId who asked, when there is a signed-in user
   * @param {object} args.input       what was asked, recorded on the row
   * @param {Function} args.worker    async () => string | { answer, model }
   * @returns {Promise<{ jobId: string, reused: boolean, done: Promise<void> }>}
   */
  async function startAnswerJob({ kind, weddingId, userId = null, input = {}, worker }) {
    if (typeof worker !== 'function') throw new Error('startAnswerJob needs a worker');

    // Don't stack answers. This is the whole point: three presses of a button
    // that looks broken must not become three Sonnet calls.
    const { data: running, error: runningErr } = await supabase
      .from('sync_jobs')
      .select('id, heartbeat_at, started_at, detail')
      .eq('kind', kind)
      .eq('status', 'running');
    // A failed read here used to be the classic fail-open: an empty list reads
    // as "nothing running", so the guard would wave the second call through.
    // Refuse instead, because the cost of guessing wrong is a duplicate call
    // nobody sees and a bill nobody expects.
    if (runningErr) {
      throw new Error(`Could not check for a running ${kind} job: ${runningErr.message}`);
    }

    const live = (running || []).find(job => (
      job?.detail?.weddingId === weddingId
      && sameInput(job?.detail?.input, input)
      && ageOf(job.heartbeat_at || job.started_at) < inFlightMs
    ));
    if (live) {
      return { jobId: live.id, reused: true, done: Promise.resolve() };
    }

    const startedAt = isoNow();
    const { data: job, error: insertErr } = await supabase
      .from('sync_jobs')
      .insert({
        kind,
        trigger: 'manual',
        status: 'running',
        started_at: startedAt,
        heartbeat_at: startedAt,
        detail: { weddingId, userId, input },
      })
      .select()
      .single();
    if (insertErr) throw new Error(`Could not open a ${kind} job: ${insertErr.message}`);
    if (!job?.id) throw new Error(`Could not open a ${kind} job: no row came back`);

    const update = async (fields) => {
      const { error } = await supabase
        .from('sync_jobs')
        .update({ ...fields, heartbeat_at: isoNow() })
        .eq('id', job.id);
      if (error) console.error(`[answer-jobs] could not update ${kind} job ${job.id}: ${error.message}`);
    };

    // Say "still alive" on a timer rather than per item: an answer is one long
    // item, so there is nothing else to hang a heartbeat on.
    const beat = setInterval(() => {
      update({}).catch(err => console.error('[answer-jobs] heartbeat failed:', err?.message || err));
    }, heartbeatMs);
    if (typeof beat.unref === 'function') beat.unref();

    const done = (async () => {
      try {
        const result = await worker();
        const answer = typeof result === 'string' ? result : String(result?.answer ?? '');
        const model = (typeof result === 'object' && result?.model) || null;
        await update({
          status: 'finished',
          finished_at: isoNow(),
          processed: 1,
          detail: { ...(job.detail || {}), answer, chars: answer.length, model },
        });
      } catch (err) {
        const message = String(err?.message || err);
        console.error(`[answer-jobs] ${kind} job ${job.id} failed:`, message);
        await update({ status: 'failed', finished_at: isoNow(), failed: 1, last_error: message });
      } finally {
        clearInterval(beat);
      }
    })();

    return { jobId: job.id, reused: false, done };
  }

  /** One job row, or null. Raises on a read failure so a blip is not a 404. */
  async function readAnswerJob(id) {
    const { data, error } = await supabase
      .from('sync_jobs')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`Could not read that job: ${error.message}`);
    return data || null;
  }

  /** The newest finished job of this kind for this wedding, or null. */
  async function latestAnswerJob(kind, weddingId) {
    const { data, error } = await supabase
      .from('sync_jobs')
      .select('*')
      .eq('kind', kind)
      .eq('status', 'finished')
      .eq('detail->>weddingId', weddingId)
      .order('finished_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Could not read the last ${kind}: ${error.message}`);
    return data || null;
  }

  return { startAnswerJob, readAnswerJob, latestAnswerJob };
}

/**
 * The shape a job is shown as.
 *
 * The prompt and the context never leave the server. detail carries the whole
 * question and the finished answer; the context it was built from is 60k
 * characters of another couple's calls and emails in the worst case, so only
 * the answer is ever handed back.
 */
export function publicJobView(job) {
  if (!job) return null;
  const startedMs = job.started_at ? new Date(job.started_at).getTime() : null;
  const endedMs = job.finished_at ? new Date(job.finished_at).getTime() : Date.now();
  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    answer: job.status === 'finished' ? (job.detail?.answer ?? '') : null,
    error: job.last_error || null,
    started_at: job.started_at || null,
    finished_at: job.finished_at || null,
    elapsed_ms: startedMs ? Math.max(0, endedMs - startedMs) : null,
  };
}
