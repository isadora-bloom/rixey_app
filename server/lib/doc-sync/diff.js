/**
 * Comparing what a document says against what the portal holds.
 *
 * Deliberately built on sheet-diff's DiffEntry and apply ops rather than a new
 * vocabulary. Sheet Sync already answers this exact question for Google Sheets
 * and its review grid, apply executor and audit log all work in those terms;
 * a parallel set would mean two review screens and two ways to be wrong.
 *
 * The bias throughout is towards showing less. Alyssa & Brett's plan yields
 * over ninety extracted rows and their portal already agrees with almost all
 * of them. What is worth a person's attention is the handful missing or in
 * conflict — everything else is noise that makes the useful rows harder to
 * see.
 *
 * Nothing here writes. It produces entries; applyChoices does the writing,
 * and only for entries a human accepted.
 */

import { makeEntry } from '../sheet-diff/types.js';

const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const present = v => v !== null && v !== undefined && String(v).trim() !== '';

// Words that carry no meaning when comparing two ways of writing the same
// answer, plus spellings the two sources genuinely differ on.
const NOISE = new Set(['and', 'or', 'the', 'a', 'no', 'of', 'with', 'plus', 'allergic', 'to', 'allergy', 'free']);
const SYNONYM = new Map([
  ['celiac', 'gluten'], ['celiacs', 'gluten'], ['coeliac', 'gluten'], ['glutenfree', 'gluten'],
  ['treenuts', 'nuts'], ['treenut', 'nuts'], ['nut', 'nuts'], ['peanut', 'peanuts'],
  ['shellfish', 'shellfish'], ['seafood', 'shellfish'], ['dairy', 'lactose'],
  ['vegetarian', 'meat'], ['pescatarian', 'meat'],
]);

function tokens(s) {
  return norm(s)
    .split(' ')
    .map(t => t.replace(/s$/, '') + '')          // crude singular
    .map(t => SYNONYM.get(t) || SYNONYM.get(t + 's') || t)
    .filter(t => t.length > 1 && !NOISE.has(t));
}

/**
 * Loose equality for prose written twice by different people.
 *
 * A document saying "peanuts and treenuts" and a portal saying "Peanuts, tree
 * nuts" are the same fact, and reporting that as a conflict costs a person a
 * decision for nothing. Worse, a list full of false conflicts is how the two
 * real ones stop being noticed.
 *
 * Compared as overlapping sets of meaningful words rather than as strings, so
 * word order, punctuation, joining words and singular/plural stop mattering.
 * Deliberately generous: the cost of calling a genuine difference "agree" is
 * that it stays as it was, which is the status quo. The cost of the reverse is
 * an alert nobody trusts.
 */
function sameish(a, b) {
  const x = tokens(a), y = tokens(b);
  if (!x.length || !y.length) return false;
  const setY = new Set(y);
  const shared = x.filter(t => setY.has(t)).length;
  const overlap = shared / Math.min(x.length, y.length);
  return overlap >= 0.6;
}

/**
 * People are matched by name, and only by name.
 *
 * Everything else about a person differs between a planner's document and the
 * portal, so the name is the only stable key. Where a name matches, values are
 * compared; where it does not, the row is treated as missing rather than
 * guessed at, because merging two people is worse than listing one twice.
 */
function findByName(rows, name, field) {
  const target = norm(name);
  if (!target) return null;
  return (rows || []).find(r => norm(r[field]) === target) || null;
}

function dietaryEntries(docRows, portal) {
  const existing = portal.allergy_registry || [];
  return (docRows || []).filter(d => present(d.guest_name) && present(d.allergy)).map((d, i) => {
    const match = findByName(existing, d.guest_name, 'guest_name');
    const docValue = [d.allergy, d.severity].filter(Boolean).join(' — ');
    const portalValue = match ? [match.allergy, match.severity].filter(Boolean).join(' — ') : null;

    const status = !match ? 'missing' : (sameish(match.allergy, d.allergy) ? 'agree' : 'conflict');
    return makeEntry({
      id: `doc:dietary:${norm(d.guest_name) || i}`,
      section: 'Dietary & Allergies',
      field: d.guest_name,
      sheetValue: docValue,
      portalValue,
      status,
      notes: !d.severity && !match ? 'Severity not stated in the document — confirm before telling the caterer.' : undefined,
      applyOp: !match
        ? {
            type: 'insert',
            table: 'allergy_registry',
            row: {
              guest_name: String(d.guest_name).trim().slice(0, 120),
              allergy: String(d.allergy).trim().slice(0, 300),
              severity: ['Mild', 'Moderate', 'Severe / Anaphylactic'].includes(d.severity) ? d.severity : null,
              notes: [d.notes, 'From an uploaded planning document.'].filter(Boolean).join(' ').slice(0, 500),
              caterer_alerted: false,
              staying_overnight: false,
            },
          }
        : {
            type: 'patch',
            table: 'allergy_registry',
            match: { id: match.id },
            patch: { allergy: String(d.allergy).trim().slice(0, 300) },
          },
    });
  });
}

function vendorEntries(docRows, portal) {
  const existing = portal.vendor_checklist || [];
  return (docRows || []).filter(v => present(v.vendor_name) || present(v.vendor_type)).map((v, i) => {
    // Vendors match on company name first, then on type, because a plan often
    // names the florist without repeating that they are the florist.
    const match = findByName(existing, v.vendor_name, 'vendor_name')
      || (present(v.vendor_type) ? findByName(existing, v.vendor_type, 'vendor_type') : null);
    const docValue = [v.vendor_name, v.vendor_contact].filter(Boolean).join(' — ');
    const portalValue = match ? [match.vendor_name, match.vendor_contact].filter(Boolean).join(' — ') : null;

    let status = 'missing';
    if (match) {
      const nameAgrees = sameish(match.vendor_name, v.vendor_name);
      const hasNewContact = present(v.vendor_contact) && !present(match.vendor_contact);
      // A contact the portal is missing is the most common useful find here,
      // and it is a gap rather than a disagreement.
      status = hasNewContact ? 'missing' : (nameAgrees ? 'agree' : 'conflict');
    }

    return makeEntry({
      id: `doc:vendor:${norm(v.vendor_name || v.vendor_type) || i}`,
      section: 'Vendors',
      // Says what is actually missing. A row reading "Caterer — missing" when
      // the portal already has the caterer and only lacks a phone number is
      // needlessly alarming.
      field: (match && present(v.vendor_contact) && !present(match.vendor_contact))
        ? `${v.vendor_type || v.vendor_name} — contact details`
        : (v.vendor_type || v.vendor_name),
      sheetValue: docValue,
      portalValue,
      status,
      notes: match && present(v.vendor_contact) && !present(match.vendor_contact)
        ? 'Portal has this vendor but no contact details.' : undefined,
      applyOp: !match
        ? {
            type: 'insert',
            table: 'vendor_checklist',
            row: {
              vendor_type: String(v.vendor_type || 'Other').trim().slice(0, 80),
              vendor_name: v.vendor_name ? String(v.vendor_name).trim().slice(0, 160) : null,
              vendor_contact: v.vendor_contact ? String(v.vendor_contact).trim().slice(0, 240) : null,
              notes: [v.notes, 'From an uploaded planning document.'].filter(Boolean).join(' ').slice(0, 500),
              is_booked: false,
            },
          }
        : {
            type: 'patch',
            table: 'vendor_checklist',
            match: { id: match.id },
            // Only ever fills a blank. A contact someone typed by hand beats
            // one a model read off a PDF, so an existing value is never
            // overwritten from here.
            patch: present(v.vendor_contact) && !present(match.vendor_contact)
              ? { vendor_contact: String(v.vendor_contact).trim().slice(0, 240) }
              : {},
          },
    });
  }).filter(e => e.status !== 'agree' || true);
}

function bedroomEntries(docRows, portal) {
  const existing = portal.bedroom_assignments || [];
  return (docRows || []).filter(b => present(b.room_name) && present(b.occupants)).map((b, i) => {
    const match = findByName(existing, b.room_name, 'room_name');
    const portalValue = match ? [match.guest_friday, match.guest_saturday].filter(Boolean).join(' / ') : null;
    const status = !match ? 'missing'
      : (sameish(portalValue, b.occupants) ? 'agree' : 'conflict');
    return makeEntry({
      id: `doc:bedroom:${norm(b.room_name) || i}`,
      section: 'Bedrooms',
      field: b.room_name,
      sheetValue: b.occupants,
      portalValue,
      status,
      // Bedrooms are per-night in the portal and usually not in a document, so
      // this proposes nothing automatic and leaves it to a person.
      notes: 'Portal stores Friday and Saturday separately; set the right night by hand.',
      applyOp: { type: 'noop' },
    });
  });
}

function barEntries(docRows, portal) {
  const existing = portal.bar_shopping_list || [];
  return (docRows || []).filter(b => present(b.item_name)).map((b, i) => {
    const match = findByName(existing, b.item_name, 'item_name');
    return makeEntry({
      id: `doc:bar:${norm(b.item_name) || i}`,
      section: 'Bar',
      field: b.item_name,
      sheetValue: [b.quantity, b.unit].filter(Boolean).join(' ') || b.notes || 'listed',
      portalValue: match ? [match.quantity, match.unit].filter(Boolean).join(' ') || 'on list' : null,
      status: match ? 'agree' : 'missing',
      applyOp: match ? { type: 'noop' } : {
        type: 'insert',
        table: 'bar_shopping_list',
        row: {
          item_name: String(b.item_name).trim().slice(0, 200),
          quantity: b.quantity ? String(b.quantity).slice(0, 40) : null,
          unit: b.unit ? String(b.unit).slice(0, 40) : null,
          category: 'other',
          notes: [b.notes, 'From an uploaded planning document.'].filter(Boolean).join(' ').slice(0, 500),
          checked: false,
          from_calculator: false,
        },
      },
    });
  });
}

function decorEntries(docRows, portal) {
  const existing = portal.decor_inventory || [];
  return (docRows || []).filter(d => present(d.item_name)).map((d, i) => {
    const match = findByName(existing, d.item_name, 'item_name');
    return makeEntry({
      id: `doc:decor:${norm(d.item_name) || i}`,
      section: 'Decor',
      field: d.item_name,
      sheetValue: [d.space_name, d.source].filter(Boolean).join(' — ') || 'listed',
      portalValue: match ? [match.space_name, match.source].filter(Boolean).join(' — ') || 'on list' : null,
      status: match ? 'agree' : 'missing',
      applyOp: match ? { type: 'noop' } : {
        type: 'insert',
        table: 'decor_inventory',
        row: {
          item_name: String(d.item_name).trim().slice(0, 200),
          space_name: d.space_name ? String(d.space_name).trim().slice(0, 120) : 'Unassigned',
          source: d.source ? String(d.source).trim().slice(0, 120) : null,
          notes: [d.notes, 'From an uploaded planning document.'].filter(Boolean).join(' ').slice(0, 500),
          leaving_it: false,
        },
      },
    });
  });
}

/**
 * Has this exact thing already been imported?
 *
 * Everything that files into planning_notes or planning_checklist used to be
 * reported as `missing` unconditionally, because those two tables were not in
 * the portal snapshot and so there was nothing to compare against. That is not
 * a cosmetic gap. The panel pre-ticks whatever is missing, so after a successful
 * import the same rows came back missing, got re-ticked, and the button offered
 * the same count again as though nothing had happened. Pressing it a second time
 * inserted the lot a second time: 396 document notes in the database, 184
 * distinct, 212 of them surplus, several imported three times over.
 *
 * Compared on the exact content the applyOp would write, so the check and the
 * write cannot disagree about what "the same" means.
 */
function alreadyThere(portal, table, value) {
  const rows = portal?.[table];
  if (!Array.isArray(rows) || !rows.length) return false;
  const field = table === 'planning_checklist' ? 'task_text' : 'content';
  const target = String(value ?? '').trim();
  if (!target) return false;
  return rows.some(r => String(r?.[field] ?? '').trim() === target);
}

/**
 * Open questions get their own treatment: they are the thing most likely to be
 * forgotten, and they are aimed at the venue rather than describing it. Filed as
 * planning notes.
 */
function questionEntries(docRows, portal) {
  return (docRows || []).filter(q => present(q.question)).map((q, i) => {
    const content = String(q.question).trim().slice(0, 1000);
    const imported = alreadyThere(portal, 'planning_notes', content);
    return makeEntry({
      id: `doc:question:${i}`,
      section: 'Questions for the venue',
      field: q.topic || 'Question',
      sheetValue: q.question,
      portalValue: imported ? content : null,
      status: imported ? 'agree' : 'missing',
      notes: imported ? 'Already imported.' : undefined,
      applyOp: imported ? { type: 'noop' } : {
        type: 'insert',
        table: 'planning_notes',
        row: {
          category: 'follow_up',
          content,
          source_message: 'Open question from an uploaded planning document.',
          status: 'pending',
        },
      },
    });
  });
}

/**
 * Guests, which is usually the biggest thing in one of these files and the
 * most delicate to import.
 *
 * Entries are frequently written surname-first and often name two people:
 * "Ashby, Brooke and McClanahan, Cole" with a count of 2. Splitting that into
 * a first and last name is guesswork — is "Ashby" a surname or a first name?
 * are these two guests or a couple? — so nothing here splits anything. The
 * whole string goes in first_name, the count is reported, and a person
 * decides. Getting a guest's name wrong is how a place card ends up misspelt.
 *
 * A plus one is never inferred. Party size is shown so a human can act on it;
 * it does not create a second person, because the couple has not said who that
 * person is. Same rule as everywhere else in this codebase.
 */
function guestEntries(docRows, portal) {
  const existing = portal.wedding_guests || [];
  const known = new Set(existing.map(g => norm(`${g.first_name || ''} ${g.last_name || ''}`)));
  // Also index by surname-first, since a document may write "Ayala, Audrey"
  // for a guest the portal holds as "Audrey Ayala".
  const flipped = new Set(existing.map(g => norm(`${g.last_name || ''} ${g.first_name || ''}`)));

  return (docRows || []).filter(g => present(g.name)).map((g, i) => {
    const name = String(g.name).trim();
    const n = norm(name);
    const nFlipped = norm(name.split(',').reverse().join(' '));
    const match = known.has(n) || known.has(nFlipped) || flipped.has(n);
    const size = Number.isFinite(+g.party_size) ? Math.max(1, Math.round(+g.party_size)) : null;

    return makeEntry({
      id: `doc:guest:${n || i}`,
      section: 'Guest list',
      field: name,
      sheetValue: [size ? `${size} ${size === 1 ? 'person' : 'people'}` : null, g.category, g.rsvp ? `RSVP ${g.rsvp}` : null]
        .filter(Boolean).join(' · ') || 'listed',
      portalValue: match ? 'already on the guest list' : null,
      status: match ? 'agree' : 'missing',
      notes: !match && size > 1
        ? `Listed as ${size} people in one entry. Imported as one row — split it, or add the second person as a plus one, by hand.`
        : undefined,
      applyOp: match ? { type: 'noop' } : {
        type: 'insert',
        table: 'wedding_guests',
        row: {
          // Taken whole. Nothing here guesses which part is the surname.
          first_name: name.slice(0, 120),
          last_name: null,
          address: g.address ? String(g.address).slice(0, 300) : null,
          rsvp: ['yes', 'no', 'maybe'].includes(String(g.rsvp || '').toLowerCase()) ? String(g.rsvp).toLowerCase() : 'pending',
          notes: [g.category ? `Category: ${g.category}` : null, size > 1 ? `Listed as ${size} people` : null, 'From an uploaded planning document.']
            .filter(Boolean).join(' '),
          tags: [],
        },
      },
    });
  });
}

/** Table assignments. Only ever offered for guests the portal already knows. */
function seatingEntries(docRows, portal) {
  const existing = portal.wedding_guests || [];
  const byName = new Map();
  for (const g of existing) {
    byName.set(norm(`${g.first_name || ''} ${g.last_name || ''}`), g);
    byName.set(norm(`${g.last_name || ''} ${g.first_name || ''}`), g);
  }

  return (docRows || []).filter(s => present(s.guest_name) && present(s.table_name)).map((s, i) => {
    const n = norm(s.guest_name);
    const match = byName.get(n) || byName.get(norm(String(s.guest_name).split(',').reverse().join(' ')));
    const table = String(s.table_name).trim().slice(0, 120);

    return makeEntry({
      id: `doc:seating:${n || i}`,
      section: 'Seating',
      field: s.guest_name,
      sheetValue: table,
      portalValue: match?.table_assignment || (match ? 'no table set' : null),
      status: !match ? 'sheet-only'
        : (sameish(match.table_assignment, table) ? 'agree' : (match.table_assignment ? 'conflict' : 'missing')),
      notes: !match ? 'Not on the guest list yet — add them first, then this can be seated.' : undefined,
      applyOp: !match ? { type: 'noop' } : {
        type: 'patch',
        table: 'wedding_guests',
        match: { id: match.id },
        patch: { table_assignment: table },
      },
    });
  });
}

function hairMakeupEntries(docRows, portal) {
  const existing = portal.makeup_schedule || [];
  return (docRows || []).filter(h => present(h.person)).map((h, i) => {
    const match = findByName(existing, h.person, 'participant_name');
    const when = [h.service, h.time].filter(Boolean).join(' at ');
    return makeEntry({
      id: `doc:hair:${norm(h.person)}:${norm(h.service) || i}`,
      section: 'Hair & Makeup',
      field: `${h.person}${h.service ? ` — ${h.service}` : ''}`,
      sheetValue: when || 'listed',
      portalValue: match ? [match.hair_start_time, match.makeup_start_time].filter(Boolean).join(' / ') || 'on the schedule' : null,
      status: match ? 'agree' : 'missing',
      applyOp: match ? { type: 'noop' } : {
        type: 'insert',
        table: 'makeup_schedule',
        row: {
          participant_name: String(h.person).trim().slice(0, 120),
          // The portal keeps hair and makeup as separate times on one row; a
          // document usually lists them as separate appointments.
          hair_start_time: /hair/i.test(h.service || '') ? (h.time || null) : null,
          makeup_start_time: /makeup|mua/i.test(h.service || '') ? (h.time || null) : null,
          notes: [h.stylist ? `With ${h.stylist}` : null, 'From an uploaded planning document.'].filter(Boolean).join(' '),
        },
      },
    });
  });
}

/**
 * Everything the portal has no column for.
 *
 * Payments, music, favours, parking, gifts, shower plans. A planning document
 * is the couple telling the venue everything they know, and a fact with no
 * home is still a fact — dropping it because there is no field for it is the
 * one outcome that is never acceptable. These land in planning_notes, which is
 * where every other unstructured signal in this system already goes.
 */
/**
 * The heading the document used, turned into the category the portal uses.
 *
 * Everything from this section used to be filed as plain `note`. Alyssa &
 * Brett's plan put 106 facts through here in one go: 33 timeline entries, 20
 * contract terms, 15 wedding party roles, 10 to-dos, the key contact list. All
 * of it landed as one undifferentiated pile, so the timeline was not a
 * timeline and the to-dos were not to-dos, and finding any of it again meant
 * reading all of it.
 *
 * The headings are the couple's own words, so match loosely and fall back to
 * `note` rather than forcing a bad fit.
 */
const HEADING_CATEGORIES = [
  [/timeline|schedule|itinerary|run.?of.?show|day.?of/i, 'timeline'],
  [/to.?do|action|task|outstanding|follow.?up|homework/i, 'follow_up'],
  [/contract|agreement|terms|policy|policies|insurance|liabilit/i, 'contract'],
  [/contact|phone|email|who.?to.?call/i, 'contact'],
  [/payment|deposit|invoice|budget|cost|balance|owe/i, 'budget'],
  [/vendor|supplier|caterer|florist|photograph|videograph|dj|band|officiant/i, 'vendor'],
  [/bar|alcohol|drink|beer|wine|cocktail|liquor/i, 'bar'],
  [/food|menu|catering|tasting|dietary|allerg/i, 'catering'],
  [/decor|flower|floral|centerpiece|linen|candle|arch|arbor/i, 'decor'],
  [/ceremony|processional|vows|aisle|officiat/i, 'ceremony'],
  [/reception|dinner|dance|first.?dance|cake|send.?off|toast|speech/i, 'reception'],
  [/room|bedroom|hotel|accommodation|lodging|check.?in|check.?out/i, 'accommodations'],
  [/shuttle|transport|bus|parking|arrival|departure/i, 'shuttle'],
  [/guest|rsvp|headcount|attendance/i, 'guest_count'],
  [/wedding party|bridal party|groomsm|bridesmaid|roles|attendant/i, 'wedding_party'],
  [/music|playlist|song|dj|band/i, 'music'],
  [/rental|supplies|equipment|hire/i, 'rentals'],
  [/photo|video|shot list|first look/i, 'photography'],
  [/family|parent|mother|father|grandparent/i, 'family'],
];

export function categoryForHeading(heading) {
  const h = String(heading || '');
  if (!h.trim()) return 'note';
  for (const [re, cat] of HEADING_CATEGORIES) if (re.test(h)) return cat;
  return 'note';
}

/** A to-do out of a document is a to-do, not a note about a to-do. */
function looksLikeTask(heading) {
  return /to.?do|action item|task|homework|outstanding/i.test(String(heading || ''));
}

function otherEntries(docRows, portal) {
  return (docRows || []).filter(o => present(o.detail)).map((o, i) => {
    const detail = String(o.detail).trim();
    const category = categoryForHeading(o.heading);
    const isTask = looksLikeTask(o.heading);

    // Ten to-dos out of Alyssa & Brett's plan became ten notes nobody could
    // tick off. The checklist is right there.
    const table = isTask ? 'planning_checklist' : 'planning_notes';
    const value = isTask
      ? detail.slice(0, 500)
      : `${o.heading ? `${o.heading}: ` : ''}${detail}`.slice(0, 1000);
    const imported = alreadyThere(portal, table, value);

    const applyOp = imported ? { type: 'noop' } : isTask
      ? {
          type: 'insert',
          table: 'planning_checklist',
          // Columns checked against the real table: is_completed, not
          // is_complete, and there is no notes column to put the provenance in.
          row: {
            task_text: value,
            category: 'Other',
            is_completed: false,
            is_custom: true,
          },
        }
      : {
          type: 'insert',
          table: 'planning_notes',
          row: {
            category,
            content: value,
            source_message: 'From an uploaded planning document.',
            status: 'pending',
          },
        };

    return makeEntry({
      id: `doc:other:${norm(o.heading) || 'note'}:${i}`,
      section: o.heading ? `Other — ${o.heading}` : 'Other',
      field: o.heading || 'Note',
      sheetValue: o.detail,
      portalValue: imported ? value : null,
      status: imported ? 'agree' : 'missing',
      notes: imported
        ? (isTask ? 'Already on the checklist.' : 'Already imported.')
        : isTask
          ? 'Files as a to-do on the checklist.'
          : (category !== 'note' ? `Files as a ${category.replace(/_/g, ' ')} note.` : undefined),
      applyOp,
    });
  });
}

const BUILDERS = {
  dietary: dietaryEntries,
  vendors: vendorEntries,
  bedrooms: bedroomEntries,
  bar: barEntries,
  decor: decorEntries,
  guests: guestEntries,
  seating: seatingEntries,
  hair_makeup: hairMakeupEntries,
  questions: (rows) => questionEntries(rows),
  other: (rows) => otherEntries(rows),
};

/**
 * @returns {{ entries: DiffEntry[], counts: object }}
 */
export function buildDocumentDiff({ sections, portal }) {
  const entries = [];
  for (const [key, build] of Object.entries(BUILDERS)) {
    if (!sections?.[key]) continue;
    try {
      entries.push(...build(sections[key], portal || {}));
    } catch (err) {
      console.error(`[doc-sync] ${key} diff failed:`, err.message);
    }
  }
  const counts = entries.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {});
  counts.total = entries.length;
  counts.actionable = entries.filter(e => e.status === 'missing' || e.status === 'conflict').length;
  return { entries, counts };
}

/**
 * What changed between two reads of the same document.
 *
 * Re-uploading a revised plan should say what the planner altered, which is a
 * different question from what differs from the portal. Compared on the
 * extracted sections rather than the raw text, so a reflowed page or a new
 * footer does not read as a change.
 */
export function diffSections(previous, current) {
  const changes = [];
  const keys = new Set([...Object.keys(previous || {}), ...Object.keys(current || {})]);
  for (const key of keys) {
    const before = new Map((previous?.[key] || []).map(r => [JSON.stringify(r).toLowerCase(), r]));
    const after = new Map((current?.[key] || []).map(r => [JSON.stringify(r).toLowerCase(), r]));
    for (const [k, row] of after) if (!before.has(k)) changes.push({ key, type: 'added', row });
    for (const [k, row] of before) if (!after.has(k)) changes.push({ key, type: 'removed', row });
  }
  return changes;
}
