import { makeEntry, classify } from '../types.js';
import { getTab, cellAt } from './_helpers.js';

const SECTION = 'Drinks';

/**
 * The Drinks tab has freeform text PLUS a structured "Type | Quantity" matrix starting
 * around row 12. We only pull:
 *   - Beer brands (col 1 under the "Beer" column header)
 *   - Specialty cocktail names (col 11 under the "Speciality Cocktails" header)
 * The portal has dedicated rows for these (bar_shopping_list + bar_recipes). Quantities
 * on the sheet are usually empty (covered by the portal's bar calculator).
 */
function parseDrinks(rows) {
  if (!rows) return { beers: [], cocktails: [], hasFullBarBlock: false };

  // Find the matrix header row by looking for "Beer" | "Wine" | "Liquor" pattern
  let headerRow = -1;
  for (let r = 0; r < Math.min(rows.length, 25); r++) {
    const row = rows[r] || [];
    if ((cellAt(rows, r, 1) || '').toLowerCase() === 'beer'
        && (cellAt(rows, r, 3) || '').toLowerCase().includes('wine')) {
      headerRow = r;
      break;
    }
  }

  const beers = [];
  const cocktails = [];
  let hasFullBarBlock = false;

  if (headerRow >= 0) {
    // Walk a few rows below the header for beer brands in col 1
    for (let r = headerRow + 2; r < headerRow + 12 && r < rows.length; r++) {
      const beer = cellAt(rows, r, 1);
      if (!beer) continue;
      // Stop when we hit a section header ("Sodas, Waters & Mixers")
      if (/sodas|mixers|waters/i.test(beer)) break;
      beers.push(beer);
    }
  }

  // Specialty cocktail names — look for "Name" header at col 11 anywhere
  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    const c11 = cellAt(rows, r, 11);
    if (!c11) continue;
    if (/^name$/i.test(c11)) {
      for (let nr = r + 1; nr < Math.min(rows.length, r + 8); nr++) {
        const name = cellAt(rows, nr, 11);
        if (!name) continue;
        if (/recipie|recipe/i.test(name)) continue;
        cocktails.push(name);
      }
      break;
    }
  }

  // Detect bar-type intent by which preamble block has filled values
  // (For v1 we don't write bar_type — the portal infers it from bar_shopping_list contents.)
  for (let r = 0; r < Math.min(rows.length, 12); r++) {
    const c0 = cellAt(rows, r, 0) || '';
    if (/full bar/i.test(c0) || /beer.*wine.*specialty cocktails/i.test(c0)) {
      hasFullBarBlock = true;
      break;
    }
  }

  return { beers, cocktails, hasFullBarBlock };
}

export default {
  section: SECTION,
  build({ sheet, portal, weddingId }) {
    const rows = getTab(sheet, 'Drinks List', 'Drinks');
    if (!rows) return [];

    const { beers, cocktails } = parseDrinks(rows);
    const shopping = portal.bar_shopping_list || [];
    const recipes = portal.bar_recipes || [];
    const entries = [];

    // Beer brands → bar_shopping_list rows with category=beer
    const portalBeerNames = shopping
      .filter((r) => (r.category || '').toLowerCase() === 'beer')
      .map((r) => (r.item_name || '').toString());

    for (const beer of beers) {
      const exists = portalBeerNames.some((n) => n.toLowerCase().includes(beer.toLowerCase()));
      entries.push(makeEntry({
        id: `drinks:beer:${slug(beer)}`,
        section: SECTION,
        field: `Beer brand: ${beer}`,
        sheetValue: beer,
        portalValue: exists ? `In shopping list` : null,
        status: exists ? 'agree' : 'missing',
        applyOp: exists ? { type: 'noop' } : {
          type: 'insert',
          table: 'bar_shopping_list',
          row: {
            wedding_id: weddingId,
            item_name: beer,
            category: 'beer',
            from_calculator: false,
            notes: 'Brand specified by couple (from sheet)'
          }
        }
      }));
    }

    // Specialty cocktail names — informational. Portal names are often intentionally
    // renamed (e.g. "Vodka/Cran/Sprite" → "The Couple's Combo") so we don't auto-write.
    const recipeNames = recipes.map((r) => (r.cocktail_name || '').toString());
    for (const c of cocktails) {
      const match = recipeNames.some((n) =>
        n.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(n.toLowerCase())
      );
      entries.push(makeEntry({
        id: `drinks:cocktail:${slug(c)}`,
        section: SECTION,
        field: `Specialty cocktail: ${c}`,
        sheetValue: c,
        portalValue: match ? `Matched in bar_recipes` : null,
        status: match ? 'agree' : 'sheet-only',
        notes: match
          ? null
          : 'Portal may have this under a renamed/branded title. Check Bar Planner before adding.'
      }));
    }

    // Bare-bones counts
    entries.push(makeEntry({
      id: 'drinks:summary',
      section: SECTION,
      field: 'Bar items',
      sheetValue: `${beers.length} beer brands, ${cocktails.length} specialty cocktails`,
      portalValue: `${shopping.length} shopping list, ${recipes.length} recipes`,
      status: shopping.length > 0 ? 'agree' : 'missing'
    }));

    return entries;
  }
};

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
