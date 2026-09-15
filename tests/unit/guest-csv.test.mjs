import test from 'node:test'
import assert from 'node:assert/strict'
import { parseGuestCsv, canonicalHeader, parseCSVLine, inferColumns, applyColumnMapping } from '../../shared/guest-csv.js'

const CRLF = '\r\n'

/** Infer from CSV text, and hand back a header -> key map plus the full report. */
function inferFrom(lines) {
  const { rawHeaders, rawRows } = parseGuestCsv(lines.join(CRLF))
  const cols = inferColumns(rawHeaders, rawRows)
  const byIndex = cols.map(c => c.key)
  const conf = cols.map(c => c.confidence)
  return { cols, keys: byIndex, conf, rawHeaders, rawRows }
}

test('the portal\'s own export labels come back as guest columns', () => {
  const csv = ['First name,Last name,Email,Phone,Address,RSVP,Plus one,Table,Notes',
    'Ana,Núñez,ana@example.com,555-0100,"12 Elm St, Culpeper, VA 22701",yes,Sam Núñez,4,"Vegetarian, no nuts"'].join(CRLF)
  const { guests } = parseGuestCsv('﻿' + csv)
  assert.equal(guests.length, 1)
  const g = guests[0]
  assert.equal(g.first_name, 'Ana')
  assert.equal(g.last_name, 'Núñez')
  assert.equal(g.address, '12 Elm St, Culpeper, VA 22701')
  assert.equal(g.plus_one_name, 'Sam Núñez')
  assert.equal(g.table_assignment, '4')
  assert.equal(g.notes, 'Vegetarian, no nuts')
})

test('a split address is joined in column order', () => {
  const csv = ['Guest Name,Email Address,Address Line 1,City,State,Zip,Plus One',
    'Bo Ruiz,bo@example.com,9 Oak Ave,Warrenton,VA,20186,Lee Ruiz'].join(CRLF)
  const { guests } = parseGuestCsv(csv)
  assert.equal(guests.length, 1)
  assert.equal(guests[0].name, 'Bo Ruiz')
  assert.equal(guests[0].email, 'bo@example.com')
  assert.equal(guests[0].address, '9 Oak Ave, Warrenton, VA, 20186')
  assert.equal(guests[0].plus_one_name, 'Lee Ruiz')
})

test('a plain sheet with Name, Mobile and Attending is understood', () => {
  const csv = ['Name,Mobile,Attending', 'Cy Park,555-0101,Accepted'].join(CRLF)
  const { guests } = parseGuestCsv(csv)
  assert.equal(guests.length, 1)
  assert.equal(guests[0].name, 'Cy Park')
  assert.equal(guests[0].phone, '555-0101')
  assert.equal(guests[0].rsvp, 'Accepted')
})

test('CRLF does not leave a carriage return on the last value', () => {
  const { guests } = parseGuestCsv('First name,Notes\r\nDee,hello\r\n')
  assert.equal(guests[0].notes, 'hello')
})

test('rows without any name are dropped, and the headers are reported for the message', () => {
  const { guests, rawHeaders } = parseGuestCsv('Colour,Size\r\nred,large\r\n')
  assert.equal(guests.length, 0)
  assert.deepEqual(rawHeaders, ['Colour', 'Size'])
})

test('header canonicalisation ignores case, spaces and punctuation', () => {
  assert.equal(canonicalHeader('E-Mail Address'), 'email')
  assert.equal(canonicalHeader(' PLUS ONE '), 'plus_one_name')
  assert.equal(canonicalHeader('Table #'), 'table_assignment')
  assert.equal(canonicalHeader('Favourite colour'), 'favourite_colour')
})

test('quoted fields keep commas and doubled quotes', () => {
  assert.deepEqual(parseCSVLine('a,"b, c","say ""hi"""'), ['a', 'b, c', 'say "hi"'])
})

// ─── inferColumns ────────────────────────────────────────────────────────────

test('the portal\'s own export comes back all high confidence, so the server is never asked', () => {
  const { keys, conf } = inferFrom([
    'First name,Last name,Email,Phone,Address,RSVP,Meal choice,Dietary,Table,Plus one,Plus one RSVP,Plus one meal,Plus one dietary,Notes',
    'Ana,Núñez,ana@example.com,555-0100,"12 Elm St, Culpeper, VA 22701",yes,Salmon,None,4,Sam Núñez,yes,Beef,Nuts,Early arrival',
    'Bo,Ruiz,bo@example.com,555-0101,"9 Oak Ave, Warrenton, VA 20186",no,Beef,,5,,,,,',
  ])
  assert.deepEqual(keys, ['first_name', 'last_name', 'email', 'phone', 'address', 'rsvp', 'meal_choice',
    'dietary_restrictions', 'table_assignment', 'plus_one_name', 'plus_one_rsvp', 'plus_one_meal_choice',
    'plus_one_dietary', 'notes'])
  assert.ok(conf.every(c => c === 'high'), `expected every column high, got ${conf.join(',')}`)
})

test('a Zola export maps its address parts and leaves the party column out', () => {
  const { cols, keys } = inferFrom([
    'First Name,Last Name,Party,Email,Phone Number,Address Line 1,City,State,Zip,Country,RSVP,Meal,Note',
    'Ana,Núñez,Núñez Family,ana@example.com,(540) 555-0100,12 Elm St,Culpeper,VA,22701,United States,Attending,Salmon,Coming early',
    'Bo,Ruiz,Ruiz Family,bo@example.com,540-555-0101,9 Oak Ave,Warrenton,VA,20186,United States,Declined,Beef,',
    'Cy,Park,Park Family,cy@example.com,5405550102,3 Fern Ln,Orange,VA,22960,United States,Attending,Chicken,',
  ])
  assert.deepEqual(keys, ['first_name', 'last_name', 'ignore', 'email', 'phone', 'address_line', 'city',
    'state', 'zip', 'country', 'rsvp', 'meal_choice', 'notes'])
  assert.equal(cols[3].confidence, 'high') // header and the @ signs agree
  assert.equal(cols[6].confidence, 'high')
})

test('a The Knot export keeps the whole address and the plus one', () => {
  const { keys, cols } = inferFrom([
    'Guest First Name,Guest Last Name,Email,Phone,Street Address,City,State,Zip Code,RSVP Status,Meal Preference,Plus One Name,Notes',
    'Ana,Núñez,ana@example.com,555-0100,12 Elm St,Culpeper,VA,22701,Accepted,Salmon,Sam Núñez,',
    'Bo,Ruiz,bo@example.com,555-0101,9 Oak Ave,Warrenton,VA,20186,Declined,Beef,,Allergic to shellfish',
  ])
  assert.deepEqual(keys, ['first_name', 'last_name', 'email', 'phone', 'address', 'city', 'state', 'zip',
    'rsvp', 'meal_choice', 'plus_one_name', 'notes'])
  assert.equal(cols[0].confidence, 'high')
  const rows = applyColumnMapping(['Guest First Name', 'Guest Last Name', 'Email', 'Phone', 'Street Address', 'City', 'State', 'Zip Code', 'RSVP Status', 'Meal Preference', 'Plus One Name', 'Notes'],
    [['Ana', 'Núñez', 'ana@example.com', '555-0100', '12 Elm St', 'Culpeper', 'VA', '22701', 'Accepted', 'Salmon', 'Sam Núñez', '']], keys)
  assert.equal(rows[0].guest.address, '12 Elm St, Culpeper, VA, 22701')
})

test('a hand-made sheet with Guests and Contact is read from the values', () => {
  const { cols, keys } = inferFrom([
    'Guests,Contact,Notes',
    'Ana Núñez,ana@example.com,Coming early',
    'Bo Ruiz,bo@example.com,',
    'Cy Park,cy@example.com,Needs a lift',
  ])
  assert.deepEqual(keys, ['name', 'email', 'notes'])
  assert.equal(cols[0].confidence, 'high')   // "Guests" is the alias "guest", and the values are pairs of words
  assert.equal(cols[1].confidence, 'medium') // nothing in the header says email, the values do
  assert.equal(cols[1].reason, 'Most of the values hold an @ sign.')
  assert.deepEqual(cols[1].samples, ['ana@example.com', 'bo@example.com', 'cy@example.com'])
})

test('a mis-spelt header still lands, on the spelling and the values together', () => {
  const { keys, conf } = inferFrom([
    'Frist Name,Last Name,Emial,Moblie',
    'Ana,Núñez,ana@example.com,555-0100',
    'Bo,Ruiz,bo@example.com,555-0101',
  ])
  assert.deepEqual(keys, ['first_name', 'last_name', 'email', 'phone'])
  assert.equal(conf[2], 'high') // "Emial" is one swap from "email", and the values hold @
})

test('two columns that both look like names do not both become the name', () => {
  const partner = inferFrom([
    'Guest Name,Partner Name,Email',
    'Ana Núñez,Sam Núñez,ana@example.com',
    'Bo Ruiz,Lee Ruiz,bo@example.com',
  ])
  assert.deepEqual(partner.keys, ['name', 'plus_one_name', 'email'])

  // "Name of guest" is a plus one by its words; nothing collides.
  const wordy = inferFrom([
    'Name,Name of guest,Email',
    'Ana Núñez,Sam Núñez,ana@example.com',
    'Bo Ruiz,Lee Ruiz,bo@example.com',
  ])
  assert.equal(wordy.keys[0], 'name')
  assert.notEqual(wordy.keys[1], 'name')

  // Here they genuinely clash: the header alias wins and the other is left out
  // rather than quietly overwriting it.
  const clash = inferFrom([
    'Guest,Attendee,Email',
    'Ana Núñez,Sam Núñez,ana@example.com',
    'Bo Ruiz,Lee Ruiz,bo@example.com',
  ])
  assert.deepEqual(clash.keys, ['name', 'ignore', 'email'])
  assert.equal(clash.conf[1], 'low')
  assert.equal(clash.cols[1].reason, 'Another column is already the Full name.')
})

test('two columns of single names become first and last by position', () => {
  const { keys, conf } = inferFrom([
    'Who,Whom,Email',
    'Ana,Núñez,ana@example.com',
    'Bo,Ruiz,bo@example.com',
    'Cy,Park,cy@example.com',
  ])
  assert.deepEqual(keys, ['first_name', 'last_name', 'email'])
  assert.equal(conf[0], 'low') // a guess by elimination, so the check step flags it
})

test('a wedding-website export: one event column is the RSVP, the rest are tags', () => {
  const headers = ['Title', 'First Name', 'Last Name', 'Suffix', 'Rehearsal Dinner',
    'Please let us know if you have any dietary restrictions or food allergies so we can do our best to accommodate you.',
    'Friday Night Welcome Party', "If your invitation includes a guest, please enter your guest's full name below.",
    'Ceremony', 'Will you be using the provided shuttle transportation? Please answer "Yes" or "No."',
    'Cocktail Hour', 'Reception', 'Meal Choice',
    'Please let us know if you have any dietary restrictions or food allergies so we can do our best to accommodate you.',
    'After Party', 'Sunday Brunch']
  const rows = [
    ['', 'Ana', 'Núñez', '', 'Attending', 'None', 'Attending', 'Sam Núñez', 'Attending', 'Yes', 'Attending', 'Attending', 'baked salmon', 'No nuts', 'Attending', 'Attending'],
    ['', 'Bo', 'Ruiz', '', 'Declined', '', 'Declined', '', 'Declined', 'No', 'No Response', 'Declined', '', '', 'Declined', 'Declined'],
    ['', 'Cy', 'Park', '', '', 'Gluten free', 'Attending', '', 'Attending', 'yes', 'No Response', 'Attending', 'lemon chicken', '', 'No Response', 'Attending'],
  ]
  const cols = inferColumns(headers, rows)
  assert.deepEqual(cols.map(c => c.key), [
    'ignore', 'first_name', 'last_name', 'ignore', 'tag:Rehearsal Dinner', 'dietary_restrictions',
    'tag:Friday Night Welcome Party', 'plus_one_name', 'tag:Ceremony', 'tag:Shuttle',
    'tag:Cocktail Hour', 'rsvp', 'meal_choice', 'plus_one_dietary', 'tag:After Party', 'tag:Sunday Brunch',
  ])
  // This is the export Isadora was importing, so it must not be a wall of amber.
  assert.ok(cols.every(c => c.confidence === 'high'), cols.map(c => `${c.raw.slice(0, 20)}=${c.confidence}`).join(' '))

  const built = applyColumnMapping(headers, rows, cols.map(c => c.key))
  assert.equal(built.length, 3)
  assert.equal(built[0].guest.rsvp, 'Attending')
  assert.equal(built[1].guest.rsvp, 'Declined')
  assert.equal(built[2].guest.rsvp, 'Attending')
  assert.deepEqual(built[0].guest.tags, ['Rehearsal Dinner', 'Friday Night Welcome Party', 'Ceremony', 'Shuttle', 'Cocktail Hour', 'After Party', 'Sunday Brunch'])
  assert.deepEqual(built[1].guest.tags, []) // declined everything, so no tags
  assert.deepEqual(built[2].guest.tags, ['Friday Night Welcome Party', 'Ceremony', 'Shuttle', 'Sunday Brunch'])
  assert.equal(built[0].guest.plus_one_name, 'Sam Núñez')
  assert.equal(built[0].guest.dietary_restrictions, 'None')
  assert.equal(built[0].guest.plus_one_dietary, 'No nuts')
  assert.equal(built[2].guest.meal_choice, 'lemon chicken')
})

test('content never overrules a header that matched an alias exactly', () => {
  // Somebody typed the phone number into the email column. The header wins.
  const { keys, conf } = inferFrom([
    'First name,Email,Phone',
    'Ana,555-0100,555-0100',
    'Bo,555-0101,555-0101',
  ])
  assert.deepEqual(keys, ['first_name', 'email', 'phone'])
  assert.equal(conf[1], 'high')
})

test('a single yes-or-no column with no home of its own is kept as a tag', () => {
  const { keys } = inferFrom([
    'Name,RSVP,Shuttle,Kids Table',
    'Ana Núñez,Accepted,Yes,No',
    'Bo Ruiz,Declined,No,Yes',
    'Cy Park,Accepted,yes,no',
  ])
  assert.deepEqual(keys, ['name', 'rsvp', 'tag:Shuttle', 'tag:Kids Table'])
})

test('applying a mapping drops ignored columns and joins the address in column order', () => {
  const headers = ['First name', 'Junk', 'Address Line 1', 'City', 'State', 'Zip', 'Shuttle']
  const rows = [['Ana', 'whatever', '12 Elm St', 'Culpeper', 'VA', '22701', 'yes']]
  const keys = ['first_name', 'ignore', 'address_line', 'city', 'state', 'zip', 'tag:Shuttle']
  const [row] = applyColumnMapping(headers, rows, keys)
  assert.equal(row.guest.first_name, 'Ana')
  assert.equal(row.guest.address, '12 Elm St, Culpeper, VA, 22701')
  assert.equal(row.guest.Junk, undefined)
  assert.deepEqual(row.guest.tags, ['Shuttle'])
  assert.equal(row.raw.first_name, 'Ana') // the canonical row is still there for the existing tag rules
})
