/**
 * Guard for meeting attribution.
 *
 * Every case here is real. Anne Throckmorton's planning meeting spent three
 * weeks filed under Chris & Emily because both weddings have an Anne, and 148
 * planning notes went with it, including a critical potato allergy. Melissa
 * Pike's onboarding was one sync away from the same thing, because there are
 * two Melissas.
 *
 * The rule being protected: a shared first name never files a meeting. It takes
 * a first and last name, both halves of the couple, or a name with the wedding
 * date. Anything less becomes a question.
 *
 * Run: node scripts/test-meeting-match.mjs
 */
import { buildDirectory, matchMeeting } from '../shared/meeting-match.js';

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

const directory = buildDirectory(WEDDINGS);
let failures = 0;

for (const [topic, expected] of CASES) {
  const result = matchMeeting(topic, directory);
  const got = result.weddingId;
  const ok = String(got) === String(expected);
  if (!ok) failures++;
  console.log(`${ok ? '  pass' : '  FAIL'}  ${topic.padEnd(52)} -> ${got || 'ask a human'}`);
  if (!ok) console.log(`        expected ${expected || 'ask a human'}; reason given: ${result.reason}`);
}

// A speaker label is proof of attendance, so it can file a meeting Zoom named
// after the host's own room. Two real meetings sat unfiled for want of this.
const vtt = 'WEBVTT\n\n1\n00:00:03.980 --> 00:00:04.840\nAnne Throckmorton: Hello there.\n';
const bySpeaker = matchMeeting("Rixey Manor Team's Zoom Meeting", directory, { transcript: vtt });
const speakerOk = bySpeaker.weddingId === 'anne-chris';
if (!speakerOk) failures++;
console.log(`${speakerOk ? '  pass' : '  FAIL'}  untitled meeting, identified by who spoke in it`);

console.log(failures ? `\n${failures} failure(s)` : '\nall meeting-match cases pass');
process.exit(failures ? 1 : 0);
