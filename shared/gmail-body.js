/**
 * Reading the body of a Gmail message, at whatever depth it is buried.
 *
 * A plain email is one part and the text sits at `payload.body.data`. Attach a
 * PDF and Gmail rebuilds the whole message around it:
 *
 *   multipart/mixed
 *     multipart/alternative
 *       text/plain      <- the person's actual words
 *       text/html
 *     application/pdf   <- the attachment
 *
 * The old reader looked exactly one level down, at `payload.parts`, and asked
 * for a part whose mimeType was text/plain. At that level there is no such
 * part. There is a multipart/alternative and a PDF. So it matched nothing,
 * fell through to the html branch, matched nothing again, and returned an
 * empty string.
 *
 * The cost of that: 124 of 1,353 imported emails have no body at all, 9.2% of
 * everything ever ingested, and they are not a random 9.2%. They are precisely
 * the emails somebody attached a document to, which is to say the contracts,
 * the invoices, the banquet event orders and the signed quotes. "Final contract
 * for Sarah & Kevan" imported as a subject line and nothing else, so filing it
 * to the right wedding extracted nothing and looked like a button that did not
 * work.
 *
 * So: walk the whole tree, not the first rung of it.
 *
 * Two things the walk has to get right. Attachments carry a `filename` and a
 * body of their own, and a text/plain attachment is not the message body, so
 * anything named is skipped when looking for words. And Gmail encodes with
 * base64url rather than base64, which Node mostly tolerates and should not be
 * asked to.
 */

/**
 * Gmail sends base64url. Normalise it, pad it, then decode as UTF-8.
 *
 * No Buffer: everything else in shared/ runs in the browser as well as on the
 * server, and this should be no different. atob and TextDecoder are in both.
 * Decoding as latin-1 and hoping is how an accented surname turns to mojibake.
 */
function decodePart(data) {
  if (!data) return '';
  let base64 = String(data).replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  try {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    // One unreadable part should cost that part, not the whole message.
    return '';
  }
}

/**
 * Tags out, entities back to characters, whitespace collapsed. Deliberately
 * mechanical: this decides nothing about what the text means, it just stops
 * markup being stored as though it were prose.
 */
export function htmlToText(html) {
  if (!html) return '';
  return String(html)
    // Script and style hold code, not words, and their contents survive a
    // naive tag strip.
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    // A closing tag becomes a newline and the opening tag next to it becomes a
    // space, so without this every line starts with one.
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Walk every part of a Gmail payload, however deep.
 *
 * Returns the first text/plain found anywhere, the first text/html as a
 * fallback, and every attachment on the message. Attachments come back whether
 * or not anything reads them yet: they are found by the same walk, and a
 * contract that arrives as a PDF is the reason this function exists.
 */
export function readMessageParts(payload) {
  const out = { text: '', html: '', attachments: [] };
  if (!payload) return out;

  const visit = (part) => {
    if (!part) return;
    const mime = String(part.mimeType || '').toLowerCase();
    const filename = String(part.filename || '').trim();

    // Anything with a filename is something the sender attached, not something
    // they wrote. A text/plain named notes.txt is not the body of the email.
    if (filename) {
      // An email signature's logo is an attachment by every structural
      // measure. What separates it from a contract is Content-Disposition
      // inline, usually with a Content-ID the html refers to. Recorded rather
      // than filtered here: this function reports what is on the message, and
      // deciding what to keep belongs to whoever is filing it.
      const headers = part.headers || [];
      const header = (name) => headers.find(
        h => String(h.name || '').toLowerCase() === name,
      )?.value || '';
      const disposition = header('content-disposition').toLowerCase();

      out.attachments.push({
        filename,
        mimeType: part.mimeType || 'application/octet-stream',
        attachmentId: part.body?.attachmentId || null,
        size: part.body?.size || 0,
        inline: disposition.startsWith('inline') || Boolean(header('content-id')),
      });
      return;
    }

    if (mime === 'text/plain' && !out.text) {
      out.text = decodePart(part.body?.data);
    } else if (mime === 'text/html' && !out.html) {
      out.html = decodePart(part.body?.data);
    }

    for (const child of part.parts || []) visit(child);
  };

  visit(payload);
  return out;
}

/**
 * The body as text, by whatever route reaches it.
 *
 * Plain text wins. Html is converted rather than dropped, because a good number
 * of vendors send html only. An empty string means the message genuinely has no
 * words in it, which after this change is a real finding rather than a parsing
 * failure.
 */
export function readMessageBody(payload) {
  const { text, html } = readMessageParts(payload);
  if (text && text.trim()) return text;
  return htmlToText(html);
}

/** Attachments only, for callers that just want the documents. */
export function readAttachments(payload) {
  return readMessageParts(payload).attachments;
}
