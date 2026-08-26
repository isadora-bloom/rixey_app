/**
 * Deciding when two vendor names are one vendor.
 *
 * `vendor_checklist.vendor_name` is free text a couple types, so Sammy's has
 * been booked under nine spellings and Genesis under four. Collapsing those is
 * most of what makes a vendor record possible at all.
 *
 * The rule is deliberately shy. Two names are the SAME only when the
 * difference is bookkeeping: case, punctuation, a trailing Inc or LLC, a
 * parenthetical aside, a plural. Anything where the difference carries meaning
 * is a QUESTION, not an answer:
 *
 *   "Ivett Beauty Co." / "Ivett Beauty Co"        same, obviously
 *   "Sara Dodson (also does makeup)" / "Sara Dodson"   same, the note is not a name
 *   "Genesis" / "Genesis Catering"                could be. Ask.
 *   "Briarley Images - Rachele Patterson"         a person at a company. Ask.
 *   "Carpe Donut/Rodeo Catering"                  looks like two vendors. Ask.
 *
 * Answers, once given, are kept. See RULINGS: that last one turned out to be
 * one company, and asking again next month would be its own kind of broken.
 *
 * Getting this wrong in the shy direction leaves a duplicate on a list, which
 * anyone can see and fix. Getting it wrong in the confident direction files
 * Carpe Donut's donuts under a caterer and nobody ever notices.
 *
 * Shared by the backfill script and the API so the rule cannot drift between
 * "what we imported" and "what we match new bookings against".
 */

// Words that are bookkeeping rather than identity. Legal suffixes, joining
// words, and the tail of a web address, because ImTheDJ.net is ImTheDJ.
const NOISE = new Set([
  'inc', 'llc', 'ltd', 'co', 'corp', 'company', 'incorporated',
  'the', 'and', 'a', 'of',
  'com', 'net', 'org',
]);

// Words that DO carry identity even though they look generic. Listed so it is
// obvious they were considered and left in: "Genesis" and "Genesis Catering"
// are not the same claim.
export const MEANINGFUL_GENERICS = [
  'catering', 'caterers', 'photography', 'photo', 'images', 'rentals', 'rental',
  'events', 'entertainment', 'studios', 'studio', 'design', 'designs', 'flowers',
  'cakes', 'beauty', 'productions', 'bridal', 'sounds', 'soundz',
];

/**
 * Pairs a person has already ruled on, so nothing asks twice.
 *
 * Both of these were the matcher's two known failures, and both turned out to
 * be merges rather than the splits it assumed. Isadora, 26 August 2026:
 *
 *   "rodeo and carpe are in fact the same company, and imthedj and nate
 *    clancy are the company and the owner"
 *
 * So "Carpe Donut/Rodeo Catering" was never two vendors sharing a field, and
 * Nate Clancy is not a DJ booked alongside ImTheDJ, he owns it. Written down
 * because the alternative is re-deriving it from the names, which is exactly
 * what got it wrong the first time.
 */
const RULINGS = [
  {
    group: 'carpe-rodeo',
    names: ['Carpe Donut', 'Carpe Donuts', 'Rodeo Catering', 'Carpe Donut/Rodeo Catering', 'Rodeo Catering - Matt'],
  },
  {
    group: 'imthedj',
    names: ["I'm the DJ", 'ImTheDJ', 'ImTheDJ.net', 'ImTheDJ (Nate Clancy)', 'ImTheDJ - DJ Nate', 'Nate Clancy', 'DJ Nate Clancy'],
  },
];

/** Which ruled group a name falls in, if any. Matches on the key, so spelling varies freely. */
export function ruledGroup(name) {
  const key = vendorKey(name);
  for (const r of RULINGS) {
    if (r.names.some(n => vendorKey(n) === key)) return r.group;
  }
  return null;
}

/**
 * Two vendors crammed into one field: "Carpe Donut/Rodeo Catering".
 *
 * A slash, or an "or". Deliberately NOT an ampersand: Bride & Joy, C&G Events
 * and Hampton Inn & Suites are each one business, and treating & as a split
 * turned a third of the review queue into nonsense.
 */
export function looksLikeTwoVendors(name) {
  return /\s*\/\s*|\s+or\s+/i.test(String(name || '').replace(/\(.*?\)/g, ''));
}

/** The parts either side of a slash or an "or", each trimmed. */
export function splitVendorField(name) {
  return String(name || '')
    .replace(/\(.*?\)/g, ' ')
    .split(/\s*\/\s*|\s+or\s+/i)
    .map(p => p.trim())
    .filter(Boolean);
}

/** Levenshtein, capped. Only used to spot a typed name against the same name typed again. */
function editDistance(a, b, cap = 3) {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

// A bare trade where a company name should be. These come from the document
// importer reading a service column as a supplier: "Hair" is not a business,
// it is what the row was about. Only ever a placeholder on its own.
const BARE_TRADES = new Set([
  'hair', 'makeup', 'hair and makeup', 'photographer', 'photography', 'photo',
  'catering', 'caterer', 'dj', 'florist', 'flowers', 'band', 'videographer',
  'video', 'officiant', 'rentals', 'rental', 'cake', 'dessert', 'transport',
  'transportation', 'linens', 'tent', 'tents', 'venue', 'planner', 'coordinator',
]);

/** A name that is not a name: a CSV header, a placeholder, a trade, an empty cell. */
export function isPlaceholderName(name) {
  const n = String(name || '').trim();
  if (!n) return true;
  if (/^(name|vendor|vendor name|n\/?a|na|tbd|tba|none|unknown|test|\?+|-+)$/i.test(n)) return true;
  return BARE_TRADES.has(n.toLowerCase());
}

/**
 * Down to letters and digits. Parentheticals go first: they are asides
 * ("(also does makeup)", "(Tent)"), never the name itself.
 */
export function normaliseVendorName(name) {
  return String(name || '')
    .replace(/\(.*?\)/g, ' ')
    .replace(/[‘’ʼ']/g, '')    // not a word break: "Sammy's Rentals" is "Sammys Rentals"
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const depluralise = t => (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t);

/** Significant words, singularised, sorted. Same key means same vendor. */
export function vendorKey(name) {
  const tokens = normaliseVendorName(name)
    .split(' ')
    .filter(Boolean)
    .filter(t => !NOISE.has(t))
    .map(depluralise);
  // Every word was noise ("The Co"), so fall back to the raw form rather than
  // handing back an empty key that matches every other empty key.
  return tokens.length ? [...new Set(tokens)].sort().join(' ') : normaliseVendorName(name);
}

/** Safe to merge without asking. */
export function isSameVendor(a, b) {
  if (isPlaceholderName(a) || isPlaceholderName(b)) return false;
  // A ruling beats every heuristic below it. That is the point of one.
  const ga = ruledGroup(a);
  if (ga && ga === ruledGroup(b)) return true;
  // A field holding two vendors cannot be confidently equal to either of them.
  if (looksLikeTwoVendors(a) !== looksLikeTwoVendors(b)) return false;
  const ka = vendorKey(a);
  const kb = vendorKey(b);
  return Boolean(ka) && ka === kb;
}

/**
 * Might be the same vendor, worth a human glance. One name's words being a
 * subset of the other's ("Genesis" inside "Genesis Catering"), or a shared
 * distinctive word ("Briarley").
 *
 * Returns null when there is nothing to ask about.
 */
export function mergeCandidateReason(a, b) {
  if (isSameVendor(a, b)) return null;
  if (isPlaceholderName(a) || isPlaceholderName(b)) return null;
  // Ruled apart is still ruled. Do not re-ask about a pair in two named groups.
  const ga = ruledGroup(a), gb = ruledGroup(b);
  if (ga && gb && ga !== gb) return null;

  const ta = vendorKey(a).split(' ').filter(Boolean);
  const tb = vendorKey(b).split(' ').filter(Boolean);
  if (!ta.length || !tb.length) return null;

  // A field with two vendors in it, where one of them is the other name.
  for (const [x, y] of [[a, b], [b, a]]) {
    if (!looksLikeTwoVendors(x)) continue;
    if (splitVendorField(x).some(part => vendorKey(part) === vendorKey(y))) {
      return `"${x}" has two vendors in it, and one of them is this. Same vendor, or should that booking be split?`;
    }
  }

  // One name is the other plus a word: "Genesis" inside "Genesis Catering",
  // "Sammy's" inside "Sammy's Rentals", a photographer's name inside their
  // studio name. Genuinely ambiguous, genuinely common.
  const subset = ta.every(t => tb.includes(t)) || tb.every(t => ta.includes(t));
  if (subset) {
    const [small, big] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
    // "The Catering Company" reduces to the single word "catering", which sits
    // inside half the caterers here. A name that is only a trade is not a lead.
    const onlyTrade = small.length === 1 && MEANINGFUL_GENERICS.includes(small[0]);
    if (!onlyTrade) {
      const extra = big.filter(t => !small.includes(t));
      return `One is the other with "${extra.join(' ')}" on the end.`;
    }
  }

  // The same name typed twice with a slip in it: Yisell / Yiselle, Chiplote /
  // Chipotle. Same shape, one word out by a letter or two.
  if (ta.length === tb.length) {
    const pairs = ta.map((t, i) => [t, tb[i]]);
    const differing = pairs.filter(([x, y]) => x !== y);
    if (differing.length === 1) {
      const [x, y] = differing[0];
      const d = editDistance(x, y);
      if (d > 0 && d <= 2 && Math.max(x.length, y.length) >= 5) {
        return `"${x}" and "${y}" look like the same word typed twice.`;
      }
    }
  }

  // Everything else is two vendors that happen to share a word. "Black Garlic"
  // and "Black Tie Entertainment" are not a question, and asking made the
  // queue long enough to ignore, which is the same as having no queue.
  return null;
}

/**
 * Find a vendor for a booked name among existing records, checking aliases as
 * well as the name. Returns { vendor, confident } or null.
 */
export function findVendor(name, vendors) {
  if (isPlaceholderName(name)) return null;
  const key = vendorKey(name);
  const group = ruledGroup(name);
  for (const v of vendors) {
    const names = [v.name, ...(v.aliases || [])];
    if (names.some(n => vendorKey(n) === key)) return { vendor: v, confident: true };
    // A ruling reaches across names that share nothing: Rodeo Catering is
    // Carpe Donut, and no amount of comparing letters would say so.
    if (group && names.some(n => ruledGroup(n) === group)) return { vendor: v, confident: true };
  }
  return null;
}

/**
 * The tidiest spelling in a cluster, which becomes the vendor's name. Longest
 * wins, because the extra words are usually the real name and the short form
 * is the abbreviation. Ties break on how often it was typed.
 */
export function preferredSpelling(entries) {
  return [...entries].sort((a, b) => {
    const wa = normaliseVendorName(a.name).split(' ').length;
    const wb = normaliseVendorName(b.name).split(' ').length;
    if (wa !== wb) return wb - wa;
    if (a.count !== b.count) return b.count - a.count;
    return a.name.localeCompare(b.name);
  })[0].name;
}

/** vendor_checklist.vendor_type is free-ish text. Map it onto a directory category. */
const CATEGORY_BY_TYPE = {
  'caterer': 'Catering',
  'catering': 'Catering',
  'catering for saturday lunch': 'Lunch',
  'catering for sunday brunch': 'Brunch',
  'catering for rehearsal': 'Rehearsal',
  'dj': 'DJ',
  'band': 'Band',
  'photographer': 'Photography',
  'photography': 'Photography',
  'photo booth': 'Photo Booth',
  'videographer': 'Videography',
  'rentals': 'Decor Rentals',
  'rental': 'Decor Rentals',
  'decor': 'Decor Rentals',
  'florist': 'Florist',
  'hair': 'Hair and Makeup',
  'makeup': 'Hair and Makeup',
  'hair + makeup': 'Hair and Makeup',
  'hair and makeup': 'Hair and Makeup',
  'officiant': 'Officiants',
  'cake': 'Dessert',
  'cake/dessert': 'Dessert',
  'dessert': 'Dessert',
  'transportation': 'Transport',
  'shuttle': 'Transport',
  'linens': 'Linens',
  'tent': 'Tents',
  'coordinator': 'Planner',
  'planner': 'Planner',
  'hotel block': 'Hotels',
  'venue': 'Venue',
  'alcohol': 'Alcohol',
  'staffing': 'Staffing',
};

/**
 * Categories that are the same category. Only spelling: the on-site and
 * off-site rehearsal distinction is real and stays.
 */
const CATEGORY_FIXES = {
  'rehersal off site': 'Rehearsal Off Site',
  'rehersal': 'Rehearsal',
  'officiant': 'Officiants',
  'hotel': 'Hotels',
};
// Deliberately absent: Decorator -> Decor Rentals. Shagun and Liz decorate an
// Indian wedding; Local Wood rents you farm tables. Not the same trade.

export function tidyCategory(category) {
  const c = String(category || '').trim();
  return CATEGORY_FIXES[c.toLowerCase()] || c;
}

export function categoryForVendorType(vendorType) {
  const t = String(vendorType || '').toLowerCase().trim();
  return CATEGORY_BY_TYPE[t] || 'Other';
}
