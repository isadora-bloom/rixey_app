/**
 * Chunking is what stands between a long meeting and a silent half-read.
 *
 * The bug these cover: chunkDocument split only on the ===== PAGE and
 * ===== TAB markers written by the document extractor. A Deepgram transcript
 * has neither, so it was one block, and one block was handed over whole
 * however big it was. Anne and Chris's 173,084-character final walkthrough
 * went to the model in a single call, came back cut off at max_tokens, and
 * parsed to nothing while the walkthrough was stamped organised.
 *
 * Run with: npm run test:unit
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkDocument } from '../../server/lib/doc-sync/sections.js';

const line = (n) => `Speaker ${n}: ${'so then we talked about the tent and the lights. '.repeat(10)}\n`;

test('a transcript with no page markers is cut into chunks that fit', () => {
  const transcript = Array.from({ length: 400 }, (_, i) => line(i % 3)).join('');
  assert.ok(transcript.length > 100_000, 'fixture should be a long meeting');

  const chunks = chunkDocument(transcript, 12_000);
  assert.ok(chunks.length > 8, `expected many chunks, got ${chunks.length}`);
  for (const c of chunks) assert.ok(c.length <= 12_000, `chunk of ${c.length} chars is over the limit`);
});

test('nothing is dropped and nothing is duplicated', () => {
  const transcript = Array.from({ length: 200 }, (_, i) => line(i % 4)).join('');
  assert.equal(chunkDocument(transcript, 12_000).join(''), transcript);
});

test('a line is never cut in half, so a spreadsheet row stays whole', () => {
  const rows = Array.from({ length: 500 }, (_, i) => `Guest ${i},Table ${i % 20},vegetarian,+1 yes\n`).join('');
  const chunks = chunkDocument(rows, 4_000);
  for (const c of chunks) {
    for (const row of c.split('\n').filter(Boolean)) {
      assert.match(row, /^Guest \d+,Table \d+,vegetarian,\+1 yes$/, `row was cut: ${JSON.stringify(row)}`);
    }
  }
});

test('one speaker talking for an hour comes back as one line, and is still cut', () => {
  // Deepgram joins a single speaker's turn with spaces, so a monologue has no
  // newline in it anywhere. Sentence ends are the seam then.
  const monologue = 'And then we move the arbour. '.repeat(4000);
  const chunks = chunkDocument(monologue, 12_000);
  assert.ok(chunks.length > 5);
  for (const c of chunks) assert.ok(c.length <= 12_000);
  assert.equal(chunks.join(''), monologue);
});

test('text with no seam at all is still cut down to size', () => {
  const wall = 'x'.repeat(50_000);
  const chunks = chunkDocument(wall, 12_000);
  for (const c of chunks) assert.ok(c.length <= 12_000);
  assert.equal(chunks.join(''), wall);
});

test('page markers are still the preferred seam', () => {
  const doc = '===== PAGE 1 =====\nfirst page\n===== PAGE 2 =====\nsecond page\n';
  const chunks = chunkDocument(doc, 12_000);
  assert.equal(chunks.length, 1, 'a short document is one chunk');

  const big = ['===== PAGE 1 =====\n' + 'a\n'.repeat(4000), '===== PAGE 2 =====\n' + 'b\n'.repeat(4000)].join('');
  const split = chunkDocument(big, 12_000);
  assert.ok(split.length >= 2);
  assert.equal(split.join(''), big);
});

test('empty text still yields one chunk rather than nothing to read', () => {
  assert.deepEqual(chunkDocument('', 12_000), ['']);
  assert.deepEqual(chunkDocument(null, 12_000), ['']);
});
