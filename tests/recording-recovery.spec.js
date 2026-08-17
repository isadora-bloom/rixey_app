import { test, expect } from '@playwright/test'

/**
 * The recovery path, in a real browser.
 *
 * Two meetings were lost on 16 August because audio lived in one in-memory blob
 * and was uploaded exactly once. The fix is worth nothing unless a recording
 * that survives on disk is actually offered back, so this seeds IndexedDB the
 * way an interrupted recording leaves it, reloads, and checks the bar appears
 * with a way to get the audio out.
 *
 * Deliberately does not sign in. The bar lives above the router, so it must show
 * up wherever you are, and needing an admin session to find out you have
 * unsaved audio would defeat the point.
 */

const DB_NAME = 'rixey-recordings';

/**
 * Opened in the page, alongside the app's own connection.
 *
 * Note it does NOT delete the database between tests. deleteDatabase blocks
 * while the app holds a connection open, and the pending delete then blocks
 * every later open, which hangs the whole file rather than failing it. Clearing
 * the stores does the same job and never blocks.
 */
const OPEN_DB = `
  function openDb(dbName) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('recordings')) d.createObjectStore('recordings', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('chunks')) {
          const s = d.createObjectStore('chunks', { keyPath: ['recordingId', 'seq'] });
          s.createIndex('byRecording', 'recordingId');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
`;

async function clearRecordings(page) {
  return page.evaluate(`(async () => {
    ${OPEN_DB}
    const db = await openDb('${DB_NAME}');
    await new Promise((resolve, reject) => {
      const t = db.transaction(['recordings', 'chunks'], 'readwrite');
      t.oncomplete = resolve;
      t.onerror = () => reject(t.error);
      t.objectStore('recordings').clear();
      t.objectStore('chunks').clear();
    });
    db.close();
  })()`);
}

/** Write a recording into IndexedDB exactly as recordingStore.js lays it out. */
async function seedRecording(page, { id, status, chunks = 2, walkthroughId = 'wt-test' }) {
  return page.evaluate(async ({ dbName, id, status, chunks, walkthroughId, openDbSrc }) => {
    // eslint-disable-next-line no-new-func
    const openDb = new Function(`${openDbSrc}; return openDb;`)();
    const db = await openDb(dbName);

    const bytes = 1024 * 512;
    await new Promise((resolve, reject) => {
      const t = db.transaction(['recordings', 'chunks'], 'readwrite');
      t.oncomplete = resolve;
      t.onerror = () => reject(t.error);
      t.objectStore('recordings').put({
        id,
        walkthroughId,
        mimeType: 'audio/webm',
        label: 'Planning meeting · 2026-08-16',
        startedAt: new Date('2026-08-16T19:06:00Z').toISOString(),
        status,
        durationSecs: status === 'pending' ? 3720 : null,
        chunks,
        bytes: bytes * chunks,
        lastError: null,
      });
      for (let seq = 0; seq < chunks; seq++) {
        t.objectStore('chunks').put({
          recordingId: id,
          seq,
          blob: new Blob([new Uint8Array(bytes)], { type: 'audio/webm' }),
        });
      }
    });
    db.close();
    return true;
  }, { dbName: DB_NAME, id, status, chunks, walkthroughId, openDbSrc: OPEN_DB });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await clearRecordings(page);
});

test('a recording stopped normally but never uploaded is offered back', async ({ page }) => {
  await seedRecording(page, { id: 'rec-pending', status: 'pending' });
  await page.reload();

  const bar = page.getByText('A recording on this laptop has not been saved to the portal yet');
  await expect(bar).toBeVisible();

  // The three ways out, all present: send it, take it away, or lose it on purpose.
  await expect(page.getByRole('button', { name: 'Upload it now' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download a copy' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();

  // 3720 seconds is 62:00. A duration is what tells you whether this is the
  // meeting you think it is.
  await expect(page.getByText('62:00')).toBeVisible();
});

test('a recording interrupted mid-meeting says so, and still offers the audio', async ({ page }) => {
  await seedRecording(page, { id: 'rec-interrupted', status: 'recording' });
  await page.reload();

  await expect(page.getByText('interrupted mid-recording')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download a copy' })).toBeVisible();
  // No duration was ever written, so it falls back to size rather than showing
  // nothing at all.
  await expect(page.getByText('1 MB')).toBeVisible();
});

test('several unsaved recordings are all listed, not just the newest', async ({ page }) => {
  await seedRecording(page, { id: 'rec-a', status: 'pending' });
  await seedRecording(page, { id: 'rec-b', status: 'pending' });
  await page.reload();

  await expect(page.getByText('2 recordings on this laptop have not been saved to the portal yet')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Upload it now' })).toHaveCount(2);
});

test('nothing is shown when there is nothing unsaved', async ({ page }) => {
  await page.reload();
  await expect(page.getByText(/has not been saved to the portal yet/)).toHaveCount(0);
  await expect(page.getByText(/have not been saved to the portal yet/)).toHaveCount(0);
});

test('the download really produces the audio, not just a button', async ({ page }) => {
  await seedRecording(page, { id: 'rec-download', status: 'pending', chunks: 3 });
  await page.reload();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download a copy' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^meeting-2026-08-16-19-06\.webm$/);

  // Three half-megabyte chunks should come back as one file of all three, which
  // is the bit that proves chunks are assembled in order rather than lost.
  const stream = await download.createReadStream();
  let size = 0;
  for await (const chunk of stream) size += chunk.length;
  expect(size).toBe(1024 * 512 * 3);
});
