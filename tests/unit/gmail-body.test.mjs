/**
 * The email body has to survive an attachment.
 *
 * Nine per cent of every email ever imported came in with no body, and they
 * were the contracts and the invoices, because attaching a file moves the text
 * a level deeper and the reader only looked at the first level. These cases
 * are here so that cannot come back quietly.
 *
 * Run with: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readMessageBody, readMessageParts, htmlToText } from '../../shared/gmail-body.js';

const b64 = s => Buffer.from(s, 'utf-8').toString('base64');
const b64url = s => b64(s).replace(/\+/g, '-').replace(/\//g, '_');

test('a plain message reads straight off the payload', () => {
  assert.equal(readMessageBody({ mimeType: 'text/plain', body: { data: b64('hello there') } }), 'hello there');
});

test('plain text is preferred over the html twin', () => {
  const payload = { mimeType: 'multipart/alternative', parts: [
    { mimeType: 'text/plain', body: { data: b64('plain wins') } },
    { mimeType: 'text/html', body: { data: b64('<p>html</p>') } },
  ]};
  assert.equal(readMessageBody(payload), 'plain wins');
});

test('an attached PDF does not swallow the message', () => {
  // This is the shape Gmail actually sends, and the one that returned ''.
  const payload = { mimeType: 'multipart/mixed', parts: [
    { mimeType: 'multipart/alternative', parts: [
      { mimeType: 'text/plain', body: { data: b64('Final contract attached, please sign.') } },
      { mimeType: 'text/html', body: { data: b64('<p>Final contract attached</p>') } },
    ]},
    { mimeType: 'application/pdf', filename: 'contract.pdf', body: { attachmentId: 'abc123', size: 88000 } },
  ]};
  assert.equal(readMessageBody(payload), 'Final contract attached, please sign.');

  const { attachments } = readMessageParts(payload);
  assert.equal(attachments.length, 1);
  assert.equal(attachments[0].filename, 'contract.pdf');
  assert.equal(attachments[0].attachmentId, 'abc123');
});

test('the body is found however deep it is nested', () => {
  const payload = { mimeType: 'multipart/mixed', parts: [
    { mimeType: 'multipart/related', parts: [
      { mimeType: 'multipart/alternative', parts: [
        { mimeType: 'text/plain', body: { data: b64('buried deep') } },
      ]},
      { mimeType: 'image/png', filename: 'logo.png', body: { attachmentId: 'i' } },
    ]},
    { mimeType: 'application/pdf', filename: 'beo.pdf', body: { attachmentId: 'p' } },
  ]};
  assert.equal(readMessageBody(payload), 'buried deep');
  assert.equal(readMessageParts(payload).attachments.length, 2);
});

test('an html-only vendor email is converted, not dropped', () => {
  const payload = { mimeType: 'multipart/mixed', parts: [
    { mimeType: 'text/html', body: { data: b64('<style>p{color:red}</style><p>Hi&nbsp;Sarah</p><p>Bye</p>') } },
  ]};
  assert.equal(readMessageBody(payload), 'Hi Sarah\nBye');
});

test('a text attachment is not mistaken for the body', () => {
  const payload = { mimeType: 'multipart/mixed', parts: [
    { mimeType: 'text/plain', filename: 'notes.txt', body: { attachmentId: 'x' } },
    { mimeType: 'text/html', body: { data: b64('<p>the real body</p>') } },
  ]};
  assert.equal(readMessageBody(payload), 'the real body');
});

test('base64url survives decoding', () => {
  const text = 'quote ~ dash ? arrow >>> price ?250';
  assert.equal(readMessageBody({ mimeType: 'text/plain', body: { data: b64url(text) } }), text);
});

test('accented names survive the decode', () => {
  // Decoding as latin-1 turns Zoë into ZoÃ«, and these are guest names.
  const text = 'Zoë Fauré and Søren, £250 déposit';
  assert.equal(readMessageBody({ mimeType: 'text/plain', body: { data: b64(text) } }), text);
});

test('a message with genuinely no words returns nothing', () => {
  const payload = { mimeType: 'multipart/mixed', parts: [
    { mimeType: 'application/pdf', filename: 'x.pdf', body: { attachmentId: 'p' } },
  ]};
  assert.equal(readMessageBody(payload), '');
});

test('script and style contents do not become prose', () => {
  assert.equal(htmlToText('<script>var a=1;</script><p>Only this</p>'), 'Only this');
});

test('a missing payload is not a crash', () => {
  assert.equal(readMessageBody(null), '');
  assert.deepEqual(readMessageParts(undefined), { text: '', html: '', attachments: [] });
});
