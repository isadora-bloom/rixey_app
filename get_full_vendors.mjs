import XLSX from 'xlsx';

const wb = XLSX.readFile('C:/Users/Ismar/Downloads/Vendor Recommendations.xlsx');
const data1 = XLSX.utils.sheet_to_json(wb.Sheets['Sheet1'], {header:1});

// Count total vendors
let totalRows = 0;
let vendorsByCategory = {};

data1.forEach((r,i) => {
  if(i > 1 && r && r[0] && r[1]) {
    const cat = r[0].trim();
    const name = r[1].trim();
    if(cat && name) {
      totalRows++;
      vendorsByCategory[cat] = (vendorsByCategory[cat] || 0) + 1;
    }
  }
});

console.log(`Total vendors in Sheet1: ${totalRows}`);
console.log(`\nBreakdown by category:`);
Object.entries(vendorsByCategory)
  .sort((a, b) => b[1] - a[1])
  .forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });

// Print the last few rows to see the full extent
console.log(`\n\nLast 20 rows of data:`);
for(let i = Math.max(data1.length - 20, 0); i < data1.length; i++) {
  if(data1[i] && (data1[i][0] || data1[i][1])) {
    console.log(`Row ${i}: ${data1[i].join(' | ')}`);
  }
}
