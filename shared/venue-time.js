/**
 * Time, as it is at Rixey.
 *
 * The venue is in Rapidan, Virginia. Everything a person here means by a date
 * or a time is Eastern: a tour "at three" is three in the afternoon in Virginia,
 * and a wedding "on the fifteenth" is the fifteenth in Virginia. Nobody has
 * ever meant UTC.
 *
 * The server does not run in Virginia, and neither does a browser belonging to
 * someone travelling. So both had been quietly using whatever timezone they
 * happened to be in:
 *
 *   new Date().toISOString().slice(0, 10)
 *
 * That is today's date in UTC. Between 8pm and midnight Eastern it is already
 * tomorrow in UTC, so for four hours every evening:
 *
 *   archive-past archived weddings happening that same day, because "before
 *   today" had already rolled over
 *   a walkthrough recorded during an evening meeting was dated the next day
 *   a contract signed in the evening recorded the wrong date
 *
 * None of these fail. They are just wrong, in the evening, which is exactly
 * when a venue does most of its meetings.
 *
 * Everything here is derived from Intl rather than a fixed offset, so daylight
 * saving is handled: Rixey is UTC-4 in August and UTC-5 in January, and nothing
 * needs changing twice a year.
 */

export const VENUE_TZ = 'America/New_York';

/** Today at the venue, as YYYY-MM-DD. The one to use for a date column. */
export function venueToday(now = new Date()) {
  // en-CA formats as YYYY-MM-DD, which is what Postgres wants for a date.
  return new Intl.DateTimeFormat('en-CA', { timeZone: VENUE_TZ }).format(now);
}

/** Any instant as a YYYY-MM-DD at the venue. */
export function venueDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: VENUE_TZ }).format(d);
}

/** "3:00 PM" at the venue, whatever the reader's own clock says. */
export function venueTime(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: VENUE_TZ,
  });
}

/** "Sun 16 Aug, 3:00 PM" at the venue. */
export function venueDateTime(value, opts = {}) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    weekday: opts.weekday === false ? undefined : 'short',
    day: 'numeric',
    month: 'short',
    year: opts.year ? 'numeric' : undefined,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: VENUE_TZ,
  });
}

/**
 * Format a bare YYYY-MM-DD, e.g. a wedding date or a grouping key.
 *
 * These need their own path. `new Date('2026-08-16')` is parsed as midnight
 * UTC, which in Eastern is the evening of the 15th, so a plain date rendered
 * through the timezone-aware formatters comes out a day early. Anchoring at
 * midday sidesteps it in both directions and at every offset.
 */
export function venueDayLabel(ymd, opts = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd || ''))) return String(ymd || '');
  const d = new Date(`${ymd}T12:00:00Z`);
  return d.toLocaleDateString('en-US', {
    weekday: opts.weekday === false ? undefined : 'short',
    day: 'numeric',
    month: 'short',
    year: opts.year ? 'numeric' : undefined,
    timeZone: 'UTC',   // already anchored at midday; do not shift it again
  });
}

/** Is this bare YYYY-MM-DD today at the venue? */
export function isVenueToday(ymd) {
  return ymd === venueToday();
}

/**
 * Today, tomorrow, or the date — judged at the venue rather than wherever the
 * reader happens to be. "Today" is the word most likely to be wrong: at 9pm
 * Eastern a browser in UTC already thinks it is tomorrow.
 */
export function venueWhen(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return 'no date';

  const day = venueDate(d);
  const today = venueToday();
  const tomorrow = venueDate(new Date(Date.now() + 86_400_000));
  const yesterday = venueDate(new Date(Date.now() - 86_400_000));

  if (day === today) return `Today ${venueTime(d)}`;
  if (day === tomorrow) return `Tomorrow ${venueTime(d)}`;
  if (day === yesterday) return `Yesterday ${venueTime(d)}`;
  return venueDateTime(d);
}
