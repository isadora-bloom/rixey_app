/**
 * Work out which wedding a meeting belongs to.
 *
 * The old rule was a flat object of name -> wedding id, built by looping over
 * every wedding and writing each profile's first name into it. Two problems,
 * both live:
 *
 *   Last write wins. Three first names are claimed by two weddings each
 *   ("anne", "melissa", "grace"), so whichever wedding happened to load last
 *   silently owned the name. Melissa Pike's onboarding transcript was one sync
 *   away from being filed under Melissa Lesner's wedding, where it would have
 *   sat looking perfectly normal.
 *
 *   First match wins. It walked the words of the meeting topic in order and
 *   took the first hit, so "Melissa Pike" matched on "melissa" and never
 *   looked at "pike", which is the word that would have told it apart.
 *
 * This scores every wedding against the whole topic instead, and refuses to
 * guess when the best answer is not clearly better than the second best. An
 * unmatched meeting is a visible gap. A misfiled one is a wrong answer wearing
 * a right answer's clothes, and nobody goes looking for it.
 *
 * Returns the reason and the runner-up as well as the id, so the decision can
 * be written next to the row and argued with later.
 */

/** Full name present in the topic. Two words that belong together. */
const W_FULL_NAME = 100;
/** Surname present, and no other wedding uses that surname. */
const W_UNIQUE_LAST = 60;
/** A given name from couple_names, e.g. "Daniel" out of "Daniel and Griffin". */
const W_COUPLE_TOKEN = 40;
/** First name only. Weak on purpose: this is the signal that used to misfile. */
const W_FIRST_NAME = 15;
/**
 * Speaker label from the transcript, used only when the topic says nothing.
 * Weighted like a unique surname rather than like a mention: a speaker label
 * means that person was on the call, which is better evidence than a word in a
 * title. Zoom names two of these meetings after the host's own room, so without
 * this they stay filed under nobody for ever.
 */
const W_SPEAKER = 60;

/** The wedding date turning up in the meeting, alongside a name. */
const W_DATE = 80;

/** Below this, we have not really found anything. */
const MIN_SCORE = 40;
/** The winner must beat the runner-up by this much, or it is a coin flip. */
const MIN_MARGIN = 20;

/**
 * A first name on its own never files a meeting, however high it scores.
 *
 * Scoring alone was not enough. Anne Throckmorton's planning meeting was filed
 * under Chris & Emily because that wedding has a family profile for Anne
 * Bradel, and "anne" was the only word either of them shared. 148 planning
 * notes went with it, including a critical potato allergy, onto a couple it had
 * nothing to do with.
 *
 * So the rule is a shape, not a total. One of these has to be true:
 *
 *   a first and last name together      "Melissa Pike"
 *   both halves of the couple           "Griffin and Daniel"
 *   a name plus the wedding date        "Anne, 10 October"
 *
 * Anything weaker is left unfiled on purpose. An unmatched meeting is a gap
 * somebody can see. A misfiled one reads as correct for ever.
 */
function isStrong(signals) {
  return signals.fullName || signals.coupleTokens >= 2 || (signals.anyName && signals.date);
}

const STOP_WORDS = new Set([
  'onboarding', 'initial', 'planning', 'meeting', 'call', 'zoom', 'phone',
  'minute', 'min', 'hour', 'hr', 'wedding', 'rixey', 'manor', 'team', 'and',
  'the', 'with', 'final', 'walkthrough', 'follow', 'up', 'chat', 'sync',
]);

function norm(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/[^a-z\s'-]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Split a couple_names field into the individual given names.
 *
 * The old version split on & and , only, so "Daniel and Griffin" came out as
 * the single token "daniel and griffin" and matched nothing. Every couple
 * stored with the word "and" was relying entirely on a profile row existing.
 */
export function coupleTokens(coupleNames) {
  return norm(coupleNames)
    .split(/\s*(?:&|,|\+|\band\b)\s*/)
    .map(s => s.trim())
    .filter(Boolean)
    .flatMap(part => part.split(' '))
    .filter(t => t.length > 2 && !STOP_WORDS.has(t));
}

/**
 * Distinct speaker labels from a Zoom VTT, i.e. the text before the colon on a
 * cue line. Only used as a fallback, and only the labels: a name mentioned in
 * passing during a meeting is not evidence of whose meeting it is.
 */
export function speakerNames(vtt) {
  const out = new Set();
  for (const line of String(vtt || '').split('\n')) {
    const m = line.match(/^([A-Za-z][A-Za-z '.-]{1,40}):\s/);
    if (m) out.add(norm(m[1]));
  }
  return [...out];
}

/**
 * Turn the weddings list into something scoreable.
 * Each entry keeps its own names rather than writing into a shared map, which
 * is the change that removes last-write-wins.
 */
export function buildDirectory(weddings) {
  const entries = (weddings || []).map(w => {
    const people = (w.profiles || [])
      .map(p => norm(p.name))
      .filter(Boolean)
      .map(full => {
        const parts = full.split(' ').filter(Boolean);
        return { full, first: parts[0] || '', last: parts.length > 1 ? parts[parts.length - 1] : '' };
      });
    return {
      weddingId: w.id,
      coupleNames: w.couple_names || '',
      weddingDate: w.wedding_date || null,
      people,
      tokens: coupleTokens(w.couple_names),
    };
  });

  // A surname is only good evidence if one wedding uses it.
  const lastCount = new Map();
  for (const e of entries) {
    for (const last of new Set(e.people.map(p => p.last).filter(Boolean))) {
      lastCount.set(last, (lastCount.get(last) || 0) + 1);
    }
  }
  for (const e of entries) e.uniqueLastNames = [...new Set(e.people.map(p => p.last))]
    .filter(l => l && lastCount.get(l) === 1);

  return entries;
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december'];

/**
 * Is this wedding's date spoken about in the meeting? Written several ways
 * because people say "October 10th", "the tenth of October" and "10/10".
 * Only ever counted alongside a name, so a stray "10/10" cannot file anything
 * on its own.
 */
export function mentionsWeddingDate(text, weddingDate) {
  if (!weddingDate || !text) return false;
  const d = new Date(`${weddingDate}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  const month = MONTHS[d.getUTCMonth()];
  const day = d.getUTCDate();
  const mNum = d.getUTCMonth() + 1;
  const yr = String(d.getUTCFullYear()).slice(2);
  // Not norm(): that strips digits for name matching, which turns "October
  // 10th" into "october th" and quietly makes this whole function useless.
  const hay = String(text).toLowerCase().replace(/[^a-z0-9/\s-]/g, ' ').replace(/\s+/g, ' ');
  const numeric = new RegExp(`\\b${mNum}\\s*[/-]\\s*${day}(\\s*[/-]\\s*(${yr}|${d.getUTCFullYear()}))?\\b`);
  return (
    new RegExp(`\\b${month}\\s+${day}(st|nd|rd|th)?\\b`).test(hay) ||
    new RegExp(`\\b${day}(st|nd|rd|th)?\\s+(of\\s+)?${month}\\b`).test(hay) ||
    new RegExp(`\\b${month.slice(0, 3)}\\s+${day}(st|nd|rd|th)?\\b`).test(hay) ||
    numeric.test(String(text).replace(/\s+/g, ' '))
  );
}

function scoreEntry(entry, topicText, topicWords, speakers, dateHaystack) {
  let score = 0;
  const why = [];
  const signals = { fullName: false, coupleTokens: 0, anyName: false, date: false };

  for (const p of entry.people) {
    if (p.full.includes(' ') && topicText.includes(p.full)) {
      score += W_FULL_NAME; why.push(`full name "${p.full}"`);
      signals.fullName = true; signals.anyName = true; continue;
    }
    if (p.first && p.last && topicWords.has(p.first) && topicWords.has(p.last)) {
      score += W_FULL_NAME; why.push(`"${p.first}" and "${p.last}"`);
      signals.fullName = true; signals.anyName = true; continue;
    }
    if (p.first && topicWords.has(p.first)) {
      score += W_FIRST_NAME; why.push(`first name "${p.first}"`); signals.anyName = true;
    }
  }

  for (const last of entry.uniqueLastNames) {
    if (topicWords.has(last)) {
      score += W_UNIQUE_LAST; why.push(`surname "${last}"`); signals.anyName = true;
    }
  }

  for (const t of entry.tokens) {
    if (topicWords.has(t)) {
      score += W_COUPLE_TOKEN; why.push(`couple name "${t}"`);
      signals.coupleTokens++; signals.anyName = true;
    }
  }

  // Only consult the transcript if the title told us nothing at all. Zoom's
  // default title is the host's own room name, which is how two meetings ended
  // up filed under nobody. A speaker label is proof of attendance, so a full
  // one counts as a full name.
  if (score === 0 && speakers.length) {
    for (const p of entry.people) {
      if (p.full && p.full.includes(' ') && speakers.includes(p.full)) {
        score += W_SPEAKER; why.push(`speaker "${p.full}"`);
        signals.fullName = true; signals.anyName = true;
      } else if (p.first && speakers.some(s => s.split(' ')[0] === p.first)) {
        score += W_FIRST_NAME; why.push(`speaker first name "${p.first}"`); signals.anyName = true;
      }
    }
  }

  if (signals.anyName && mentionsWeddingDate(dateHaystack, entry.weddingDate)) {
    score += W_DATE;
    why.push(`their wedding date (${entry.weddingDate})`);
    signals.date = true;
  }

  return { score, why, signals };
}

/**
 * @returns {{weddingId: string|null, confidence: number, reason: string, runnerUp: object|null}}
 */
export function matchMeeting(topic, directory, { transcript = '' } = {}) {
  const topicText = norm(topic);
  const topicWords = new Set(topicText.split(' ').filter(Boolean));
  const speakers = transcript ? speakerNames(transcript) : [];

  const scored = (directory || [])
    .map(e => ({ entry: e, ...scoreEntry(e, topicText, topicWords, speakers, `${topic || ''}\n${transcript}`) }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) {
    return { weddingId: null, confidence: 0, reason: 'no known name in the meeting title', runnerUp: null };
  }

  const best = scored[0];
  const second = scored[1] || null;
  const runnerUp = second
    ? { weddingId: second.entry.weddingId, coupleNames: second.entry.coupleNames, score: second.score }
    : null;

  if (!isStrong(best.signals)) {
    return {
      weddingId: null,
      confidence: best.score,
      reason: `not enough to be sure it is ${best.entry.coupleNames}: ${best.why.join(', ')}. `
        + 'Needs a first and last name, both partners, or a name with the wedding date.',
      runnerUp,
    };
  }

  if (best.score < MIN_SCORE) {
    return {
      weddingId: null,
      confidence: best.score,
      reason: `only a weak signal for ${best.entry.coupleNames} (${best.why.join(', ')})`,
      runnerUp,
    };
  }

  if (second && best.score - second.score < MIN_MARGIN) {
    return {
      weddingId: null,
      confidence: best.score,
      reason: `ambiguous between ${best.entry.coupleNames} and ${second.entry.coupleNames}`,
      runnerUp,
    };
  }

  return {
    weddingId: best.entry.weddingId,
    confidence: best.score,
    reason: `${best.entry.coupleNames} via ${best.why.join(', ')}`,
    runnerUp,
  };
}
