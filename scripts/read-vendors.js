import XLSX from 'xlsx';
import path from 'path';

const filePath = path.join('C:', 'Users', 'Ismar', 'Downloads', 'Vendor Recommendations.xlsx');
const workbook = XLSX.readFile(filePath);

// Get all sheet names
console.log('Sheet names:', workbook.SheetNames);

// Read each sheet
workbook.SheetNames.forEach(sheetName => {
  console.log(`\n=== ${sheetName} ===`);
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Show first 5 rows
  data.slice(0, 10).forEach((row, i) => {
    console.log(`Row ${i}:`, row);
  });
});
