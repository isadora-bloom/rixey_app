/**
 * The letter asking a vendor to fill in their profile.
 *
 * Shared, because it goes out two ways: one at a time from the button on the
 * Vendors screen, and in a batch from scripts/invite-vendors-to-portal.mjs.
 * Two copies of a letter signed with somebody's name is how the second one
 * quietly stops sounding like them.
 *
 * Takes the vendor rows rather than one vendor, because several records can
 * share an address and a caterer should not hear from us twice in a minute.
 */

const esc = s => String(s || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

/** "Nate" out of "Nate Clancy, 703-600-9171". Nothing if it holds an address. */
function greetingName(contact) {
  const c = String(contact || '').trim();
  if (!c || c.includes('@')) return '';
  const first = c.split(/[,(]/)[0].trim();
  // A number is not a name, and neither is a whole sentence.
  if (!first || /\d/.test(first) || first.split(/\s+/).length > 3) return '';
  return ` ${esc(first)}`;
}

/**
 * @param {object} opts
 * @param {Array} opts.vendors   one or more vendor rows sharing this address
 * @param {number} opts.weddings how many weddings they have worked here
 * @param {string} opts.portalUrl base URL the /vendor/:token link hangs off
 */
export function vendorInviteEmail({ vendors, weddings = 0, portalUrl }) {
  const many = vendors.length > 1;
  const first = vendors[0];

  const worked = weddings > 1
    ? `You have worked ${weddings} weddings here with us`
    : weddings === 1
      ? 'You have worked a wedding here with us'
      : 'You are on the list of people we recommend to our couples';

  const links = vendors.map(v => `
    <p style="margin: 0 0 10px;">
      ${many ? `<strong style="font-size:14px;">${esc(v.name)}</strong><br>` : ''}
      <a href="${portalUrl}/vendor/${v.edit_token}"
         style="display:inline-block; background:#5C6B4F; color:#ffffff; padding:11px 22px; border-radius:6px; text-decoration:none; font-size:14px;">
        Fill in your profile &rarr;
      </a>
    </p>`).join('');

  const intro = many
    ? `We have you listed ${vendors.length} times, so there are links below, one for each. No password, nothing to sign up for. They open a page`
    : 'The link below is yours. No password, nothing to sign up for. It opens a page';

  return {
    subject: many
      ? 'Your profiles in the Rixey Manor vendor directory'
      : 'Your profile in the Rixey Manor vendor directory',
    html: `
<div style="font-family: Georgia, serif; max-width: 580px; margin: 0 auto; padding: 30px 20px; color: #3d3d3d; background: #fefbf7;">
  <div style="padding-bottom: 16px; margin-bottom: 24px; border-bottom: 2px solid #7C9070;">
    <span style="font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #7C9070;">Rixey Manor</span>
  </div>

  <p style="font-size: 16px; line-height: 1.7; margin: 0 0 18px;">Hello${greetingName(first.contact)},</p>

  <p style="font-size: 16px; line-height: 1.7; margin: 0 0 18px;">
    ${worked}, and every couple who books Rixey can see that recommendation in
    their planning portal. At the moment all it says is your name and a line
    from me. You can say more.
  </p>

  <p style="font-size: 16px; line-height: 1.7; margin: 0 0 18px;">
    ${intro} where you can add a few photos, describe what you do in your own
    words, put in your contact details and say what you are booking. Whatever
    you save goes straight into the directory our couples browse.
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
      Rixey Manor &middot; Rapidan, VA &middot; rixeymanor.com<br>
      If you would rather not be listed, reply to this email and we will take you off.
    </p>
  </div>
</div>`,
  };
}
