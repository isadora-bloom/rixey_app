/**
 * Turning an uploaded planning document into text a model can read.
 *
 * Two real files drove the shape of this, and they are nothing alike:
 *
 *   Alyssa & Brett's Wedding.pdf — 53 pages out of Word via Adobe, real text
 *   layers, clear headings (Vendors and Contractors, Timeline, Dietary
 *   Restrictions). Extracts cleanly and reads almost like a document.
 *
 *   Wedding Master Plan.xlsx — a couple's own working file. Ten tabs, no two
 *   the same. Guests written "Ashby, Brooke and McClanahan, Cole". Hair times
 *   as Excel serial fractions. A seating chart laid out horizontally in
 *   four-column blocks. A Bar tab that is five lines of free text.
 *
 * So the goal here is deliberately modest: get the content out with enough
 * structure preserved that a model can find things, and do not try to
 * understand it. Understanding happens in sections.js against a real schema.
 */

import { createRequire } from 'module';
import crypto from 'crypto';
import * as XLSX from 'xlsx';

const require = createRequire(import.meta.url);

/** Excel stores times as a fraction of a day. 0.3333 is 08:00, not a number. */
function excelFractionToTime(v) {
  if (typeof v !== 'number' || v < 0 || v >= 1) return null;
  const mins = Math.round(v * 24 * 60);
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function cellToText(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const asTime = excelFractionToTime(v);
  if (asTime) return asTime;
  return String(v);
}

/**
 * Spreadsheets are flattened tab by tab, row by row, pipe-separated.
 *
 * Trailing empty cells are dropped but interior ones are kept as gaps, because
 * position carries meaning in a hand-made sheet: the seating chart's blocks
 * are only distinguishable by which column they start in.
 */
export function extractXlsx(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const parts = [];
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, blankrows: false, raw: true });
    const lines = [];
    for (const row of rows) {
      // Array.from rather than .map: sheet_to_json returns sparse arrays for
      // rows with blank cells, and .map skips holes instead of filling them,
      // so interior gaps came back undefined.
      const cells = Array.from({ length: (row || []).length }, (_, i) => cellToText(row?.[i]));
      while (cells.length && !cells[cells.length - 1].trim()) cells.pop();
      if (!cells.length) continue;
      lines.push(cells.join(' | '));
    }
    if (lines.length) parts.push(`===== TAB: ${name} =====\n${lines.join('\n')}`);
  }
  return { text: parts.join('\n\n'), pageCount: wb.SheetNames.length };
}

/** PDFs are read page by page, with the page number kept as a locator. */
export async function extractPdf(buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    // No worker in a server process, and no need for one.
    disableWorker: true,
    verbosity: 0,
  }).promise;

  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    const text = tc.items.map(i => i.str).join(' ').replace(/[ \t]+/g, ' ').trim();
    if (text) pages.push(`===== PAGE ${p} =====\n${text}`);
  }
  return { text: pages.join('\n\n'), pageCount: doc.numPages };
}

export async function extractDocx(buffer) {
  const mammoth = require('mammoth');
  const { value } = await mammoth.extractRawText({ buffer });
  return { text: String(value || '').trim(), pageCount: null };
}

export function kindFor(filename, mimetype) {
  const ext = String(filename || '').split('.').pop().toLowerCase();
  if (ext === 'pdf' || /pdf/.test(mimetype || '')) return 'pdf';
  if (['xlsx', 'xls', 'xlsm', 'csv'].includes(ext) || /sheet|excel|csv/.test(mimetype || '')) return 'xlsx';
  if (['docx', 'doc'].includes(ext) || /word|document/.test(mimetype || '')) return 'docx';
  return 'other';
}

export async function extractDocument(buffer, filename, mimetype) {
  const kind = kindFor(filename, mimetype);
  let result;
  if (kind === 'pdf') result = await extractPdf(buffer);
  else if (kind === 'xlsx') result = extractXlsx(buffer);
  else if (kind === 'docx') result = await extractDocx(buffer);
  else result = { text: buffer.toString('utf8').slice(0, 400_000), pageCount: null };

  const text = String(result.text || '').trim();
  return {
    kind,
    text,
    pageCount: result.pageCount ?? null,
    // Hash the content, not the file. The same plan re-saved by Word is a
    // different file and the same document, and should not look like a change.
    textHash: crypto.createHash('sha256').update(text).digest('hex'),
  };
}
