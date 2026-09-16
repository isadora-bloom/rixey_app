/**
 * Fetch every portal table relevant to the sheet-diff in a single round-trip-ish batch.
 * Returns an object keyed by table name. Single-row tables (weddings, wedding_details,
 * wedding_staffing, wedding_tables, wedding_timeline, rehearsal_dinner) return the row
 * (or null). Multi-row tables return an array.
 */
const SINGLE_ROW_TABLES = new Set([
  'weddings',
  'wedding_details',
  'wedding_staffing',
  'wedding_tables',
  'wedding_timeline',
  'rehearsal_dinner',
  'table_layouts'
]);

const MULTI_ROW_TABLES = [
  'vendor_checklist',
  'ceremony_order',
  'bedroom_assignments',
  'bar_shopping_list',
  'bar_recipes',
  'decor_inventory',
  'shuttle_schedule',
  'wedding_guests',
  'makeup_schedule',
  'allergy_registry'
];

const PAGE = 1000;

export async function buildPortalSnapshot(supabase, weddingId) {
  const snapshot = { weddingId };

  // Weddings is keyed by id, everything else by wedding_id
  const queries = [
    { key: 'weddings', table: 'weddings', col: 'id' },
    ...[...SINGLE_ROW_TABLES].filter((t) => t !== 'weddings').map((t) => ({ key: t, table: t, col: 'wedding_id' })),
    ...MULTI_ROW_TABLES.map((t) => ({ key: t, table: t, col: 'wedding_id' }))
  ];

  await Promise.all(
    queries.map(async ({ key, table, col }) => {
      // Paged. Supabase caps a read at 1,000 rows and says nothing, so a big
      // wedding's guest list came back cut off and the diff reported every
      // guest past the first thousand as missing from the portal.
      if (SINGLE_ROW_TABLES.has(table)) {
        // One row per wedding by definition, so there is nothing to page.
        const { data, error } = await supabase.from(table).select('*').eq(col, weddingId);
        if (error) snapshot[key] = { _error: error.message };
        else snapshot[key] = (data && data[0]) || null;
        return;
      }

      const rows = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .eq(col, weddingId)
          .order('id', { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) {
          snapshot[key] = { _error: error.message };
          return;
        }
        rows.push(...(data || []));
        if (!data || data.length < PAGE) break;
      }
      snapshot[key] = rows;
    })
  );

  return snapshot;
}
