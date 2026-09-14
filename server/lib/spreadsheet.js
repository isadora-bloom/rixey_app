// Reads an uploaded .xlsx/.xls/.csv buffer into plain rows, the shape the
// seating-import parser already expects: one sheet name per tab, and each
// sheet as an array of rows, each row an array of cell values indexed from
// zero (the "header: 1" shape the xlsx library used to hand back).
//
// This replaces the xlsx library (unfixable prototype-pollution and ReDoS
// advisories — see AUDIT-2026-09-14.md item 20) with exceljs. exceljs has no
// single call that reads "whatever this buffer is", so the two formats are
// told apart first: workbook formats (.xlsx/.xls) go through
// `Workbook.xlsx.load`, everything else through exceljs's own CSV reader.
//
// Blank rows are dropped, matching the old `blankrows: false` behaviour, and
// blank cells come back as `null`, matching the old `defval: null`. Dates
// stay as JS Date objects (both libraries agree on that). Where the two
// libraries genuinely differ — formula cells — see cellToValue below.
import ExcelJS from 'exceljs';
import { Readable } from 'node:stream';

const CSV_MIME_TYPES = new Set(['text/csv', 'application/csv', 'text/plain']);

function extensionOf(originalname) {
  return String(originalname || '').split('.').pop().toLowerCase();
}

// Which parser to use is decided by extension first — it is unambiguous —
// and only falls back to mimetype for a file with no recognisable extension,
// which is how the browser sometimes hands over a pasted CSV.
function isCsv({ mimetype, originalname }) {
  const ext = extensionOf(originalname);
  if (ext === 'csv') return true;
  if (ext === 'xlsx' || ext === 'xls') return false;
  const base = String(mimetype || '').split(';')[0].trim();
  return CSV_MIME_TYPES.has(base);
}

// exceljs hands back a plain value for most cells, but a formula cell comes
// back as `{ formula, result, ... }` — sheet_to_json (the xlsx library) read
// the cached computed value and never the formula text, so this does the
// same rather than leaking `{ formula, result }` objects into every downstream
// field. A cell holding a formula error (`{ error: '#DIV/0!' }`) has no usable
// value, so it becomes null rather than a stringified error object.
function cellToValue(cell) {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map((r) => r.text).join('');
    if ('result' in v) return v.result === undefined ? null : cellToValue({ value: v.result });
    if ('error' in v) return null;
    if ('text' in v) return v.text; // hyperlink cell: { text, hyperlink }
  }
  return v;
}

function worksheetToRows(worksheet) {
  const rows = [];
  // eachRow skips fully empty rows by default (no `includeEmpty` option),
  // which is the same thing `blankrows: false` did for the xlsx library.
  worksheet.eachRow((row) => {
    const out = [];
    const width = Math.max(row.cellCount || 0, (row.values || []).length - 1);
    for (let i = 1; i <= width; i++) {
      out.push(cellToValue(row.getCell(i)));
    }
    rows.push(out);
  });
  return rows;
}

async function parseCsvBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = await workbook.csv.read(Readable.from(buffer));
  return [{ name: worksheet.name || 'Sheet1', rows: worksheetToRows(worksheet) }];
}

async function parseWorkbookBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheets = [];
  workbook.eachSheet((worksheet) => {
    sheets.push({
      name: worksheet.name,
      rows: worksheetToRows(worksheet),
      // actualRowCount counts rows that hold data, ignoring any trailing
      // formatted-but-empty rows — the same "how data-rich is this tab"
      // signal the old range-based row count was a proxy for.
      dataRowCount: worksheet.actualRowCount ?? worksheet.rowCount ?? 0,
    });
  });
  return sheets;
}

// parseSpreadsheet(buffer, { mimetype, originalname }) -> { sheetNames, sheets }
//
// `sheets` is keyed by sheet name; each entry is `{ rows, rowCount }` where
// `rows` is an array of arrays (row 0 is whatever the first row of the sheet
// is — no header handling happens here, callers decide what counts as a
// header, same as before).
export async function parseSpreadsheet(buffer, { mimetype, originalname } = {}) {
  if (isCsv({ mimetype, originalname })) {
    const [sheet] = await parseCsvBuffer(buffer);
    return {
      sheetNames: [sheet.name],
      sheets: { [sheet.name]: { rows: sheet.rows, rowCount: sheet.rows.length } },
    };
  }

  const sheets = await parseWorkbookBuffer(buffer);
  const sheetNames = sheets.map((s) => s.name);
  const byName = {};
  for (const s of sheets) {
    byName[s.name] = { rows: s.rows, rowCount: s.dataRowCount };
  }
  return { sheetNames, sheets: byName };
}
