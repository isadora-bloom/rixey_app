// Script to import Rixey Manor Handbook into Supabase knowledge base
// Run with: node scripts/import-handbook.js

import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
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
  const docxPath = 'C:\\Users\\Ismar\\Downloads\\Rixey Manor Handbook 2026.docx';

  console.log('Reading handbook...');

  const result = await mammoth.extractRawText({ path: docxPath });
  const text = result.value;

  console.log(`Extracted ${text.length} characters`);

  // Split into sections by double newlines or headers
  const sections = text.split(/\n{2,}/).filter(s => s.trim().length > 50);

  console.log(`Found ${sections.length} sections`);

  // Create records for each substantial section
  const records = [];
  let currentTitle = 'Rixey Manor Handbook';

  for (const section of sections) {
    const lines = section.trim().split('\n');
    const firstLine = lines[0].trim();

    // Check if first line looks like a title (short, possibly all caps or title case)
    if (firstLine.length < 100 && firstLine.length > 3) {
      currentTitle = firstLine;
    }

    const content = section.trim();
    if (content.length > 50) {
      records.push({
        title: currentTitle.substring(0, 200),
        category: 'Handbook',
        subcategory: 'General Information',
        description: 'From the Rixey Manor Handbook 2026',
        content: content
      });
    }
  }

  console.log(`Inserting ${records.length} handbook sections...`);

  // Insert in batches to avoid timeout
  const batchSize = 10;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error } = await supabase
      .from('knowledge_base')
      .insert(batch);

    if (error) {
      console.error(`Error inserting batch ${i / batchSize + 1}:`, error);
    } else {
      console.log(`Inserted batch ${i / batchSize + 1}/${Math.ceil(records.length / batchSize)}`);
    }
  }

  console.log('Handbook import complete!');

  // Also output the full text for review
  console.log('\n--- EXTRACTED TEXT PREVIEW ---\n');
  console.log(text.substring(0, 3000) + '...');
}

main().catch(console.error);
