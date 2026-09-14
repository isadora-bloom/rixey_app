/**
 * Guard for turning a Calendly booking into an enquiry.
 *
 * Every case is taken from a real booking in the diary on 15 August 2026.
 *
 * The two that matter most:
 *
 *   "Which package or packages are you interested in?" and "Have you built a
 *   package on our pricing calculator?" both contain the word package. Match
 *   them the wrong way round and every tour reads as though the couple wants
 *   a package called "No".
 *
 *   An existing couple must be recognised by email, not by name. Emily
 *   Farnsworth books the planning meeting for a wedding registered as
 *   "Chris & Emily". Matching on names is what filed Anne Throckmorton's Zoom
 *   call under the wrong couple, and there is a real identifier here.
 *
 * Converted from scripts/test-enquiries.mjs; every assertion there has a test
 * here. server/lib/enquiries.js makes no database or network call, so all of
 * it runs as a plain unit test.
 *
 * Run with: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  enquiryFromEvent, readAnswers, matchToWedding, isTour, normalisePhone, suggestWedding, parseStatedDate,
} from '../../server/lib/enquiries.js';

const PROFILES = [
  { email: 'efarnsies@gmail.com', phone: null, wedding_id: 'chris-emily' },
  { email: 'chrisbradel14@gmail.com', phone: null, wedding_id: 'chris-emily' },
  { email: 'someone@else.com', phone: '(555) 123-4567', wedding_id: 'other-wedding' },
];

// A real venue tour booking.
const tour = enquiryFromEvent({
  uri: 'https://api.calendly.com/scheduled_events/aaa',
  name: 'Rixey Manor Venue Tour',
  start_time: '2026-08-16T15:00:00Z',
  invitees: [{
    name: 'Swati Sinha',
    email: 'Swatisinha444@yahoo.com',
    questions_and_answers: [
      { question: 'Partners First and Last Name ', answer: 'Sree Sinha' },
      { question: 'Partners Email', answer: 'Sree.sinha@gmail.com' },
      { question: 'Phone number', answer: '240-620-9581' },
      { question: 'Do you have a number of invited guests in mind?', answer: '200-230' },
      { question: 'Which package or packages are you interested in?', answer: 'Whole Weekend' },
      { question: 'Have you built a package on our pricing calculator?', answer: 'No' },
      { question: 'Where did you first hear about us?', answer: 'Word of Mouth' },
    ],
  }],
}, { profiles: PROFILES });

test('email is lower-cased so it can be matched later', () => {
  assert.equal(tour.row.email, 'swatisinha444@yahoo.com');
});

test('partner name is read from a question with a trailing space', () => {
  assert.equal(tour.row.partner_name, 'Sree Sinha');
});

test('partner email is lower-cased', () => {
  assert.equal(tour.row.partner_email, 'sree.sinha@gmail.com');
});

test('phone is captured', () => {
  assert.equal(tour.row.phone, '240-620-9581');
});

test('guest estimate is captured', () => {
  assert.equal(tour.row.guest_estimate, '200-230');
});

test('package interest is read, not the calculator answer', () => {
  assert.equal(tour.row.package_interest, 'Whole Weekend');
});

test('the calculator question is kept separately from package interest', () => {
  assert.equal(tour.row.used_calculator, 'No');
});

test('heard-about is captured', () => {
  assert.equal(tour.row.heard_about, 'Word of Mouth');
});

test('every answer is kept verbatim as well as being mapped', () => {
  assert.equal(tour.row.answers.length, 7);
});

test('a new enquirer is not an existing couple', () => {
  assert.equal(tour.isExistingCouple, false);
});

test('a venue tour reads as a tour', () => {
  assert.ok(isTour(tour.row.meeting_kind));
});

// An existing couple booking a planning meeting.
const existing = enquiryFromEvent({
  uri: 'https://api.calendly.com/scheduled_events/bbb',
  name: '1hr Planning Meeting in Person',
  start_time: '2026-08-16T19:00:00Z',
  invitees: [{
    name: 'Emily Farnsworth',
    email: 'efarnsies@gmail.com',
    questions_and_answers: [{ question: 'Phone number', answer: '571-271-1588' }],
  }],
}, { profiles: PROFILES });

test('an existing couple is recognised by email', () => {
  assert.equal(existing.row.wedding_id, 'chris-emily');
});

test('and flagged as an existing couple', () => {
  assert.equal(existing.isExistingCouple, true);
});

test('a planning meeting is not a tour', () => {
  assert.ok(!isTour(existing.row.meeting_kind));
});

test('the partner\'s email on file matches, not just the booker\'s', () => {
  const byPartner = matchToWedding(
    { email: 'nobody@nowhere.com', partnerEmail: 'chrisbradel14@gmail.com' }, PROFILES);
  assert.equal(byPartner.weddingId, 'chris-emily');
});

test('phone matches as a fallback even when formatted differently', () => {
  const byPhone = matchToWedding({ email: 'new@person.com', phone: '5551234567' }, PROFILES);
  assert.equal(byPhone.weddingId, 'other-wedding');
});

test('normalisePhone reduces any formatting to ten digits', () => {
  assert.equal(normalisePhone('+1 (555) 123-4567'), '5551234567');
});

test('an unknown email matches nothing', () => {
  const noMatch = matchToWedding({ email: 'brand@new.com' }, PROFILES);
  assert.equal(noMatch.weddingId, null);
});

test('an event with no invitee is skipped rather than becoming an enquiry', () => {
  assert.equal(enquiryFromEvent({ uri: 'x', name: 'Tour', invitees: [] }, { profiles: PROFILES }), null);
});

test('an unrecognised question is still kept in answers rather than dropped', () => {
  const odd = readAnswers([{ question: 'Anything else we should know?', answer: 'Dog ring bearer' }]);
  assert.equal(odd.answers.length, 1);
});

// Suggesting a couple we already have, without ever filing it. Both cases
// below are real, from the first sync of the diary, and neither could be
// caught by an exact email match though both are obvious to a person.
const WEDDINGS = [
  { id: 'samantha-austin', couple_names: 'Samantha & Austin', partner1_name: null, partner2_name: null,
    profiles: [{ name: 'Samantha Sheads', email: 'sheadssamantha@gmail.com' }] },
  { id: 'daniel-griffin', couple_names: 'Daniel and Griffin', partner1_name: 'Griffin Perry', partner2_name: 'Daniel Weedon',
    profiles: [{ name: 'Daniel Weedon', email: 'dweedon98@gmail.com' }, { name: 'Kim Perry', email: 'grifanddanielwedding@gmail.com' }] },
  { id: 'unrelated', couple_names: 'Bronwen & Thomas', partner1_name: null, partner2_name: null,
    profiles: [{ name: 'Bronwen Low', email: 'bronwen@example.com' }] },
];

test('a one-letter email typo is still suggested', () => {
  // sheadsAamantha vs sheadsSamantha. A final walkthrough for a wedding four
  // weeks away looked like a stranger.
  const typo = suggestWedding({ name: 'Samantha Sheads', email: 'sheadsaamantha@gmail.com' }, WEDDINGS);
  assert.equal(typo?.weddingId, 'samantha-austin');
});

test('an exact name match on a strange email is suggested', () => {
  // Booked from a university address belonging to neither of them, with the
  // couple's own names in the booking.
  const byName = suggestWedding({ name: 'Griffin and Daniel', email: 'jperry32@gmu.edu' }, WEDDINGS);
  assert.equal(byName?.weddingId, 'daniel-griffin');
});

test('a genuine stranger suggests nothing', () => {
  // Offering a wrong couple is worse than offering none: it invites a
  // mis-link that nothing would ever catch.
  const stranger = suggestWedding({ name: 'Tatyana Rivera', email: 'mrandmrsrodriguezplanning@gmail.com' }, WEDDINGS);
  assert.equal(stranger, null);
});

test('one weak name in common is not enough to suggest anything', () => {
  const weak = suggestWedding({ name: 'Sam Other', email: 'sam@nowhere.com' }, WEDDINGS);
  assert.equal(weak, null);
});

const DATES = [
  ['May 8 2027. It is booked. Would llike to revisiy for planting', '2027-05-08'],
  ['9/25/2027', '2027-09-25'],
  ['10-16-2027', '2027-10-16'],
  ['6/5/27', '2027-06-05'],
  ['September 19, 2026 (doing a walkthrough for my client)', '2026-09-19'],
  ['Sept 11,', null],            // no year, so not a date
  ['August 2027', null],         // no day, so not a date
  ['I would say 2028! But it could come way sooner!', null],
];

for (const [text, expected] of DATES) {
  test(`parseStatedDate reads "${text.slice(0, 34)}" as ${expected || 'not a date'}`, () => {
    assert.equal(parseStatedDate(text), expected);
  });
}
