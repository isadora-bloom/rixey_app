// Import vendors from Excel file
// Run with: node scripts/import-vendors.js

import XLSX from 'xlsx';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function main() {
  const filePath = path.join('C:', 'Users', 'Ismar', 'Downloads', 'Vendor Recommendations.xlsx');
  const workbook = XLSX.readFile(filePath);

  const vendors = [];

  // Process Sheet1 (main vendors)
  const sheet1 = workbook.Sheets['Sheet1'];
  const data1 = XLSX.utils.sheet_to_json(sheet1, { header: 1 });

  // Skip header row, process vendors
  for (let i = 2; i < data1.length; i++) {
    const row = data1[i];
    if (!row || !row[0] || !row[1]) continue; // Skip empty rows

    const category = String(row[0] || '').trim();
    const name = String(row[1] || '').trim();

    if (!category || !name || category === ' ') continue;

    vendors.push({
      category: category,
      name: name,
      notes: row[2] ? String(row[2]).trim() : null,
      contact: row[3] ? String(row[3]).trim() : null,
      website: row[4] ? String(row[4]).trim() : null,
      pricing_info: row[5] ? String(row[5]).trim() : null,
      has_multiple_events: Boolean(row[6]),
      is_local: Boolean(row[7]),
      is_budget_friendly: Boolean(row[8]),
      serves_indian: Boolean(row[9]),
      serves_chinese: Boolean(row[10])
    });
  }

  // Process Sheet2 (photographers and others)
  const sheet2 = workbook.Sheets['Sheet2'];
  const data2 = XLSX.utils.sheet_to_json(sheet2, { header: 1 });

  for (let i = 1; i < data2.length; i++) {
    const row = data2[i];
    if (!row || !row[0]) continue;

    const name = String(row[0] || '').trim();
    const notes = String(row[1] || '').trim();

    if (!name) continue;

    // Determine category from notes
    let category = 'Photography'; // Default for Sheet2
    if (notes.toLowerCase().includes('video')) category = 'Videography';
    if (notes.toLowerCase().includes('dj')) category = 'DJ';
    if (notes.toLowerCase().includes('florist') || notes.toLowerCase().includes('flower')) category = 'Florist';

    vendors.push({
      category: category,
      name: name,
      notes: notes || null,
      contact: null,
      website: row[3] ? String(row[3]).trim() : null,
      pricing_info: null,
      has_multiple_events: false,
      is_local: false,
      is_budget_friendly: false,
      serves_indian: false,
      serves_chinese: false
    });
  }

  console.log(`Found ${vendors.length} vendors`);

  // Insert into Supabase
  const { data, error } = await supabase
    .from('vendors')
    .insert(vendors);

  if (error) {
    console.error('Error inserting vendors:', error);
  } else {
    console.log('Successfully imported vendors!');
  }

  // Show summary by category
  const categories = {};
  vendors.forEach(v => {
    categories[v.category] = (categories[v.category] || 0) + 1;
  });
  console.log('\nVendors by category:');
  Object.entries(categories).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });
}

main().catch(console.error);
