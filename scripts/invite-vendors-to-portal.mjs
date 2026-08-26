/**
 * Send each vendor the link to their own profile.
 *
 * The vendor portal has existed for months and nobody has ever been told about
 * it. Seven vendors found their link somehow and filled in bios and photos;
 * the rest never had the chance. 52 vendors now have an email address on file,
 * gathered off their own bookings and contracts, so they can be asked.
 *
 * This is mail to real businesses on Rixey's behalf, so:
 *
 *  - It sends nothing without --apply. The dry run prints the list and the
 *    message.
 *  - It checks Gmail is actually connected first. sendViaGmail returns false
 *    and logs a line when it is not, which for a 52-message run would mean
 *    "sent" scrolling past while nothing left the building.
 *  - Two vendor records sharing one address get ONE email listing both links.
 *    Serendipity is in there twice; the caterer does not need to hear from us
 *    twice in a minute.
 *  - A vendor already invited is skipped unless --again. A venue that emails a
 *    florist twice about the same thing is a venue whose next email is skimmed.
 *  - --only <address> sends the whole thing to one address, for looking at it
 *    before anyone else does.
 *  - --limit N sends a first batch.
 *
 *   node scripts/invite-vendors-to-portal.mjs
 *   node scripts/invite-vendors-to-portal.mjs --only isadora@rixeymanor.com --apply
 *   node scripts/invite-vendors-to-portal.mjs --limit 5 --apply
 *   node scripts/invite-vendors-to-portal.mjs --apply
 *
 * Needs migration 032.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } },
);

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : null;
};
const APPLY = process.argv.includes('--apply');
const AGAIN = process.argv.includes('--again');
const ONLY = arg('--only');
const LIMIT = Number(arg('--limit')) || null;

const API = process.env.RIXEY_API_URL || 'https://rixeyapp-production.up.railway.app';
const PORTAL = process.env.FRONTEND_URL || 'https://rixeymanor.com';

// Same seeded test admin the sync scripts use, so nobody's real session is
// disturbed and there is no new secret to keep.
const TEST_ADMIN_EMAIL = 'test-admin@rixey.invalid';
const TEST_ADMIN_PASSWORD = 'RixeyAdmin2029!';

async function all(table, columns, tweak = q => q) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await tweak(db.from(table).select(columns)).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

// ── who ──────────────────────────────────────────────────────────────────────

const vendors = await all('vendors', '*');
const migrated = vendors.length > 0 && 'portal_invited_at' in vendors[0];
if (APPLY && !migrated) {
  console.error('Run migration 032 first, or a second run would email everybody again.');
  process.exit(1);
}
if (!migrated) console.log('(migration 032 has not run, so nobody is marked as already invited yet)');

const bookings = await all('vendor_checklist', 'vendor_id, wedding_id');
const weddingCount = new Map();
for (const b of bookings) {
  if (!b.vendor_id) continue;
  if (!weddingCount.has(b.vendor_id)) weddingCount.set(b.vendor_id, new Set());
  weddingCount.get(b.vendor_id).add(b.wedding_id);
}

const candidates = vendors.filter(v =>
  !v.merged_into
  && v.email
  && String(v.email).includes('@')
  && (AGAIN || !v.portal_invited_at));

// One address, one email, however many records sit behind it.
const byAddress = new Map();
for (const v of candidates) {
  const addr = String(v.email).trim().toLowerCase();
  if (!byAddress.has(addr)) byAddress.set(addr, []);
  byAddress.get(addr).push(v);
}

// Rixey's own addresses are not vendors to write to. The venue is on its own
// vendor list as "Rixey Manor", which is how info@ would have got a letter
// asking it to fill in its profile.
const adminDomain = String(process.env.ADMIN_EMAIL || 'rixeymanor.com').split('@').pop().toLowerCase();
const ours = [...byAddress.keys()].filter(a => a.endsWith(`@${adminDomain}`));
ours.forEach(a => byAddress.delete(a));

let groups = [...byAddress.entries()].map(([email, vs]) => ({ email, vendors: vs }));
groups.sort((a, b) =>
  Math.max(...b.vendors.map(v => weddingCount.get(v.id)?.size || 0))
  - Math.max(...a.vendors.map(v => weddingCount.get(v.id)?.size || 0)));

if (ONLY) {
  // If the address is one of the recipients, send them their real message.
  // Otherwise redirect the first one, so a test to your own inbox shows a
  // genuine letter rather than a made-up one. Marked `test` either way so
  // nobody gets marked as invited by a rehearsal.
  const mine = groups.find(g => g.email === ONLY.toLowerCase());
  groups = mine ? [{ ...mine, test: true }] : groups.slice(0, 1).map(g => ({ ...g, email: ONLY, test: true }));
}
if (LIMIT) groups = groups.slice(0, LIMIT);

// ── what it says ─────────────────────────────────────────────────────────────

const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function message(group) {
  const many = group.vendors.length > 1;
  const first = group.vendors[0];
  const weddings = Math.max(...group.vendors.map(v => weddingCount.get(v.id)?.size || 0));

  const worked = weddings > 1
    ? `You have worked ${weddings} weddings here with us`
    : weddings === 1
      ? 'You have worked a wedding here with us'
      : 'You are on the list of people we recommend to our couples';

  const links = group.vendors.map(v => `
    <p style="margin: 0 0 10px;">
      ${many ? `<strong style="font-size:14px;">${esc(v.name)}</strong><br>` : ''}
      <a href="${PORTAL}/vendor/${v.edit_token}"
         style="display:inline-block; background:#5C6B4F; color:#ffffff; padding:11px 22px; border-radius:6px; text-decoration:none; font-size:14px;">
        Fill in your profile →
      </a>
    </p>`).join('');

  return {
    subject: many
      ? 'Your profiles in the Rixey Manor vendor directory'
      : `Your profile in the Rixey Manor vendor directory`,
    html: `
<div style="font-family: Georgia, serif; max-width: 580px; margin: 0 auto; padding: 30px 20px; color: #3d3d3d; background: #fefbf7;">
  <div style="padding-bottom: 16px; margin-bottom: 24px; border-bottom: 2px solid #7C9070;">
    <span style="font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #7C9070;">Rixey Manor</span>
  </div>

  <p style="font-size: 16px; line-height: 1.7; margin: 0 0 18px;">
    Hello${first.contact && !String(first.contact).includes('@') ? ` ${esc(String(first.contact).split(/[,(]/)[0].trim())}` : ''},
  </p>

  <p style="font-size: 16px; line-height: 1.7; margin: 0 0 18px;">
    ${worked}, and every couple who books Rixey can see that recommendation in
    their planning portal. At the moment all it says is your name and a line
    from me. You can say more.
  </p>

  <p style="font-size: 16px; line-height: 1.7; margin: 0 0 18px;">
    ${many
      ? `We have you listed ${group.vendors.length} times, so there ${group.vendors.length === 2 ? 'are two links' : 'are links'} below, one for each. No password, nothing to sign up for.`
      : 'The link below is yours. No password, nothing to sign up for.'}
    ${many ? 'They open a page' : 'It opens a page'} where you can add a few photos, describe what you do
    in your own words, put in your contact details and say what you are
    booking. Whatever you save goes straight into the directory our couples
    browse.
  </p>

  ${links}

  <p style="font-size: 16px; line-height: 1.7; margin: 18px 0;">
    One thing worth knowing: there is a box for an offer for Rixey couples, and
    couples can filter the directory down to just the vendors offering one. If
    you put something there, that is where you turn up.
  </p>

  <p style="font-size: 16px; line-height: 1.7; margin: 0 0 18px;">
    Keep the link. It stays live, so you can come back and change anything
    whenever you like.
  </p>

  <p style="font-size: 16px; line-height: 1.7; margin: 0 0 6px;">Thank you,</p>
  <p style="font-size: 16px; line-height: 1.7; margin: 0 0 24px;">Isadora<br>
    <span style="color:#7a7a7a; font-size:14px;">Rixey Manor</span></p>

  <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e8e0d5;">
    <p style="font-size: 12px; color: #999; margin: 0;">
      Rixey Manor · Rapidan, VA · rixeymanor.com<br>
      If you would rather not be listed, reply to this email and we will take you off.
    </p>
  </div>
</div>`,
  };
}

// ── report ───────────────────────────────────────────────────────────────────

const withEmail = vendors.filter(v => !v.merged_into && v.email).length;
const already = vendors.filter(v => v.portal_invited_at).length;

console.log(`${vendors.length} vendor records, ${withEmail} with an email address, ${already} already invited`);
if (ours.length) console.log(`${ours.length} skipped for being a Rixey address: ${ours.join(', ')}`);
console.log(`${groups.length} email${groups.length === 1 ? '' : 's'} to send\n`);

groups.slice(0, 60).forEach(g => {
  const names = g.vendors.map(v => {
    const n = weddingCount.get(v.id)?.size || 0;
    return `${v.name} (${n} wedding${n === 1 ? '' : 's'})`;
  }).join(' + ');
  console.log(`  ${g.email.padEnd(38)} ${names}`);
});
if (groups.length > 60) console.log(`  ... and ${groups.length - 60} more`);

if (!APPLY) {
  const sample = groups[0];
  if (sample) {
    const m = message(sample);
    console.log(`\n─── what ${sample.email} would get ───`);
    console.log(`Subject: ${m.subject}\n`);
    console.log(m.html
      .replace(/<style[\s\S]*?<\/style>/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .split('\n').map(l => l.trim()).filter(Boolean).join('\n'));
  }
  console.log('\nDry run. Nothing sent. Add --apply.');
  process.exit(0);
}

// ── send ─────────────────────────────────────────────────────────────────────

// Ask the API whether Gmail is connected before claiming to have sent anything.
// sendViaGmail logs and returns false when it is not, which across 52 messages
// would read as a successful run that delivered nothing.
const health = await fetch(`${API}/api/health`).then(r => r.json()).catch(() => null);
if (!health) {
  console.error(`Could not reach the API at ${API}. Nothing sent.`);
  process.exit(1);
}

const anon = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
const { data: session, error: signInError } = await anon.auth.signInWithPassword({
  email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD,
});
if (signInError) {
  console.error(`Could not sign in as ${TEST_ADMIN_EMAIL}: ${signInError.message}`);
  console.error('Run scripts/seed_test_users.mjs if the account is missing. Nothing sent.');
  process.exit(1);
}
const token = session.session.access_token;

// Ask before sending anything rather than after. The endpoint refuses when
// Gmail is not connected, which is the failure that would otherwise print 52
// cheerful lines while nothing left the building.
const ready = await fetch(`${API}/api/vendor-invites/ready`, {
  headers: { Authorization: `Bearer ${token}` },
}).then(r => r.json()).catch(() => null);
if (!ready?.ok) {
  console.error(`Not sending: ${ready?.error || 'could not ask the server whether Gmail is connected'}`);
  console.error('Reconnect Gmail in the admin panel, then run this again.');
  process.exit(1);
}
console.log(`Gmail is connected as ${ready.from}. Sending.
`);

const results = { sent: 0, failed: 0 };
for (const g of groups) {
  const m = message(g);
  const res = await fetch(`${API}/api/vendor-invites/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      to: g.email,
      subject: m.subject,
      html: m.html,
      vendorIds: g.test ? [] : g.vendors.map(v => v.id),
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.sent) {
    console.error(`  FAILED ${g.email}: ${body.error || res.status}`);
    results.failed++;
    // A whole run of failures is a broken connection, not 52 bad addresses.
    if (results.failed >= 3 && results.sent === 0) {
      console.error('\nThree failures and nothing sent. Stopping rather than working through the list.');
      break;
    }
    continue;
  }
  console.log(`  sent ${g.email}`);
  results.sent++;
}

console.log(`\n${results.sent} sent, ${results.failed} failed.`);
if (results.sent) console.log('Invited vendors are marked, so a second run will skip them unless you pass --again.');
