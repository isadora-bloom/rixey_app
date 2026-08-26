/**
 * Which contract is the one that counts.
 *
 * A vendor sends a contract, then sends a revised one, then somebody scans the
 * original and uploads that too. All three land in `contracts` and until now
 * all three were equally true. Sage reads them all into her context when she is
 * asked about catering, and the vendor screen showed whichever sorted first.
 *
 * The rule is the date on the document, not the date it arrived. Those come
 * apart constantly: a caterer's final version is dated in March and gets
 * uploaded in August, while a scan of the January original goes up the same
 * afternoon. Sort on arrival and January wins, and the screen shows terms
 * nobody is working to any more.
 *
 * Arrival is the fallback and only the fallback, for the documents with no
 * readable date on them.
 */

import { vendorKey, isPlaceholderName, ruledGroup } from './vendor-names.js';

/**
 * What two contracts have to share to be versions of one another: the wedding
 * and the vendor. Filename is not it. "Catering Contract.pdf" and "Banquet
 * Event Order - Serendipity_original (1).pdf" are the same agreement, and two
 * vendors both sending "Contract.pdf" are not.
 *
 * A contract with no vendor on it chains to nothing. Guessing there would merge
 * a florist into a caterer, and a stray extra row is a far cheaper mistake than
 * a hidden one.
 */
export function contractKey(contract) {
  const name = contract?.vendor_name || '';
  // vendorKey, not the raw name: it drops the noise words and the plurals, so
  // "Sammy's Rental" and "Sammys Rentals LLC" are one line. isPlaceholderName
  // keeps "TBD" and "Caterer" from collapsing four vendors into one.
  if (!String(name).trim() || isPlaceholderName(name)) return null;
  // A ruling beats the heuristic, the same way isSameVendor lets it. Carpe
  // Donut and Rodeo Catering are one company and their contracts are one line.
  const key = ruledGroup(name) || vendorKey(name);
  if (!key) return null;
  return `${contract.wedding_id || ''}::${key}`;
}

/** Same wedding, same vendor, and both actually name a vendor. */
export function isSameContractLine(a, b) {
  const ka = contractKey(a);
  return ka !== null && ka === contractKey(b);
}

/**
 * When this document is from, as a sortable string.
 *
 * `document_date` is what was printed on it. `created_at` is when it reached
 * us. Documents that have a real date always sort above documents that only
 * have an arrival, because a dated contract is better evidence than an undated
 * one whatever day it turned up.
 */
export function contractWhen(contract) {
  const doc = String(contract?.document_date || '').slice(0, 10);
  if (doc) return `1:${doc}`;
  return `0:${String(contract?.created_at || '').slice(0, 10)}`;
}

/** Newest first, by the date on the document. */
export function byNewestFirst(a, b) {
  const cmp = contractWhen(b).localeCompare(contractWhen(a));
  if (cmp !== 0) return cmp;
  // Two documents dated the same day: the one that arrived later is the
  // revision. This is the only place arrival is allowed to break a tie.
  return String(b?.created_at || '').localeCompare(String(a?.created_at || ''));
}

/**
 * The current contract out of a set, and everything it replaced.
 *
 * Takes every contract for one vendor on one wedding. Returns the one that
 * counts and the rest in the order they stopped counting, so a screen can show
 * one line with "two earlier versions" under it.
 */
export function currentAndHistory(contracts) {
  const sorted = [...(contracts || [])].sort(byNewestFirst);
  return { current: sorted[0] || null, history: sorted.slice(1) };
}

/**
 * Group a wedding's contracts into one line per vendor.
 *
 * Anything with no vendor on it cannot be grouped and is returned as a line of
 * its own, current by definition. That is most of the older rows, which were
 * filed before there was a vendor column, and they should stay visible rather
 * than being quietly folded into somebody else's chain.
 */
export function groupByVendor(contracts) {
  const lines = new Map();
  const loose = [];

  for (const c of contracts || []) {
    const key = contractKey(c);
    if (key === null) { loose.push(c); continue; }
    if (!lines.has(key)) lines.set(key, []);
    lines.get(key).push(c);
  }

  const grouped = [...lines.values()].map(group => ({
    vendor_name: group[0].vendor_name,
    ...currentAndHistory(group),
  }));

  for (const c of loose) {
    grouped.push({ vendor_name: c.vendor_name || null, current: c, history: [] });
  }

  grouped.sort((a, b) => byNewestFirst(a.current, b.current));
  return grouped;
}

/**
 * Where a new contract slots into an existing chain.
 *
 * Usually it is the newest and supersedes what was there. Sometimes it is not:
 * uploading a scan of the original January agreement in August must not
 * supersede March's revision. So this returns what the new document replaces,
 * or tells the caller that the new one is itself already out of date.
 *
 * `existing` is every contract already on file for that wedding and vendor.
 */
export function placeNewContract(incoming, existing) {
  const others = (existing || []).filter(c => c.id !== incoming?.id);
  if (!others.length) return { version: 1, supersedes: null, alreadySuperseded: false, supersededBy: null };

  const { current } = currentAndHistory(others);
  const incomingIsNewer = byNewestFirst(incoming, current) < 0;

  if (!incomingIsNewer) {
    // An older document arriving late. It joins the history rather than
    // displacing anything, and the screen goes on showing the March revision.
    return {
      version: current.version || others.length,
      supersedes: null,
      alreadySuperseded: true,
      supersededBy: current.id,
    };
  }

  return {
    version: (current.version || others.length) + 1,
    supersedes: current.id,
    alreadySuperseded: false,
    supersededBy: null,
  };
}
