/**
 * Does a link we email actually come back to the portal?
 *
 * On 20 August a client said the password reset link did not work. It did not:
 * Supabase was rewriting every emailed link to redirect to
 * http://localhost:3000, because the live origin was not in the project's
 * allowed redirect list and the Site URL was still the development default. So
 * everyone who asked for a reset was sent to their own machine, where nothing
 * is running.
 *
 * Nothing in the application can detect that. `resetPasswordForEmail` returns
 * success either way — the rewrite happens inside GoTrue, and the only place
 * the truth appears is the link itself. So this asks for a link and reads it.
 *
 * Run it after any change to Supabase's URL configuration, and after any change
 * of domain:
 *
 *   node --env-file=.env scripts/check-auth-redirects.mjs https://rixey-app.vercel.app
 *
 * Uses a .invalid test address, so nothing is emailed to a real person and no
 * real user's pending link is consumed.
 */

import { createClient } from '@supabase/supabase-js';

const ORIGIN = process.argv[2] || 'https://rixey-app.vercel.app';
const TEST_EMAIL = process.argv[3] || 'test-couple@rixey.invalid';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed.');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const targets = [`${ORIGIN}/reset-password`, ORIGIN];
let bad = 0;

for (const type of ['recovery', 'magiclink']) {
  for (const target of targets) {
    const { data, error } = await sb.auth.admin.generateLink({
      type, email: TEST_EMAIL, options: { redirectTo: target },
    });
    if (error) {
      console.error(`${type} -> could not generate a link: ${error.message}`);
      bad++;
      continue;
    }
    const got = decodeURIComponent(data.properties.action_link.match(/redirect_to=([^&]+)/)?.[1] || '');
    const ok = got === target;
    if (!ok) bad++;
    console.log(`${ok ? 'ok  ' : 'WRONG'} ${type.padEnd(10)} asked ${target}`);
    if (!ok) console.log(`                 got   ${got || '(no redirect_to at all)'}`);
  }
}

if (bad) {
  console.log(`\n${bad} link(s) will not come back to ${ORIGIN}.`);
  console.log('Fix in Supabase: Authentication -> URL Configuration.');
  console.log(`  Site URL:      ${ORIGIN}`);
  console.log(`  Redirect URLs: ${ORIGIN}/**   (keep http://localhost:5173/** for development)`);
  process.exit(1);
}

console.log(`\nEvery link comes back to ${ORIGIN}.`);
