import { makeEntry, looselyEqual } from '../types.js';
import { getTab } from './_helpers.js';

const SECTION = 'Shuttle Schedule';

/**
 * Sheet layout:
 *   Row 1: headers (Shuttle 1, Shuttle 2, …)
 *   Rows 2–N: alternating "Pick up at X" / "Drop off at Y" rows; col 1 = Shuttle 1 time.
 *
 * Strategy: pair each "Pick up" row with the next "Drop off" row to form a trip.
 * Then count trips and surface trip-count / hotels / seat-count as diff entries.
 * Per-trip row-by-row matching is intentionally out of scope (the sheet structure
 * varies too much wedding-to-wedding to match deterministically); Grace can open
 * the dedicated Shuttle Schedule tab to reconcile individual trips.
 */
function parseSheetTrips(rows) {
  if (!rows) return { trips: [], hotels: null, seats: null };
  const trips = [];
  let current = null;
  let hotels = null;
  let seats = null;

  for (const row of rows) {
    if (!row) continue;
    const label = (row[0] || '').toString().trim();
    const time = (row[1] || '').toString().trim();
    if (!label) continue;

    if (/guest hotels?:/i.test(label)) {
      const v = (row[1] || row[2] || '').toString().trim();
      if (v) hotels = v;
      continue;
    }
    if (/number of seats?/i.test(label)) {
      const v = (row[1] || row[2] || '').toString().trim();
      if (v) seats = v;
      continue;
    }

    if (/pick ?up/i.test(label)) {
      if (current) trips.push(current);
      current = { pickup_label: label, pickup_time: time || null };
    } else if (/drop ?off/i.test(label)) {
      if (current) {
        current.dropoff_label = label;
        current.dropoff_time = time || null;
        trips.push(current);
        current = null;
      }
    }
  }
  if (current) trips.push(current);
  // Filter out empty template rows (no time anywhere)
  return {
    trips: trips.filter((t) => t.pickup_time || t.dropoff_time),
    hotels,
    seats
  };
}

export default {
  section: SECTION,
  build({ sheet, portal, weddingId }) {
    const rows = getTab(sheet, 'Shuttle Schedule', 'Shuttle');
    if (!rows) return [];

    const { trips, hotels, seats } = parseSheetTrips(rows);
    const portalRows = portal.shuttle_schedule || [];
    const entries = [];

    entries.push(makeEntry({
      id: 'shuttle:trip-count',
      section: SECTION,
      field: 'Trips (rows in shuttle_schedule)',
      sheetValue: trips.length ? `${trips.length} trips with times` : 'no trips with times',
      portalValue: portalRows.length ? `${portalRows.length} rows` : 'no rows',
      status: trips.length === portalRows.length ? 'agree' : (portalRows.length === 0 ? 'missing' : 'conflict'),
      notes: trips.length || portalRows.length
        ? 'Per-trip rows: review in the dedicated Shuttle Schedule tab.'
        : null
    }));

    // List each sheet trip as a read-only entry so Grace can see what the sheet says
    trips.forEach((t, i) => {
      const summary = `${t.pickup_label} ${t.pickup_time || '(no time)'} → ${t.dropoff_label || '?'} ${t.dropoff_time || ''}`.trim();
      const portalSummary = portalRows[i]
        ? `${portalRows[i].pickup_location || ''} ${portalRows[i].pickup_time || ''} → ${portalRows[i].dropoff_location || ''} ${portalRows[i].dropoff_time || ''}`.trim()
        : null;
      const status = !portalSummary ? 'missing' : looselyEqual(summary, portalSummary) ? 'agree' : 'conflict';
      entries.push(makeEntry({
        id: `shuttle:trip:${i}`,
        section: SECTION,
        field: `Trip ${i + 1}`,
        sheetValue: summary,
        portalValue: portalSummary,
        status,
        notes: 'Use the Shuttle Schedule tab to add or fix individual trips.'
      }));
    });

    // Hotels + seat count
    entries.push(makeEntry({
      id: 'shuttle:hotels',
      section: SECTION,
      field: 'Guest hotels',
      sheetValue: hotels,
      portalValue: null,
      status: hotels ? 'sheet-only' : 'both-missing',
      notes: 'No portal column captures hotels yet.'
    }));
    entries.push(makeEntry({
      id: 'shuttle:seats',
      section: SECTION,
      field: 'Seats per shuttle',
      sheetValue: seats,
      portalValue: null,
      status: seats ? 'sheet-only' : 'both-missing'
    }));

    return entries;
  }
};
