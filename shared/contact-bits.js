/**
 * Pulling an email, a phone number, a website and a person's name out of the
 * one free-text box they were all typed into.
 *
 * Vendor contact detail arrives as a single string, written by whoever was
 * filling the form in:
 *
 *   "nate@imthedj.net"
 *   "434-806-6202"
 *   "Jessica Brose, jessica@serendipityvirginia.com, (540) 779-0545 direct, www.serendipityvirginia.com"
 *   "Phone: (703) 361-6216, Email: info@sammysrental.com"
 *
 * The parts are found by shape, not by position, because there is no position:
 * the same field holds one thing or four in any order. Each candidate is then
 * validated, and anything left over that cannot be classified is handed back
 * in `unparsed` rather than dropped, so a caller can log it and somebody can
 * look. A silent drop here is how a vendor's only phone number disappears.
 *
 * Not used for anything a person typed as prose. This is for fields that were
 * meant to hold contact details and mostly do.
 */

import { normalizePhone } from './phone.js';

// Anchored on the @ AND a dot in the domain AND a plausible TLD, rather than
// the usual one-token guess. Trailing punctuation is stripped by the class.
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

// A web address with a scheme, a www, or a bare domain on a known TLD. The
// list is short on purpose: matching every TLD turns "Jessica Brose, direct"
// into a website.
const URL_LIKE = /\b(?:https?:\/\/)?(?:www\.)?[A-Z0-9-]{2,}(?:\.[A-Z0-9-]{2,})*\.(?:com|net|org|co|io|biz|us|info|photography|events|studio)\b(?:\/[^\s,;]*)?/gi;

// Ten or eleven digits with the usual separators. Validated through
// normalizePhone afterwards, which is the same rule the rest of the app uses.
const PHONE_LIKE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;

const HANDLE = /(?:^|\s)@([A-Z0-9._]{2,30})\b/gi;

// Words that label a field rather than being part of one.
const LABELS = /\b(phone|tel|telephone|mobile|cell|email|e-mail|mail|web|website|site|fax|contact|direct|office|address|instagram|ig)\b\s*[:\-—]?/gi;

/**
 * Whose details are these? Contract extraction produced 111 lines that are the
 * COUPLE's phone and email, not the vendor's, sitting in the same place. Put
 * one of those on a vendor record and Rixey rings a bride to ask about linens.
 */
export function isAboutTheCouple(text) {
  return /^\s*(client|clients|couple|bride|groom|customer)\b/i.test(String(text || ''))
    || /\b(client|bride|groom)('s)?\s+(email|phone|address|number|contact)\b/i.test(String(text || ''));
}

// Words that turn up where a person's name should be, because a contract says
// "Provider:" or "Official Signing" or names the company again.
const NOT_A_PERSON = new Set([
  'provider', 'vendor', 'supplier', 'official', 'signing', 'signature', 'company',
  'inc', 'llc', 'ltd', 'corp', 'rental', 'rentals', 'catering', 'caterer', 'services',
  'service', 'entertainment', 'photography', 'productions', 'events', 'event', 'tent',
  'tents', 'linens', 'venue', 'admin', 'office', 'sales', 'manager', 'coordinator',
  'contract', 'agreement', 'invoice', 'proposal', 'total', 'deposit', 'balance',
  'estimate', 'quote', 'date', 'time', 'guest', 'guests', 'wedding', 'reception',
  'dj', 'band', 'florist', 'bakery', 'kitchen', 'truck', 'bar', 'staff',
]);

const dedupe = arr => [...new Set(arr)];

/**
 * @param {string} raw the field as written
 * @param {string} [vendorName] so the company name repeated back is not read as a person
 * @returns {{emails: string[], phones: string[], websites: string[], handles: string[], person: string|null, unparsed: string[]}}
 */
export function extractContactBits(raw, vendorName) {
  const text = String(raw || '').trim();
  const empty = { emails: [], phones: [], websites: [], handles: [], person: null, unparsed: [] };
  if (!text) return empty;

  // A fax number is not a phone number. Sammy's contract lists both, one line
  // apart, and whichever was taken first would have become the number Rixey
  // rings. Drop the segment the word sits in before anything else runs.
  let rest = text
    .split(/[,;|\n]+/)
    .filter(seg => !/\bfax\b/i.test(seg))
    .join(', ');
  if (!rest.trim()) return { ...empty, unparsed: [text] };

  const take = (re) => {
    const found = [];
    rest = rest.replace(re, m => { found.push(m.trim()); return ' '; });
    return found;
  };

  // Emails first. An email contains a domain, so pulling websites first would
  // eat half of one and leave "@imthedj.net" behind as a handle.
  const emails = dedupe(take(EMAIL).map(e => e.toLowerCase()));
  const handles = dedupe(take(HANDLE).map(h => h.replace(/^\s*@/, '').toLowerCase()));
  const phonesRaw = take(PHONE_LIKE);
  const websites = dedupe(take(URL_LIKE).map(w => w.replace(/[.,;]+$/, '')));

  // Validated, not just matched. A run of ten digits that is not a phone
  // number, an order reference say, comes back null and is kept as unparsed.
  const phones = [];
  const notPhones = [];
  for (const p of phonesRaw) {
    (normalizePhone(p) ? phones : notPhones).push(p.trim());
  }

  // What is left, once the labels and punctuation go, is usually the person.
  const leftovers = rest
    .replace(LABELS, ' ')
    .split(/[,;|\n]+/)
    .map(s => s.replace(/[\s.\-—]+/g, ' ').trim())
    .filter(Boolean);

  // A person's name: two or three words, each starting with a capital in the
  // original, none of them a trade or a form label. The looser first version
  // of this produced "Provider admin", "Official Signing" and "Sammy's Rental
  // tent" as contact people, which is worse than an empty field because it
  // reads as a fact somebody checked.
  const looksLikeName = s =>
    /^[A-Z][A-Za-z'’.-]*(?:\s+[A-Z][A-Za-z'’.-]*){1,2}$/.test(s)
    && !s.split(/\s+/).some(w => NOT_A_PERSON.has(w.toLowerCase().replace(/[^a-z]/g, '')));
  let person = leftovers.find(looksLikeName) || null;
  // "Sammy's Rental tent" is the company written out again, not who to ask for.
  if (person && vendorName) {
    const flat = t => String(t).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (flat(vendorName).includes(flat(person)) || flat(person).includes(flat(vendorName))) person = null;
  }
  const unparsed = leftovers.filter(s => s !== person && s.length > 2).concat(notPhones);

  return { emails, phones: dedupe(phones), websites, handles, person, unparsed };
}
