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
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq(col, weddingId);
      if (error) {
        snapshot[key] = { _error: error.message };
        return;
      }
      if (SINGLE_ROW_TABLES.has(table)) {
        snapshot[key] = (data && data[0]) || null;
      } else {
        snapshot[key] = data || [];
      }
    })
  );

  return snapshot;
}
