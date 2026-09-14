/**
 * Nobody gets to keep two lists of the same menu.
 *
 * The admin nav was a sidebar array for desktop and a hand-written run of
 * <option> elements for the phone. They drifted, and eleven tabs did not exist
 * on a phone at all, including Meetings & Walkthroughs and Their Worksheets,
 * both shipped in the fortnight before anyone noticed. Two of them were
 * features that looked, from a phone, like they had never been built.
 *
 * Then the couple's menu turned out to be a third copy, which disagreed with
 * the venue's about what half the sections were called: Vendors was `vendor`
 * on one side and `vendors` on the other, Guest Care Notes `guestcare` and
 * `guest-care`, the Photo Library `photos` and `photo-library`. A link that
 * worked for a couple opened nothing for Grace.
 *
 * So both menus now come from shared/sections.js, and this checks three things:
 * no hard-coded option list has reappeared, every section the registry claims
 * for a side actually has a panel on that side, and no menu entry exists that
 * the registry has never heard of.
 *
 *   node scripts/audit-nav-parity.mjs
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SECTIONS, GROUP_ORDER, resolveSectionKey } from '../shared/sections.js';
import { weddingTabs } from '../src/pages/admin/weddingTabs.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');

// Files whose navigation must be rendered from a single list.
const GUARDED = [
  'src/pages/admin/AdminHeader.jsx',
  'src/pages/admin/AdminWeddingProfile.jsx',
  'src/pages/dashboard/DashboardNav.jsx',
];

let failed = false;
const fail = (msg) => { failed = true; console.error(msg); };

for (const rel of GUARDED) {
  const src = read(rel);
  const hardCoded = [...src.matchAll(/<option\s+value="[^"]+"/g)];
  if (hardCoded.length) {
    fail(
      `${rel}: ${hardCoded.length} hard-coded <option value="..."> in a nav.\n` +
      '  Render the dropdown from the same list the sidebar/tabs use.\n' +
      `  Found: ${hardCoded.slice(0, 5).map(m => m[0]).join(', ')}${hardCoded.length > 5 ? ' …' : ''}`
    );
  }
}

// --- The registry itself -----------------------------------------------------

const keys = SECTIONS.map(s => s.key);
const duplicates = keys.filter((k, i) => keys.indexOf(k) !== i);
if (duplicates.length) fail(`shared/sections.js: duplicate keys: ${[...new Set(duplicates)].join(', ')}`);

for (const section of SECTIONS) {
  if (!section.label) fail(`shared/sections.js: ${section.key} has no label.`);
  if (!section.icon) fail(`shared/sections.js: ${section.key} has no icon.`);
  if (!GROUP_ORDER.includes(section.group)) {
    fail(`shared/sections.js: ${section.key} is in group "${section.group}", which is not in GROUP_ORDER.`);
  }
  if (!section.sides?.length) fail(`shared/sections.js: ${section.key} claims no side.`);
}

// An icon shared between two sections is how Bar Planner and Staffing Guide
// ended up with the same picture for a year.
const icons = SECTIONS.map(s => s.icon);
const sharedIcons = [...new Set(icons.filter((ic, i) => icons.indexOf(ic) !== i))];
if (sharedIcons.length) fail(`shared/sections.js: icons used by more than one section: ${sharedIcons.join(', ')}`);

// Every icon name has to have a component behind it, or the menu draws a gap.
const iconFile = read('src/components/ui/SectionIcon.jsx');
const mapped = new Set([...iconFile.matchAll(/^\s{2}([A-Z][A-Za-z0-9]*),$/gm)].map(m => m[1]));
const unmapped = [...new Set(icons)].filter(ic => !mapped.has(ic));
if (unmapped.length) fail(`SectionIcon.jsx maps no component for: ${unmapped.join(', ')}`);

// --- Venue side --------------------------------------------------------------

const profile = read('src/pages/admin/AdminWeddingProfile.jsx');
if (!profile.includes('weddingTabs(')) {
  fail('AdminWeddingProfile.jsx no longer calls weddingTabs(). The sidebar and the phone menu can drift again.');
}

const venueTabs = weddingTabs().filter(t => t.tab).map(t => t.tab);
const venuePanels = new Set([...profile.matchAll(/activeTab === '([^']+)'/g)].map(m => m[1]));
const venueWanted = SECTIONS.filter(s => s.sides.includes('venue')).map(s => s.key);

const venueNoPanel = venueWanted.filter(k => !venuePanels.has(k));
if (venueNoPanel.length) fail(`Registry sections with no venue panel: ${venueNoPanel.join(', ')}`);

const venueNoMenu = [...venuePanels].filter(k => !venueTabs.includes(k));
if (venueNoMenu.length) fail(`Venue panels no menu can reach: ${venueNoMenu.join(', ')}`);

const venueStrangers = venueTabs.filter(k => !venueWanted.includes(k));
if (venueStrangers.length) fail(`Venue menu entries outside the registry: ${venueStrangers.join(', ')}`);

// A panel keyed on an old key is the drift this whole thing exists to stop.
const venueStale = [...venuePanels].filter(k => resolveSectionKey(k) && resolveSectionKey(k) !== k);
if (venueStale.length) fail(`Venue panels still keyed on an old section key: ${venueStale.join(', ')}`);

// --- Couple side -------------------------------------------------------------

const dashboard = read('src/pages/Dashboard.jsx');
const nav = read('src/pages/dashboard/DashboardNav.jsx');
if (!nav.includes('sectionsFor(')) {
  fail('DashboardNav.jsx no longer builds itself from sectionsFor(). It can drift from the venue menu again.');
}

const couplePanels = new Set([...dashboard.matchAll(/activeSection === '([^']+)'/g)].map(m => m[1]));
const coupleWanted = SECTIONS.filter(s => s.sides.includes('couple')).map(s => s.key);

const coupleNoPanel = coupleWanted.filter(k => !couplePanels.has(k));
if (coupleNoPanel.length) fail(`Registry sections with no couple panel: ${coupleNoPanel.join(', ')}`);

const coupleStrangers = [...couplePanels].filter(k => !coupleWanted.includes(k));
if (coupleStrangers.length) fail(`Couple panels outside the registry: ${coupleStrangers.join(', ')}`);

const coupleStale = [...couplePanels].filter(k => resolveSectionKey(k) && resolveSectionKey(k) !== k);
if (coupleStale.length) fail(`Couple panels still keyed on an old section key: ${coupleStale.join(', ')}`);

if (failed) process.exit(1);
console.log(
  `Nav parity: ${SECTIONS.length} sections in the registry, ` +
  `${coupleWanted.length} on the couple side and ${venueWanted.length} on the venue side, ` +
  'each with a panel, on both the sidebar and the phone dropdown.'
);
