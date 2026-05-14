import { buildPortalSnapshot } from './portal-snapshot.js';
import topSheet from './modules/top-sheet.js';
import questions from './modules/questions.js';
import vendors from './modules/vendors.js';
import timeline from './modules/timeline.js';
import ceremony from './modules/ceremony.js';
import bedrooms from './modules/bedrooms.js';
import drinks from './modules/drinks.js';
import decor from './modules/decor.js';
import shuttle from './modules/shuttle.js';
import seating from './modules/seating.js';
import linens from './modules/linens.js';
import makeup from './modules/makeup.js';
import rehearsalDinner from './modules/rehearsal-dinner.js';
import emailNotes from './modules/email-notes.js';

export const MODULES = [
  topSheet,
  questions,
  vendors,
  timeline,
  ceremony,
  bedrooms,
  drinks,
  decor,
  shuttle,
  seating,
  linens,
  makeup,
  rehearsalDinner,
  emailNotes
];

/**
 * Run every module against the sheet + portal snapshot.
 * Returns { entries, snapshot, moduleErrors }.
 */
export async function buildDiff({ supabase, weddingId, sheet }) {
  const portal = await buildPortalSnapshot(supabase, weddingId);
  const entries = [];
  const moduleErrors = [];

  for (const mod of MODULES) {
    try {
      const out = await mod.build({ sheet, portal, weddingId });
      for (const e of out || []) entries.push(e);
    } catch (err) {
      console.error(`[sheet-diff] module ${mod.section || '?'} failed:`, err);
      moduleErrors.push({ section: mod.section || '?', error: String(err?.message || err) });
    }
  }

  return { entries, portal, moduleErrors };
}

export { applyChoices } from './apply.js';
