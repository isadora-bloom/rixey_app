/**
 * Nobody gets to keep two lists of the same menu.
 *
 * The admin nav was a sidebar array for desktop and a hand-written run of
 * <option> elements for the phone. They drifted, and eleven tabs did not exist
 * on a phone at all, including Meetings & Walkthroughs and Their Worksheets,
 * both shipped in the fortnight before anyone noticed. Two of them were
 * features that looked, from a phone, like they had never been built.
 *
 * One list each now. This fails if a hard-coded option list reappears, because
 * that is the moment the drift starts rather than the moment it is noticed.
 *
 *   node scripts/audit-nav-parity.mjs
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Files whose navigation must be rendered from a single list.
const GUARDED = [
  'src/pages/admin/AdminHeader.jsx',
  'src/pages/admin/AdminWeddingProfile.jsx',
];

let failed = false;

for (const rel of GUARDED) {
  const src = readFileSync(resolve(root, rel), 'utf8');
  const hardCoded = [...src.matchAll(/<option\s+value="[^"]+"/g)];
  if (hardCoded.length) {
    failed = true;
    console.error(
      `${rel}: ${hardCoded.length} hard-coded <option value="..."> in a nav.\n` +
      '  Render the dropdown from the same list the sidebar/tabs use.\n' +
      `  Found: ${hardCoded.slice(0, 5).map(m => m[0]).join(', ')}${hardCoded.length > 5 ? ' …' : ''}`
    );
  }
}

// The wedding tabs list is the source of truth, so it has to exist and be used.
const tabsFile = resolve(root, 'src/pages/admin/weddingTabs.js');
const profile = readFileSync(resolve(root, 'src/pages/admin/AdminWeddingProfile.jsx'), 'utf8');
try {
  const tabs = readFileSync(tabsFile, 'utf8');
  const ids = [...tabs.matchAll(/\btab:\s*'([^']+)'/g)].map(m => m[1]);

  if (!profile.includes('weddingTabs(')) {
    failed = true;
    console.error('AdminWeddingProfile.jsx no longer calls weddingTabs(). The sidebar and the phone menu can drift again.');
  }

  // Both directions matter. A menu entry with no panel is a dead end, and a
  // panel with no menu entry is a feature you can only reach by accident.
  const rendered = new Set([...profile.matchAll(/activeTab === '([^']+)'/g)].map(m => m[1]));
  const noPanel = ids.filter(id => !rendered.has(id));
  const noMenu = [...rendered].filter(id => !ids.includes(id));

  if (noPanel.length) {
    failed = true;
    console.error(`Menu entries that render nothing: ${noPanel.join(', ')}`);
  }
  if (noMenu.length) {
    failed = true;
    console.error(`Panels no menu can reach: ${noMenu.join(', ')}`);
  }

  console.log(`weddingTabs.js: ${ids.length} tabs, each with a panel, on both the sidebar and the phone dropdown.`);
} catch (err) {
  failed = true;
  console.error(`Could not check src/pages/admin/weddingTabs.js: ${err.message}`);
}

if (failed) process.exit(1);
console.log('Nav parity: one list per menu.');
