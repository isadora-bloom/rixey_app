import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ROW_ACTIVITY, BURST_ACTIVITY, activityFor, burstActivityFor, allActivityTypes } from '../../server/lib/activity-rows.js'
import { TABLE_COLUMNS } from '../../server/middleware/table-columns.js'

test('an added row is named, not numbered', () => {
  const e = activityFor('wedding_party', 'added', { wedding_id: 'w', member_name: 'Rebecka Graves' })
  assert.deepEqual(e, { type: 'wedding_party_added', details: 'added Rebecka Graves' })
})

test('removing reads as removed, not deleted', () => {
  const e = activityFor('decor_inventory', 'deleted', { item_name: 'Lanterns' })
  assert.equal(e.details, 'removed Lanterns')
})

test('a row with no name falls back to the noun rather than a bare id', () => {
  const e = activityFor('shuttle_schedule', 'added', { id: 'c0ffee' })
  assert.equal(e.details, 'added a shuttle run')
  assert.ok(!e.details.includes('c0ffee'))
})

test('a blank or whitespace name is treated as no name', () => {
  assert.equal(activityFor('bar_recipes', 'added', { name: '   ' }).details, 'added a recipe')
  assert.equal(activityFor('bar_recipes', 'added', { name: '' }).details, 'added a recipe')
})

test('a table we do not log per row returns nothing rather than guessing', () => {
  assert.equal(activityFor('wedding_budget', 'added', { wedding_id: 'w' }), null)
  assert.equal(activityFor('not_a_table', 'added', {}), null)
})

test('an action we do not know returns nothing', () => {
  assert.equal(activityFor('wedding_party', 'exploded', { member_name: 'x' }), null)
})

test('a missing row is not a crash', () => {
  assert.doesNotThrow(() => activityFor('wedding_party', 'added', undefined))
  assert.equal(activityFor('wedding_party', 'added', undefined).details, 'added someone')
  assert.equal(activityFor('wedding_party', 'added', null).details, 'added someone')
})

test('every configured table really exists and carries a wedding_id', () => {
  for (const table of Object.keys(ROW_ACTIVITY)) {
    const cols = TABLE_COLUMNS[table]
    assert.ok(cols, `${table} is configured but is not a known table`)
    assert.ok(cols.includes('wedding_id'), `${table} has no wedding_id, so a row of it belongs to no wedding`)
  }
})

test('every configured name column really exists on its table', () => {
  for (const [table, config] of Object.entries(ROW_ACTIVITY)) {
    if (!config.name) continue
    assert.ok(
      TABLE_COLUMNS[table].includes(config.name),
      `${table}.${config.name} does not exist, so the details line would say "${config.noun}" for every row`
    )
  }
})

// The stems were drifting before this file existed: decor_inventory logged
// `decor_deleted`, shuttle_schedule logged `shuttle_run_deleted`. Those strings
// are in the table already and the admin feed renders them, so renaming one
// orphans history. This pins them to what the delete handlers still emit.
test('the delete types still match the ones the handlers write', () => {
  const src = readFileSync(new URL('../../server/index.js', import.meta.url), 'utf8')
  const existing = [
    'allergy_deleted', 'bar_recipe_deleted', 'bar_shopping_item_deleted',
    'ceremony_order_deleted', 'day_of_media_deleted', 'decor_deleted',
    'guest_tag_deleted', 'internal_note_deleted', 'makeup_schedule_deleted',
    'meal_option_deleted', 'shuttle_run_deleted', 'wedding_contact_deleted',
    'wedding_party_deleted',
  ]
  const produced = new Set(allActivityTypes())
  for (const type of existing) {
    assert.ok(src.includes(`'${type}'`), `${type} is no longer written anywhere in server/index.js`)
    assert.ok(produced.has(type), `${type} is written by hand but activityFor cannot produce it, so add/update will not match it`)
  }
})

test('types are the stem plus one of three verbs, and nothing else', () => {
  for (const type of allActivityTypes()) {
    assert.match(type, /_(added|updated|deleted)$/)
  }
  assert.equal(allActivityTypes().length, Object.keys(ROW_ACTIVITY).length * 3)
})

// ── High-volume tables ────────────────────────────────────────────────────────
//
// A couple importing two hundred guests should leave one line behind. The whole
// mechanism is logActivity's ten-minute fold, which only works if the wording
// does not change between two edits, so that is what these pin.

test('the burst wording carries no name, count or anything else that varies', () => {
  for (const [table, actions] of Object.entries(BURST_ACTIVITY)) {
    for (const [action, entry] of Object.entries(actions)) {
      assert.match(entry.details, /^[a-z][a-z' ]+$/, `${table}.${action} details must be constant prose: ${entry.details}`)
      assert.ok(!/\d/.test(entry.details), `${table}.${action} must not include a number, or the fold stops working`)
    }
  }
})

test('two edits in a row produce identical entries, so the fold collapses them', () => {
  const a = burstActivityFor('wedding_guests', 'updated')
  const b = burstActivityFor('wedding_guests', 'updated')
  assert.deepEqual(a, b)
  assert.equal(a.type, 'guest_list_updated')
})

test('adding, editing and removing stay distinguishable from each other', () => {
  const seen = new Set()
  for (const action of ['added', 'updated', 'deleted']) {
    const e = burstActivityFor('wedding_guests', action)
    assert.ok(e, `no burst entry for ${action}`)
    assert.ok(!seen.has(e.details), `${action} reads the same as another action`)
    seen.add(e.details)
  }
})

test('a table that is not high-volume returns nothing from the burst helper', () => {
  assert.equal(burstActivityFor('wedding_party', 'added'), null)
  assert.equal(burstActivityFor('wedding_guests', 'exploded'), null)
})

test('a table is either row-by-row or bursty, never both', () => {
  for (const table of Object.keys(BURST_ACTIVITY)) {
    assert.ok(!ROW_ACTIVITY[table], `${table} is in both lists, so which one a caller gets depends on which helper they picked`)
  }
})
