/**
 * Turn a filename someone uploaded into a storage key that is safe to keep.
 *
 * Uploads were stored as `${weddingId}/${Date.now()}_${file.originalname}`,
 * with originalname exactly as the browser sent it. A filename is not a name,
 * it is a string a caller chose, and it can carry path separators, control
 * characters, a leading dot, or four hundred characters of nothing. The
 * timestamp is not a unique key either: two phones uploading in the same
 * millisecond collide, and the ones that go into a public bucket are guessable
 * from the outside if you know roughly when a photo went up.
 *
 * So: keep something a human can recognise in a bucket listing, and nothing
 * else.
 *
 * @param {string} name  the filename as uploaded
 * @returns {string} `<8 hex chars>-<cleaned stem>.<ext>`, at most 120 chars
 */
import crypto from 'node:crypto';

const MAX_LENGTH = 120;

export function safeStorageKey(name) {
  // Only ever the last segment. `../../secrets.pdf` and
  // `C:\Users\x\photo.jpg` both become the leaf.
  const leaf = String(name || '').split(/[\\/]/).pop() || '';

  // Control characters, including the null byte that truncates a path in
  // anything written in C further down the stack.
  // eslint-disable-next-line no-control-regex
  const cleaned = leaf.replace(/[\u0000-\u001f\u007f]/g, '');

  // Keep the extension: Supabase serves a content type off the key, and a
  // .pdf that arrives as a bare hash downloads as a file nothing will open.
  const dot = cleaned.lastIndexOf('.');
  const ext = dot > 0
    ? cleaned.slice(dot + 1).replace(/[^A-Za-z0-9]/g, '').slice(0, 10).toLowerCase()
    : '';

  let stem = (dot > 0 ? cleaned.slice(0, dot) : cleaned)
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-._]+/, '')
    .replace(/[-._]+$/, '');

  const id = crypto.randomBytes(4).toString('hex');
  const tail = ext ? `.${ext}` : '';
  const room = MAX_LENGTH - id.length - 1 - tail.length;
  if (stem.length > room) stem = stem.slice(0, Math.max(0, room)).replace(/[-._]+$/, '');
  if (!stem) stem = 'file';

  return `${id}-${stem}${tail}`;
}
