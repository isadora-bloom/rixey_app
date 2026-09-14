/**
 * Work out which wedding a typed sentence is about.
 *
 * "tell me the caterer for alyssas wedding" is how the venue owner thinks: the
 * couple first, the question second, no dropdown in between. This turns that
 * sentence into a wedding and a question.
 *
 * It scores, it does not pattern match. There is no regex that reads meaning
 * out of what she typed; the only regex here splits the text into words and
 * takes an apostrophe off the end of one. Everything after that is set
 * membership and arithmetic, which is the part you can argue with when it gets
 * something wrong.
 *
 * It also refuses to guess. Two Alyssas in the book means two Alyssas come
 * back as candidates and she picks. A wrong answer about the right-sounding
 * couple is the failure that costs something: it reads as correct, it gets
 * acted on, and nobody goes back to check which wedding it came from.
 *
 * Pure: no React, no database, no network. Shared so the server and the tests
 * score the same way.
 */

/** A first name on its own. Weak: first names collide, surnames mostly do not. */
const W_FIRST = 2;
/** A surname. Twice a first name, because it tells weddings apart. */
const W_SURNAME = 4;
/** On top of the two above when one person's first name AND surname are both there. */
const W_PAIR_BONUS = 4;
/** A word from couple_names or project_name that is neither a known first nor a surname. */
const W_OTHER = 2;

/**
 * The winner must beat the runner-up by this much. Anything closer is a coin
 * flip and comes back as a question rather than an answer.
 */
const MIN_MARGIN = 2;

/** Up to this many chips before she is being asked to read a list. */
const MAX_CANDIDATES = 5;

/**
 * Words that appear in a project or couple field without naming anybody.
 * Scoring "wedding" would give every wedding in the book a point.
 */
const NAME_STOP_WORDS = new Set([
  'wedding', 'weddings', 'rixey', 'manor', 'event', 'project', 'and', 'the',
  'party', 'reception', 'family', 'test',
]);

/** Openers that carry no meaning. Stripped only from the front, only whole. */
const LEAD_PHRASES = [
  ['tell', 'me', 'about'],
  ['tell', 'me'],
  ['what', 'is'],
  ['what', 'are'],
  ['who', 'is'],
];

/** Words worth dropping off the end once the name has gone with them. */
const TRAIL_WORDS = new Set(['for', 'wedding', 'weddings', 'the', 'and', 'of', 's']);

/** Below this the trimmed question has stopped being a question. */
const MIN_QUESTION_LENGTH = 3;

/** Lower case, possessive off, letters only, one word per entry. */
function words(value) {
  return String(value == null ? '' : value)
    .toLowerCase()
    .replace(/['’]s\b/g, '')
    .replace(/s['’](?=\s|$)/g, 's')
    .replace(/[^a-z]+/g, ' ')
    .split(' ')
    .filter(Boolean);
}

/**
 * The words of the typed text worth scoring.
 *
 * Three letters and up: "of", "is" and "to" match names nobody meant, and a
 * two-letter name is not something a sentence can single a wedding out by.
 */
export function tokenise(text) {
  return words(text).filter(w => w.length >= 3);
}

/** "Brett Johnson" -> { first: 'brett', last: 'johnson' }. One word means no surname. */
function person(value) {
  const parts = words(value).filter(w => !NAME_STOP_WORDS.has(w));
  if (!parts.length) return null;
  return {
    first: parts[0],
    last: parts.length > 1 ? parts[parts.length - 1] : null,
  };
}

/**
 * Split couple_names into the people in it.
 *
 * "Alyssa & Brett Johnson" is two people, one of whom has a surname written
 * down. Splitting on the separators rather than on spaces is what stops
 * "Christiane and Jarred" becoming one unmatchable name.
 */
function peopleFromCoupleNames(coupleNames) {
  return String(coupleNames == null ? '' : coupleNames)
    .split(/\s*(?:&|\+|,|\band\b)\s*/i)
    .map(person)
    .filter(Boolean);
}

/** Everything about one wedding that a sentence could name it by. */
function nameIndex(wedding) {
  const people = [];
  const seen = new Set();
  for (const p of [person(wedding.partner1_name), person(wedding.partner2_name), ...peopleFromCoupleNames(wedding.couple_names)]) {
    if (!p) continue;
    const key = `${p.first}|${p.last || ''}`;
    if (seen.has(key)) continue;
    // A bare first name already covered by a first-and-surname entry adds
    // nothing, and would otherwise be scored a second time.
    if (!p.last && people.some(q => q.first === p.first)) continue;
    seen.add(key);
    people.push(p);
  }

  const known = new Set();
  for (const p of people) { known.add(p.first); if (p.last) known.add(p.last); }

  const others = new Set(
    words(wedding.project_name).filter(w => w.length >= 3 && !NAME_STOP_WORDS.has(w) && !known.has(w))
  );

  return { people, others };
}

/**
 * Is this name in the typed words?
 *
 * "alyssas wedding" is how it gets typed when the apostrophe is in a hurry, so
 * a trailing s counts as the same name. Returns the word that was actually
 * typed, because that is the one the question trimmer has to remove.
 */
function hit(tokens, name) {
  if (!name) return null;
  if (tokens.has(name)) return name;
  if (tokens.has(`${name}s`)) return `${name}s`;
  return null;
}

function scoreWedding(wedding, tokens) {
  const { people, others } = nameIndex(wedding);
  let score = 0;
  let sawSurname = false;
  let sawPair = false;
  const counted = new Set();
  const typed = new Set();

  for (const p of people) {
    const first = hit(tokens, p.first);
    const last = hit(tokens, p.last);
    if (first && !counted.has(p.first)) {
      score += W_FIRST;
      counted.add(p.first);
      typed.add(first);
    }
    if (last && !counted.has(p.last)) {
      score += W_SURNAME;
      counted.add(p.last);
      typed.add(last);
      sawSurname = true;
    }
    if (first && last) {
      score += W_PAIR_BONUS;
      sawPair = true;
    }
  }

  for (const o of others) {
    const word = hit(tokens, o);
    if (word && !counted.has(o)) {
      score += W_OTHER;
      counted.add(o);
      typed.add(word);
    }
  }

  return { wedding, score, sawSurname, sawPair, distinct: counted.size, typed };
}

function rank(weddings, tokens) {
  return weddings
    .map(w => scoreWedding(w, tokens))
    .filter(e => e.score > 0)
    .sort((a, b) => b.score - a.score || b.distinct - a.distinct);
}

/**
 * The question with the name and the scaffolding taken off.
 *
 * Deliberately shy. It strips a known opener from the front, then walks
 * backwards from the end dropping the name words and the words that were only
 * holding the name on. Nothing is removed from the middle: "how many guests
 * does melissa have" keeps its Melissa, because taking her out of the middle
 * of that sentence leaves something that reads like a fragment.
 *
 * If what is left is too short to be a question, the original goes through
 * untouched. A model can cope with a name it already has; it cannot cope with
 * being asked "the".
 */
export function trimQuestion(text, nameWords = []) {
  const original = String(text == null ? '' : text).trim();
  const parts = original.split(/\s+/).filter(Boolean);
  if (!parts.length) return original;

  const norm = w => w.toLowerCase().replace(/['’]s$/, '').replace(/[^a-z]/g, '');

  const drop = new Set();
  for (const n of nameWords) { drop.add(n); drop.add(`${n}s`); }

  let start = 0;
  for (const phrase of LEAD_PHRASES) {
    if (phrase.length <= parts.length && phrase.every((p, i) => norm(parts[i]) === p)) {
      start = phrase.length;
      break;
    }
  }

  let end = parts.length;
  while (end > start) {
    const w = norm(parts[end - 1]);
    if (!w || drop.has(w) || TRAIL_WORDS.has(w)) { end -= 1; continue; }
    break;
  }

  const trimmed = parts.slice(start, end).join(' ').replace(/[\s,]+$/, '').trim();
  return trimmed.length < MIN_QUESTION_LENGTH ? original : trimmed;
}

/**
 * Which wedding is this sentence about, and what is it actually asking?
 *
 * @param {string} text          what she typed, whole
 * @param {object[]} weddings    rows with couple_names, partner1_name,
 *                               partner2_name, project_name, archived
 * @returns {{ wedding: object|null, question: string, candidates: object[], confidence: string }}
 *
 * confidence is 'high' when the winner was named by a surname, by a full first
 * and surname, or by two separate words; 'medium' when one first name carried
 * it; 'low' when it came back as candidates; 'none' when nothing matched.
 */
export function matchWedding(text, weddings) {
  const list = Array.isArray(weddings) ? weddings : [];
  const tokens = new Set(tokenise(text));

  // Archived weddings are last year's problem and they crowd the live ones out
  // of a tie. They are only scored when nothing current matches at all, which
  // is how "what did we charge for the Pike wedding" still works.
  let ranked = rank(list.filter(w => !w.archived), tokens);
  if (!ranked.length) ranked = rank(list.filter(w => w.archived), tokens);

  const named = new Set();
  for (const e of ranked) for (const w of e.typed) named.add(w);
  const question = trimQuestion(text, [...named]);

  if (!ranked.length) {
    return { wedding: null, question, candidates: [], confidence: 'none' };
  }

  const top = ranked[0];
  const near = ranked.filter(e => top.score - e.score < MIN_MARGIN);
  if (near.length > 1) {
    return {
      wedding: null,
      question,
      candidates: near.slice(0, MAX_CANDIDATES).map(e => e.wedding),
      confidence: 'low',
    };
  }

  return {
    wedding: top.wedding,
    question,
    candidates: [],
    confidence: (top.sawSurname || top.sawPair || top.distinct >= 2) ? 'high' : 'medium',
  };
}
