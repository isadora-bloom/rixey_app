/**
 * What to call a wedding.
 *
 * There are three places a name can live, and picking only one of them is how
 * Anisa & Austin and Megan and Robert showed as "Unknown Couple" for twelve
 * messages despite both being live weddings. The order is deliberate:
 * project_name (what Rixey chose to call the workspace) beats couple_names
 * (what the couple are called) beats the partner names assembled together.
 *
 * Run with: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weddingName, coupleName } from '../../shared/wedding-name.js';

test('weddingName prefers the project name above everything else', () => {
  assert.equal(weddingName({ project_name: 'The Alexander Wedding', couple_names: 'Sarah & Tom' }), 'The Alexander Wedding');
});

test('weddingName falls back to couple_names when there is no project name', () => {
  assert.equal(weddingName({ couple_names: 'Sarah & Tom', partner1_name: 'Sarah', partner2_name: 'Tom' }), 'Sarah & Tom');
});

test('weddingName assembles the partner names when neither of the above is set', () => {
  assert.equal(weddingName({ partner1_name: 'Sarah', partner2_name: 'Tom' }), 'Sarah and Tom');
});

test('weddingName uses whichever single partner name is there', () => {
  assert.equal(weddingName({ partner1_name: 'Sarah' }), 'Sarah');
});

test('weddingName falls back to the wedding date, which at least identifies it', () => {
  assert.equal(weddingName({ wedding_date: '2026-10-10' }), 'Wedding on 2026-10-10');
});

test('weddingName falls back to "Unknown" only when there is truly nothing', () => {
  assert.equal(weddingName({}), 'Unknown');
});

test('weddingName treats whitespace-only fields as unset', () => {
  assert.equal(weddingName({ project_name: '   ', couple_names: 'Sarah & Tom' }), 'Sarah & Tom');
});

test('weddingName on a missing wedding uses the fallback', () => {
  assert.equal(weddingName(null), 'Unknown');
  assert.equal(weddingName(null, 'no wedding'), 'no wedding');
});

test('coupleName is the couple\'s own name, never the workspace label', () => {
  assert.equal(coupleName({ project_name: 'The Alexander Wedding', couple_names: 'Sarah & Tom' }), 'Sarah & Tom');
});

test('coupleName assembles the partner names when there is no couple_names', () => {
  assert.equal(coupleName({ partner1_name: 'Sarah', partner2_name: 'Tom' }), 'Sarah and Tom');
});

test('coupleName falls back to "you" for something shown straight to the couple', () => {
  assert.equal(coupleName({}), 'you');
});

test('coupleName on a missing wedding uses the fallback', () => {
  assert.equal(coupleName(null), 'you');
  assert.equal(coupleName(null, 'there'), 'there');
});
