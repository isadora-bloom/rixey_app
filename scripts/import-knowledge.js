// Script to parse wedding planning CSV and insert into Supabase knowledge base
// Run with: npm run import-kb

import fs from 'fs';
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

// Extract plain text from Wix rich text JSON
function extractText(detailsJson) {
  if (!detailsJson) return '';

  try {
    const details = JSON.parse(detailsJson);
    const texts = [];

    function traverse(node) {
      if (!node) return;

      if (node.textData && node.textData.text) {
        texts.push(node.textData.text);
      }

      if (node.nodes && Array.isArray(node.nodes)) {
        node.nodes.forEach(traverse);
      }
    }

    if (details.nodes) {
      details.nodes.forEach(traverse);
    }

    return texts.join(' ').replace(/\s+/g, ' ').trim();
  } catch (e) {
    return detailsJson; // Return as-is if not JSON
  }
}

// Simple CSV parser (handles quoted fields with commas)
function parseCSV(content) {
  const lines = content.split('\n');
  const headers = parseCSVLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim()) {
      const values = parseCSVLine(lines[i]);
      const row = {};
      headers.forEach((header, idx) => {
        row[header.replace(/"/g, '').trim()] = values[idx] || '';
      });
      rows.push(row);
    }
  }

  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);

  return result.map(v => v.replace(/^"|"$/g, ''));
}

async function main() {
  const csvPath = path.join('C:', 'Users', 'Ismar', 'Downloads', 'Weddingplanning (1).csv');

  console.log('Reading CSV...');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(content);

  console.log(`Found ${rows.length} entries`);

  const records = rows.map(row => ({
    title: row.Title || '',
    category: row.Category || '',
    subcategory: row.Subcategory || '',
    description: row.Description || '',
    content: extractText(row.Details) || row.Description || ''
  })).filter(r => r.title && r.content);

  console.log(`Inserting ${records.length} records into Supabase...`);

  const { data, error } = await supabase
    .from('knowledge_base')
    .insert(records);

  if (error) {
    console.error('Error inserting:', error);
  } else {
    console.log('Successfully imported knowledge base!');
  }
}

main().catch(console.error);
