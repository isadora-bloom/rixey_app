/**
 * Guard for meeting attribution.
 *
 * Every case here is real. Anne Throckmorton's planning meeting spent three
 * weeks filed under Chris & Emily because both weddings have an Anne, and 148
 * planning notes went with it, including a critical potato allergy. Melissa
 * Pike's onboarding was one sync away from the same thing, because there are
 * two Melissas.
 *
 * The rule being protected: a shared first name never files a meeting. It
 * takes a first and last name, both halves of the couple, or a name with the
 * wedding date. Anything less becomes a question.
 *
 * Converted from scripts/test-meeting-match.mjs, plus direct tests for the
 * smaller exported helpers.
 *
 * Run with: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDirectory, matchMeeting, coupleTokens, speakerNames, mentionsWeddingDate,
} from '../../shared/meeting-match.js';

const WEDDINGS = [
  { id: 'anne-chris', couple_names: 'Anne & Chris', wedding_date: '2026-10-10',
    profiles: [{ name: 'Anne Throckmorton' }] },
  { id: 'chris-emily', couple_names: 'Chris & Emily', wedding_date: '2026-11-14',
    profiles: [{ name: 'Emily Farnsworth' }, { name: 'Chris Bradel' }, { name: 'Anne Bradel' }] },
  { id: 'daniel-griffin', couple_names: 'Daniel and Griffin', wedding_date: '2027-07-10',
    profiles: [{ name: 'Daniel Weedon' }, { name: 'Kim Perry' }] },
  { id: 'melissa-ryan', couple_names: 'Melissa and Ryan', wedding_date: '2027-12-18',
    profiles: [{ name: 'Melissa Pike' }, { name: 'Nancy Pike' }] },
  { id: 'melissa-cameron', couple_names: 'Melissa and Cameron', wedding_date: '2026-09-26',
    profiles: [{ name: 'Melissa Lesner' }] },
];

const directory = buildDirectory(WEDDINGS);

const CASES = [
  // Full name settles it, even against a wedding sharing the first name.
  ['Anne Throckmorton: 1hr Planning Meeting on Zoom', 'anne-chris'],
  ['Melissa Pike: Onboarding and Initial Planning', 'melissa-ryan'],
  ['Josh Wenzinger: Onboarding', null],                 // nobody here is Josh

  // Both halves of the couple, in either order, with "and" rather than "&".
  ['Griffin and Daniel: Onboarding and Initial Planning', 'daniel-griffin'],
  ['Daniel & Griffin final walkthrough', 'daniel-griffin'],

  // A first name alone is never enough, however tempting.
  ['Anne: quick chat', null],
  ['Chris check-in', null],
  ['Melissa call', null],

  // A name plus their wedding date is enough.
  ['Anne catch up about October 10th', 'anne-chris'],
  ['Melissa 12/18 walkthrough', 'melissa-ryan'],

  // Zoom's default room title tells us nothing.
  ["Rixey Manor Team's Zoom Meeting", null],
];

for (const [topic, expected] of CASES) {
  test(`"${topic}" matches ${expected ? expected : 'nobody, and asks a human'}`, () => {
    const result = matchMeeting(topic, directory);
    assert.equal(result.weddingId, expected);
  });
}

test('a speaker label can file a meeting Zoom named after the host\'s own room', () => {
  // A speaker label is proof of attendance. Two real meetings sat unfiled for
  // want of this.
  const vtt = 'WEBVTT\n\n1\n00:00:03.980 --> 00:00:04.840\nAnne Throckmorton: Hello there.\n';
  const result = matchMeeting("Rixey Manor Team's Zoom Meeting", directory, { transcript: vtt });
  assert.equal(result.weddingId, 'anne-chris');
});

test('coupleTokens splits "Daniel and Griffin" into both given names', () => {
  assert.deepEqual(coupleTokens('Daniel and Griffin'), ['daniel', 'griffin']);
});

test('coupleTokens splits on & as well as "and"', () => {
  assert.deepEqual(coupleTokens('Anne & Chris'), ['anne', 'chris']);
});

test('coupleTokens drops stop words like "wedding" and "the"', () => {
  assert.ok(!coupleTokens('The Smith Wedding').includes('wedding'));
});

test('coupleTokens on nothing is an empty list', () => {
  assert.deepEqual(coupleTokens(''), []);
  assert.deepEqual(coupleTokens(null), []);
});

test('speakerNames reads the label before the colon on a VTT cue line', () => {
  const vtt = 'WEBVTT\n\n1\n00:00:03.980 --> 00:00:04.840\nAnne Throckmorton: Hello there.\n'
    + '2\n00:00:05.000 --> 00:00:06.000\nChris Bradel: Hi Anne.\n';
  assert.deepEqual(speakerNames(vtt), ['anne throckmorton', 'chris bradel']);
});

test('speakerNames deduplicates repeated speakers', () => {
  const vtt = 'Anne Throckmorton: Hello.\nAnne Throckmorton: Again.\n';
  assert.deepEqual(speakerNames(vtt), ['anne throckmorton']);
});

test('speakerNames on an empty transcript is an empty list', () => {
  assert.deepEqual(speakerNames(''), []);
});

test('mentionsWeddingDate recognises a spelled-out date', () => {
  assert.equal(mentionsWeddingDate('meeting about October 10th plans', '2026-10-10'), true);
});

test('mentionsWeddingDate recognises a numeric date', () => {
  assert.equal(mentionsWeddingDate('10/10 chat', '2026-10-10'), true);
});

test('mentionsWeddingDate is false when the date is not mentioned', () => {
  assert.equal(mentionsWeddingDate('nothing relevant here', '2026-10-10'), false);
});

test('mentionsWeddingDate is false with no wedding date or no text to check', () => {
  assert.equal(mentionsWeddingDate('10/10 chat', null), false);
  assert.equal(mentionsWeddingDate(null, '2026-10-10'), false);
});
