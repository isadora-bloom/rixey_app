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

/**
 * PDFs, via pdf-parse.
 *
 * This first used pdfjs-dist directly, which worked locally and died on the
 * server with "DOMMatrix is not defined". Two reasons, and the second is the
 * real one: pdfjs wants browser globals in Node, and — more to the point —
 * pdfjs-dist is not in server/package.json, which is what Railway installs
 * from. It only existed locally as a transitive dependency of pdf-parse.
 *
 * So use pdf-parse itself. It is a declared server dependency, it does not
 * need the DOM, and it is already what the contract reader uses.
 */
export async function extractPdf(buffer) {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    const pages = Array.isArray(result.pages) ? result.pages : [];
    if (pages.length) {
      const parts = pages
        .map((p, i) => {
          const text = String(p?.text ?? p ?? '').replace(/[ \t]+/g, ' ').trim();
          return text ? `===== PAGE ${i + 1} =====\n${text}` : '';
        })
        .filter(Boolean);
      return { text: parts.join('\n\n'), pageCount: result.total || pages.length };
    }
    return { text: String(result.text || '').trim(), pageCount: result.total || null };
  } finally {
    // Frees the worker; without it a long-running server leaks one per upload.
    await parser.destroy?.().catch(() => {});
  }
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
