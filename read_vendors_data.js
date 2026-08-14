const XLSX = require('xlsx');
const path = require('path');

const filePath = 'C:\Users\Ismar\Downloads\Vendor Recommendations.xlsx';

try {
  const workbook = XLSX.readFile(filePath);
  
  console.log('=== VENDOR RECOMMENDATIONS FILE ===\n');
  console.log('Sheet names:', workbook.SheetNames);
  
  workbook.SheetNames.forEach(sheetName => {
    console.log(`\n\n=== SHEET: ${sheetName} ===\n`);
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    const limit = Math.min(data.length, 50);
    for (let i = 0; i < limit; i++) {
      const row = data[i] || [];
      console.log(`Row ${i}: [${row.join(' | ')}]`);
    }
    
    if (data.length > 50) {
      console.log(`\n... and ${data.length - 50} more rows`);
    }
  });
} catch (e) {
  console.error('Error:', e.message);
}
