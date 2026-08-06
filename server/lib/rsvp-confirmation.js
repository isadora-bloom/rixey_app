/**
 * Confirmation a guest gets after RSVPing on a wedding website.
 *
 * Deliberately a receipt rather than a thank-you note: it repeats back exactly
 * what was recorded for each person, because a guest with nothing in writing
 * comes back to the site to check, and that is where this all started.
 */
export function rsvpConfirmationHtml({ couple, weddingDate, party, deadline }) {
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const pretty = d => {
    if (!d) return '';
    const dt = new Date(`${d}T00:00:00`);
    return isNaN(dt) ? '' : dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };
  const rows = party.map(p => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #eee6da;font-size:15px;">${esc(p.who)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee6da;font-size:15px;text-align:right;color:#5C6B4F;">
        ${p.status === 'yes' ? 'Attending' : 'Not attending'}${p.status === 'yes' && p.meal ? ` &middot; ${esc(p.meal)}` : ''}
      </td>
    </tr>`).join('');
  const anyAttending = party.some(p => p.status === 'yes');
  return `
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; padding: 30px 20px; color: #3d3d3d; background: #fefbf7;">
      <div style="padding-bottom: 16px; margin-bottom: 24px; border-bottom: 2px solid #7C9070;">
        <span style="font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #7C9070;">Rixey Manor</span>
      </div>
      <p style="font-size:16px;line-height:1.7;margin:0 0 20px;">
        ${anyAttending ? 'Thank you, we have you down.' : 'Thank you for letting us know.'}
        This is what was recorded for ${esc(couple)}${weddingDate ? `, ${esc(pretty(weddingDate))}` : ''}.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">${rows}</table>
      <p style="font-size:13px;line-height:1.6;color:#777;margin:0;">
        Need to change something? Go back to the wedding website and search your name again${deadline ? ` before ${esc(pretty(deadline))}` : ''}.
        If anything above looks wrong, reply to this email and we will sort it out.
      </p>
      <div style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #e8e0d5;">
        <p style="font-size: 12px; color: #999; margin: 0;">Rapidan, VA &middot; rixeymanor.com</p>
      </div>
    </div>`;
}
