import mammoth from 'mammoth';

async function main() {
  try {
    const result = await mammoth.extractRawText({
      path: 'C:/Users/Ismar/Downloads/Rixey Manor Handbook 2026.docx'
    });
    
    const text = result.value;
    console.log(`Extracted ${text.length} characters from handbook\n`);
    
    // Print first 4000 characters
    console.log('=== HANDBOOK CONTENT (first 4000 chars) ===\n');
    console.log(text.substring(0, 4000));
    
    console.log('\n\n[... TRUNCATED ...]\n\n');
    
    // Print last 1500 characters
    console.log('=== HANDBOOK CONTENT (last 1500 chars) ===\n');
    console.log(text.substring(Math.max(0, text.length - 1500)));
    
    // Count sections
    const sections = text.split(/\n{2,}/);
    console.log(`\n\nTotal sections (by double newline): ${sections.length}`);
    
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();
