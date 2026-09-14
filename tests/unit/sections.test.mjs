import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SECTIONS,
  GROUP_ORDER,
  sectionsFor,
  sectionByKey,
  resolveSectionKey,
  FINALISABLE_KEYS,
} from '../../shared/sections.js';

test('old keys resolve to the section they became', () => {
  // These are the ones that were actually different on the two sides, and the
  // ones that will keep arriving in links, in focusTab and in stored
  // section_finalisations rows for as long as those rows exist.
  assert.equal(resolveSectionKey('vendor'), 'vendors');
  assert.equal(resolveSectionKey('preferred-vendors'), 'vendor-directory');
  assert.equal(resolveSectionKey('guestcare'), 'guest-care');
  assert.equal(resolveSectionKey('photos'), 'photo-library');
  assert.equal(resolveSectionKey('direct-messages'), 'inbox');
  assert.equal(resolveSectionKey('messages'), 'conversations');
});

test('a current key resolves to itself', () => {
  for (const section of SECTIONS) {
    assert.equal(resolveSectionKey(section.key), section.key);
  }
});

test('anything else is null, not a guess', () => {
  assert.equal(resolveSectionKey('nonsense'), null);
  assert.equal(resolveSectionKey(''), null);
  assert.equal(resolveSectionKey(null), null);
  assert.equal(resolveSectionKey(undefined), null);
  assert.equal(resolveSectionKey(42), null);
  // Prototype keys are not sections either.
  assert.equal(resolveSectionKey('toString'), null);
  assert.equal(resolveSectionKey('constructor'), null);
});

test('no key is used twice, and no alias collides with a key', () => {
  const seen = new Set();
  for (const section of SECTIONS) {
    assert.ok(!seen.has(section.key), `duplicate key ${section.key}`);
    seen.add(section.key);
  }
  for (const section of SECTIONS) {
    for (const alias of section.aliases || []) {
      assert.ok(!seen.has(alias), `alias ${alias} is also a section key`);
      assert.equal(resolveSectionKey(alias), section.key);
    }
  }
});

test('every section has a label, an icon, a group and a side', () => {
  for (const section of SECTIONS) {
    assert.ok(section.label, `${section.key} has no label`);
    assert.ok(section.icon, `${section.key} has no icon`);
    assert.ok(GROUP_ORDER.includes(section.group), `${section.key} is in an unlisted group`);
    assert.ok(section.sides.length > 0, `${section.key} claims no side`);
    for (const side of section.sides) {
      assert.ok(['couple', 'venue'].includes(side), `${section.key} claims side ${side}`);
    }
  }
});

test('no two sections share an icon', () => {
  const byIcon = new Map();
  for (const section of SECTIONS) {
    assert.ok(!byIcon.has(section.icon), `${section.key} and ${byIcon.get(section.icon)} share ${section.icon}`);
    byIcon.set(section.icon, section.key);
  }
});

test('group order is the same on both sides, and stable', () => {
  assert.deepEqual(GROUP_ORDER, [
    'Home',
    'Get Started',
    'Plan',
    'Day Of',
    'Guests',
    'Website',
    'Rixey',
    'After the Day',
    'Connect',
    'Venue only',
  ]);

  for (const side of ['couple', 'venue']) {
    const groups = sectionsFor(side).map(g => g.group);
    const expected = GROUP_ORDER.filter(g => groups.includes(g));
    assert.deepEqual(groups, expected, `${side} groups are out of order`);
  }
});

test('sectionsFor returns only that side, and drops empty groups', () => {
  for (const side of ['couple', 'venue']) {
    for (const { sections } of sectionsFor(side)) {
      assert.ok(sections.length > 0);
      for (const section of sections) assert.ok(section.sides.includes(side));
    }
  }
  // Venue-only sections are a whole group the couple never sees.
  assert.ok(!sectionsFor('couple').some(g => g.group === 'Venue only'));
  assert.ok(sectionsFor('venue').some(g => g.group === 'Venue only'));
  assert.equal(sectionsFor('nobody').length, 0);
});

test('Get Started holds three things', () => {
  // It used to hold five, including Wedding Details and Walkthrough Notes,
  // which made the first group a couple sees the longest one in the menu.
  const getStarted = sectionsFor('couple').find(g => g.group === 'Get Started');
  assert.deepEqual(getStarted.sections.map(s => s.key), ['chat', 'worksheets', 'checklist']);
});

test('sectionByKey finds sections and does not invent them', () => {
  assert.equal(sectionByKey('bar').label, 'Bar Planner');
  assert.equal(sectionByKey('vendor'), undefined); // an alias, not a key
  assert.equal(sectionByKey('nonsense'), undefined);
});

test('the sections carrying a sign-off are all real sections', () => {
  assert.ok(FINALISABLE_KEYS.size > 0);
  for (const key of FINALISABLE_KEYS) {
    assert.ok(sectionByKey(key), `${key} is finalisable but not in the registry`);
  }
});
