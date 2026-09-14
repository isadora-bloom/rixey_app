/**
 * Time, as it is at Rixey.
 *
 * The venue is in Rapidan, Virginia, and everyone here means Eastern time when
 * they say a date. The server does not run in Virginia, so for four hours
 * every evening `new Date().toISOString().slice(0, 10)` already thinks it is
 * tomorrow. This is the guard for that: dates and "today" must be judged at
 * the venue, never at wherever the process or the browser happens to be.
 *
 * Run with: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  venueToday, venueDate, venueTime, venueDateTime, venueDayLabel, isVenueToday, venueWhen, VENUE_TZ,
} from '../../shared/venue-time.js';

test('the venue timezone is Eastern', () => {
  assert.equal(VENUE_TZ, 'America/New_York');
});

test('an instant just after midnight UTC is still the evening before, in New York', () => {
  // 03:30 UTC in June is 23:30 the previous day Eastern (EDT, UTC-4).
  assert.equal(venueDate('2026-06-01T03:30:00Z'), '2026-05-31');
});

test('an hour later, the same instant has become the next day at the venue', () => {
  // 04:30 UTC in June is 00:30 Eastern: past midnight in New York too.
  assert.equal(venueDate('2026-06-01T04:30:00Z'), '2026-06-01');
});

test('venueToday reads the same boundary off an injected clock', () => {
  assert.equal(venueToday(new Date('2026-06-01T03:30:00Z')), '2026-05-31');
  assert.equal(venueToday(new Date('2026-06-01T04:30:00Z')), '2026-06-01');
});

test('daylight saving is handled without a fixed offset', () => {
  // January: Eastern is UTC-5, so 04:30 UTC is still the previous evening.
  assert.equal(venueDate('2026-01-02T04:30:00Z'), '2026-01-01');
  // August: Eastern is UTC-4, so the same clock time has already turned over.
  assert.equal(venueDate('2026-08-02T04:30:00Z'), '2026-08-02');
});

test('venueDate on an unparseable value is null', () => {
  assert.equal(venueDate('not a date'), null);
});

test('venueTime reads a UTC instant as the Eastern clock time', () => {
  // 19:00 UTC in August (EDT, UTC-4) is 3:00 PM in Virginia.
  assert.equal(venueTime('2026-08-16T19:00:00Z'), '3:00 PM');
});

test('venueTime on an unparseable value is an empty string', () => {
  assert.equal(venueTime('not a date'), '');
});

test('venueDateTime carries the weekday, date and Eastern time together', () => {
  assert.equal(venueDateTime('2026-08-16T19:00:00Z'), 'Sun, Aug 16, 3:00 PM');
});

test('venueDateTime can add the year and drop the weekday', () => {
  assert.equal(venueDateTime('2026-08-16T19:00:00Z', { year: true, weekday: false }), 'Aug 16, 2026, 3:00 PM');
});

test('venueDayLabel anchors a bare date at midday so it never rolls back a day', () => {
  // new Date('2026-08-16') is midnight UTC, which is the evening of the 15th
  // in Eastern; anchoring at midday sidesteps that at every offset.
  assert.equal(venueDayLabel('2026-08-16'), 'Sun, Aug 16');
});

test('venueDayLabel passes an unrecognisable value through unchanged', () => {
  assert.equal(venueDayLabel('16 Aug 2026'), '16 Aug 2026');
  assert.equal(venueDayLabel(''), '');
  assert.equal(venueDayLabel(undefined), '');
});

test('isVenueToday agrees with venueToday for the venue\'s own date', () => {
  assert.equal(isVenueToday(venueToday()), true);
});

test('isVenueToday is false for a date that plainly is not today', () => {
  assert.equal(isVenueToday('2000-01-01'), false);
});

test('venueWhen on an unparseable value says so rather than guessing', () => {
  assert.equal(venueWhen('not a date'), 'no date');
});

test('venueWhen on a date nowhere near today falls back to the full date and time', () => {
  assert.equal(venueWhen('2000-01-01T19:00:00Z'), venueDateTime(new Date('2000-01-01T19:00:00Z')));
});
