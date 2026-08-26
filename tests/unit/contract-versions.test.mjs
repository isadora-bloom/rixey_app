/**
 * The contract that counts is the one dated latest, not the one uploaded last.
 *
 * Run with: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  contractKey, isSameContractLine, byNewestFirst,
  currentAndHistory, groupByVendor, placeNewContract,
} from '../../shared/contract-versions.js';

const W = 'wedding-1';
const c = (o) => ({ wedding_id: W, ...o });

test('the same vendor spelled differently is one line', () => {
  assert.ok(isSameContractLine(
    c({ vendor_name: "Sammy's Rental" }),
    c({ vendor_name: 'Sammys Rentals LLC' }),
  ));
});

test('two vendors are not one line', () => {
  assert.ok(!isSameContractLine(
    c({ vendor_name: 'Serendipity Catering' }),
    c({ vendor_name: 'Ivett Beauty Co' }),
  ));
});

test('the same vendor on two weddings is two lines', () => {
  assert.ok(!isSameContractLine(
    { wedding_id: 'a', vendor_name: 'Sammys Rental' },
    { wedding_id: 'b', vendor_name: 'Sammys Rental' },
  ));
});

test('a contract with no vendor chains to nothing', () => {
  assert.equal(contractKey(c({ vendor_name: '' })), null);
  assert.equal(contractKey(c({ vendor_name: 'TBD' })), null);
  assert.ok(!isSameContractLine(c({ vendor_name: '' }), c({ vendor_name: '' })));
});

test('the date on the document beats the date it arrived', () => {
  // The revision was signed in March and uploaded in August. The scan of the
  // January original went up the same afternoon, an hour earlier.
  const march = c({ id: 'march', document_date: '2026-03-14', created_at: '2026-08-18T15:00:00Z' });
  const january = c({ id: 'january', document_date: '2026-01-02', created_at: '2026-08-18T14:00:00Z' });
  const { current, history } = currentAndHistory([january, march]);
  assert.equal(current.id, 'march');
  assert.equal(history[0].id, 'january');
});

test('a dated contract outranks an undated one whenever it arrived', () => {
  const dated = c({ id: 'dated', document_date: '2026-03-14', created_at: '2026-01-01T00:00:00Z' });
  const undated = c({ id: 'undated', document_date: null, created_at: '2026-09-01T00:00:00Z' });
  assert.equal(currentAndHistory([undated, dated]).current.id, 'dated');
});

test('with no dates at all, the newest arrival wins', () => {
  const older = c({ id: 'older', created_at: '2026-05-31T19:17:00Z' });
  const newer = c({ id: 'newer', created_at: '2026-05-31T19:18:00Z' });
  assert.equal(currentAndHistory([older, newer]).current.id, 'newer');
});

test('two documents dated the same day: the later upload is the revision', () => {
  const first = c({ id: 'first', document_date: '2026-03-14', created_at: '2026-03-14T09:00:00Z' });
  const second = c({ id: 'second', document_date: '2026-03-14', created_at: '2026-03-14T17:00:00Z' });
  assert.equal(currentAndHistory([first, second]).current.id, 'second');
});

test('a new contract supersedes the one it is newer than', () => {
  const existing = [c({ id: 'old', version: 1, document_date: '2026-01-02' })];
  const incoming = c({ id: 'new', document_date: '2026-03-14' });
  const placed = placeNewContract(incoming, existing);
  assert.equal(placed.version, 2);
  assert.equal(placed.supersedes, 'old');
  assert.equal(placed.alreadySuperseded, false);
});

test('uploading an old contract late does not displace the current one', () => {
  // This is the case that makes ordering by upload date wrong.
  const existing = [c({ id: 'march', version: 2, document_date: '2026-03-14' })];
  const incoming = c({ id: 'january-scan', document_date: '2026-01-02' });
  const placed = placeNewContract(incoming, existing);
  assert.equal(placed.supersedes, null);
  assert.equal(placed.alreadySuperseded, true);
  assert.equal(placed.supersededBy, 'march');
});

test('the first contract for a vendor is version one and replaces nothing', () => {
  const placed = placeNewContract(c({ id: 'only', document_date: '2026-03-14' }), []);
  assert.deepEqual(placed, { version: 1, supersedes: null, alreadySuperseded: false, supersededBy: null });
});

test('a wedding groups into one line per vendor', () => {
  const rows = [
    c({ id: 'a1', vendor_name: 'Serendipity Catering', document_date: '2026-01-10' }),
    c({ id: 'a2', vendor_name: 'Serendipity Catering LLC', document_date: '2026-08-25' }),
    c({ id: 'b1', vendor_name: 'Ivett Beauty Co', document_date: '2026-02-01' }),
    c({ id: 'loose', vendor_name: null, created_at: '2026-05-31T19:10:00Z' }),
  ];
  const lines = groupByVendor(rows);
  assert.equal(lines.length, 3);
  const catering = lines.find(l => l.current.id === 'a2');
  assert.ok(catering, 'the August version is the current catering contract');
  assert.equal(catering.history.length, 1);
  assert.equal(catering.history[0].id, 'a1');
  // The one with no vendor stays visible rather than folding into a chain.
  assert.ok(lines.some(l => l.current.id === 'loose'));
});

test('lines are ordered with the most recent contract first', () => {
  const rows = [
    c({ id: 'old', vendor_name: 'Alpha Florals', document_date: '2026-01-01' }),
    c({ id: 'new', vendor_name: 'Beta Cakes', document_date: '2026-07-01' }),
  ];
  assert.equal(groupByVendor(rows)[0].current.id, 'new');
});

test('sorting is stable enough to be used directly', () => {
  const rows = [
    c({ id: 'b', document_date: '2026-02-01' }),
    c({ id: 'c', document_date: '2026-03-01' }),
    c({ id: 'a', document_date: '2026-01-01' }),
  ];
  assert.deepEqual([...rows].sort(byNewestFirst).map(r => r.id), ['c', 'b', 'a']);
});

test('a ruled group is one line even under two trading names', () => {
  // Carpe Donut and Rodeo Catering are the same company, per Isadora. The
  // heuristic cannot know that, which is what RULINGS is for.
  assert.ok(isSameContractLine(
    c({ vendor_name: 'Carpe Donut' }),
    c({ vendor_name: 'Rodeo Catering' }),
  ));
});

test('a meaningful word in the name still separates two vendors', () => {
  // "Genesis" and "Genesis Catering" are not the same claim, and
  // shared/vendor-names.js keeps those words on purpose. A variant that really
  // is one vendor needs a ruling, not a looser key.
  assert.ok(!isSameContractLine(
    c({ vendor_name: 'Serendipity Catering' }),
    c({ vendor_name: 'Serendipity Catering & Design' }),
  ));
});
