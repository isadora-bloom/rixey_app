/**
 * Date-only values, parsed without losing a day.
 *
 * `wedding_date` is a Postgres DATE, so it arrives as "2026-10-03" with no time
 * and no zone. `new Date("2026-10-03")` parses that as midnight UTC, which is
 * 8pm on 2 October in Eastern time. Every screen that did the plain parse showed
 * couples the day before their wedding.
 *
 * Ashley Hermsmeyer reported exactly this in March 2026: "it says my wedding
 * date is Friday Oct 2 but it is Saturday Oct 3." Appending T00:00:00 makes the
 * browser parse it as local midnight, which is what a date with no time means.
 *
 * Use these for DATE columns: wedding_date, rsvp_deadline, contract_date,
 * due_date, expiry_date, special_expiry.
 *
 * Do NOT use them for timestamps (created_at, updated_at, processed_at). Those
 * are timestamptz, they carry a real instant, and `new Date(value)` is correct.
 */

/** Parse a date-only string as local midnight. Returns null for empty input. */
export function parseDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const str = String(value);
  // Already carries a time or a zone, so it is a timestamp, not a date.
  if (str.includes('T') || str.includes(' ')) return new Date(str);
  const d = new Date(`${str}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const LONG = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
const MEDIUM = { month: 'short', day: 'numeric', year: 'numeric' };
const SHORT = { month: 'short', year: 'numeric' };

/**
 * Format a date-only value. `style` is 'long' | 'medium' | 'short', or pass an
 * Intl options object for anything else.
 */
export function formatDateOnly(value, style = 'medium') {
  const d = parseDateOnly(value);
  if (!d) return '';
  const options = typeof style === 'string'
    ? (style === 'long' ? LONG : style === 'short' ? SHORT : MEDIUM)
    : style;
  return d.toLocaleDateString('en-US', options);
}

/** Whole days from today until a date-only value. Negative once it has passed. */
export function daysUntilDateOnly(value) {
  const d = parseDateOnly(value);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}
