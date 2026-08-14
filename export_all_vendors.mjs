import XLSX from 'xlsx';

const wb = XLSX.readFile('C:/Users/Ismar/Downloads/Vendor Recommendations.xlsx');
const data1 = XLSX.utils.sheet_to_json(wb.Sheets['Sheet1'], {header:1});

console.log('=== SHEET1 - ALL VENDOR ROWS ===\n');
data1.forEach((r,i) => {
  if(i === 0) {
    console.log('HEADER: ' + r.join(' | '));
  } else if(r && r[0]) {
    console.log(`Row ${i}: ${r.join(' | ')}`);
  }
});
