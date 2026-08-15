/**
 * Guard for turning a Calendly booking into an enquiry.
 *
 * Every case is taken from a real booking in the diary on 15 August 2026.
 *
 * The two that matter most:
 *
 *   "Which package or packages are you interested in?" and "Have you built a
 *   package on our pricing calculator?" both contain the word package. Match
 *   them the wrong way round and every tour reads as though the couple wants a
 *   package called "No".
 *
 *   An existing couple must be recognised by email, not by name. Emily
 *   Farnsworth books the planning meeting for a wedding registered as
 *   "Chris & Emily". Matching on names is what filed Anne Throckmorton's Zoom
 *   call under the wrong couple, and there is a real identifier here.
 *
 * Run: node scripts/test-enquiries.mjs
 */
import { enquiryFromEvent, readAnswers, matchToWedding, isTour, normalisePhone, suggestWedding, parseStatedDate } from '../server/lib/enquiries.js';

const PROFILES = [
  { email: 'efarnsies@gmail.com', phone: null, wedding_id: 'chris-emily' },
  { email: 'chrisbradel14@gmail.com', phone: null, wedding_id: 'chris-emily' },
  { email: 'someone@else.com', phone: '(555) 123-4567', wedding_id: 'other-wedding' },
];

let failures = 0;
const check = (name, ok) => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'pass' : 'FAIL'}  ${name}`);
};

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

check('email is lower-cased so it can be matched later', tour.row.email === 'swatisinha444@yahoo.com');
check('partner name read from a question with a trailing space', tour.row.partner_name === 'Sree Sinha');
check('partner email lower-cased', tour.row.partner_email === 'sree.sinha@gmail.com');
check('phone captured', tour.row.phone === '240-620-9581');
check('guest estimate captured', tour.row.guest_estimate === '200-230');
check('package interest, not the calculator answer', tour.row.package_interest === 'Whole Weekend');
check('calculator question kept separately', tour.row.used_calculator === 'No');
check('heard about captured', tour.row.heard_about === 'Word of Mouth');
check('every answer kept verbatim as well', tour.row.answers.length === 7);
check('a new enquirer is not an existing couple', tour.isExistingCouple === false);
check('a venue tour reads as a tour', isTour(tour.row.meeting_kind));

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

check('existing couple recognised by email', existing.row.wedding_id === 'chris-emily');
check('and flagged as such', existing.isExistingCouple === true);
check('a planning meeting is not a tour', !isTour(existing.row.meeting_kind));

// The partner's email is the one on file, not the person who booked.
const byPartner = matchToWedding(
  { email: 'nobody@nowhere.com', partnerEmail: 'chrisbradel14@gmail.com' }, PROFILES);
check('matched on the partner\'s email when the booker is unknown', byPartner.weddingId === 'chris-emily');

// Phone as a fallback, written differently on each side.
const byPhone = matchToWedding({ email: 'new@person.com', phone: '5551234567' }, PROFILES);
check('matched on phone when formatting differs', byPhone.weddingId === 'other-wedding');
check('phone normalises to ten digits', normalisePhone('+1 (555) 123-4567') === '5551234567');

// Nothing to go on.
const noMatch = matchToWedding({ email: 'brand@new.com' }, PROFILES);
check('an unknown email matches nothing', noMatch.weddingId === null);

// A held or cancelled slot has no invitee and must not become an enquiry.
check('an event with no invitee is skipped',
  enquiryFromEvent({ uri: 'x', name: 'Tour', invitees: [] }, { profiles: PROFILES }) === null);

// An unrecognised question is still kept rather than dropped.
const odd = readAnswers([{ question: 'Anything else we should know?', answer: 'Dog ring bearer' }]);
check('an unmapped question is still kept in answers', odd.answers.length === 1);

// ── Suggesting a couple we already have, without ever filing it ────────────
//
// Both cases below are real, from the first sync of the diary. Neither could be
// caught by an exact email match, and both are obvious to a person.

const WEDDINGS = [
  { id: 'samantha-austin', couple_names: 'Samantha & Austin', partner1_name: null, partner2_name: null,
    profiles: [{ name: 'Samantha Sheads', email: 'sheadssamantha@gmail.com' }] },
  { id: 'daniel-griffin', couple_names: 'Daniel and Griffin', partner1_name: 'Griffin Perry', partner2_name: 'Daniel Weedon',
    profiles: [{ name: 'Daniel Weedon', email: 'dweedon98@gmail.com' }, { name: 'Kim Perry', email: 'grifanddanielwedding@gmail.com' }] },
  { id: 'unrelated', couple_names: 'Bronwen & Thomas', partner1_name: null, partner2_name: null,
    profiles: [{ name: 'Bronwen Low', email: 'bronwen@example.com' }] },
];

// One letter out: sheadsAamantha vs sheadsSamantha. A final walkthrough for a
// wedding four weeks away looked like a stranger.
const typo = suggestWedding({ name: 'Samantha Sheads', email: 'sheadsaamantha@gmail.com' }, WEDDINGS);
check('a one-letter email typo is suggested', typo?.weddingId === 'samantha-austin');

// Booked from a university address belonging to neither of them, with the
// couple's own names in the booking.
const byName = suggestWedding({ name: 'Griffin and Daniel', email: 'jperry32@gmu.edu' }, WEDDINGS);
check('an exact name match on a strange email is suggested', byName?.weddingId === 'daniel-griffin');

// A genuine stranger must suggest nothing. Offering a wrong couple is worse
// than offering none: it invites a mis-link that nothing would ever catch.
const stranger = suggestWedding({ name: 'Tatyana Rivera', email: 'mrandmrsrodriguezplanning@gmail.com' }, WEDDINGS);
check('a genuine stranger suggests nothing', stranger === null);

// A single common first name is most of a client list and must not be enough.
const weak = suggestWedding({ name: 'Sam Other', email: 'sam@nowhere.com' }, WEDDINGS);
check('one weak name in common is not enough', weak === null);

// ── The date they typed ────────────────────────────────────────────────────
const dates = [
  ['May 8 2027. It is booked. Would llike to revisiy for planting', '2027-05-08'],
  ['9/25/2027', '2027-09-25'],
  ['10-16-2027', '2027-10-16'],
  ['6/5/27', '2027-06-05'],
  ['September 19, 2026 (doing a walkthrough for my client)', '2026-09-19'],
  ['Sept 11,', null],            // no year, so not a date
  ['August 2027', null],         // no day, so not a date
  ['I would say 2028! But it could come way sooner!', null],
];
for (const [text, expected] of dates) {
  check(`date "${text.slice(0, 34)}" → ${expected || 'not a date'}`, parseStatedDate(text) === expected);
}

console.log(failures ? `\n${failures} failure(s)` : '\nall enquiry cases pass');
process.exit(failures ? 1 : 0);
