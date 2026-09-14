// Builds tests/fixtures/seating-import.xlsx — a small two-sheet workbook used
// by tests/unit/spreadsheet-parse.test.mjs to check that server/lib/spreadsheet.js
// (exceljs) reads a seating chart the same way the old xlsx-based code did.
//
// Run once with `node tests/fixtures/generate-seating-fixture.mjs` whenever the
// fixture needs regenerating. The committed .xlsx is the output of this script,
// not hand-edited.
import ExcelJS from 'exceljs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(here, 'seating-import.xlsx');

const workbook = new ExcelJS.Workbook();

// Main sheet: header row, a numeric seat number, a date cell, a formula
// cell (RSVP echoed back via a formula, the way a couple's own spreadsheet
// might), and a blank row that must be dropped from the parsed rows.
const guests = workbook.addWorksheet('Guests');
guests.addRow(['Table', 'Seat', 'Name', 'RSVP Date', 'RSVP']);
guests.addRow(['Head Table', 1, 'Alice Smith', new Date('2026-06-01T00:00:00Z'), 'Yes']);
guests.addRow([]); // fully blank row — must not survive into parsed rows
const formulaRow = guests.addRow(['Head Table', 2, 'Bob Jones', new Date('2026-06-02T00:00:00Z'), null]);
// A formula cell: exceljs stores { formula, result }, xlsx's sheet_to_json
// only ever read the cached result, so parseSpreadsheet must unwrap it the
// same way.
formulaRow.getCell(5).value = { formula: 'IF(B4>0,"Yes","No")', result: 'Yes' };

// Second sheet: a small "Notes" tab. Its name matches the seating importer's
// SKIP_SHEET pattern, so the seating handler ignores it in favour of the
// data-richer Guests sheet — this fixture exists to prove that selection
// still works after the swap, even though spreadsheet.js itself is agnostic
// to sheet names.
const notes = workbook.addWorksheet('Notes');
notes.addRow(['Fill in Table, Seat, Name, RSVP Date, RSVP.']);

await workbook.xlsx.writeFile(outPath);
console.log(`Wrote ${outPath}`);
