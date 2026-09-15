import test from 'node:test'
import assert from 'node:assert/strict'
import { parseGuestCsv, canonicalHeader, parseCSVLine } from '../../shared/guest-csv.js'

const CRLF = '\r\n'

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
