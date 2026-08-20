/**
 * A phone number, reduced to the part that identifies a person.
 *
 * The same number reaches the portal written four ways: (540) 388-8912 from a
 * form, +15403888912 from OpenPhone, 5403888912 from a spreadsheet, and
 * 540-388-8912 from a signature block. Matching has to happen on something
 * stable, so everything is cut down to the last ten digits and compared there.
 *
 * This lived inside server/index.js as a private helper. It moved here when
 * contacts started needing the same rule: two definitions of "the same number"
 * is how mum's calls end up filed under nobody. One rule, one file, both sides
 * of the app import it.
 *
 * US numbers only, which matches the venue. A number that is not ten digits
 * after the country code still returns its last ten rather than null, so a
 * badly typed number matches badly rather than not at all.
 */

/** @returns {string|null} ten digits, or null if there was nothing to work with */
export function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  if (digits.length === 10) return digits;
  return digits.slice(-10);
}

/** The form OpenPhone wants when it is asked about a conversation. */
export function toE164(phone) {
  const digits = normalizePhone(phone);
  return digits ? `+1${digits}` : null;
}

/** For screens: 5403888912 -> (540) 388-8912. Anything else is left alone. */
export function formatPhone(phone) {
  const digits = normalizePhone(phone);
  if (!digits || digits.length !== 10) return phone || '';
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
