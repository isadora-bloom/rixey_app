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
 * Open questions get their own treatment: they are never already in the portal,
 * they are the thing most likely to be forgotten, and they are aimed at the
 * venue rather than describing it. Filed as planning notes.
 */
function questionEntries(docRows) {
  return (docRows || []).filter(q => present(q.question)).map((q, i) => makeEntry({
    id: `doc:question:${i}`,
    section: 'Questions for the venue',
    field: q.topic || 'Question',
    sheetValue: q.question,
    portalValue: null,
    status: 'missing',
    applyOp: {
      type: 'insert',
      table: 'planning_notes',
      row: {
        category: 'follow_up',
        content: String(q.question).trim().slice(0, 1000),
        source_message: 'Open question from an uploaded planning document.',
        status: 'pending',
      },
    },
  }));
}

const BUILDERS = {
  dietary: dietaryEntries,
  vendors: vendorEntries,
  bedrooms: bedroomEntries,
  bar: barEntries,
  decor: decorEntries,
  questions: (rows) => questionEntries(rows),
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
