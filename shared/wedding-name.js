/**
 * What to call a wedding.
 *
 * There are three places a name can live and four screens that each picked a
 * different one. The admin inbox read `couple_names` alone, so Anisa & Austin
 * and Megan and Robert showed as "Unknown Couple" through twelve messages,
 * despite both being live weddings with linked profiles and a name sitting in
 * `project_name` the whole time. Nothing was unknown. One field was empty and
 * one screen only knew about that field.
 *
 * The order is deliberate. `project_name` is what Rixey chose to call this
 * workspace, so it wins where it is set; `couple_names` is what the couple are
 * called; the partner names are the last thing to assemble from.
 *
 * "Unknown" is the answer of last resort and should be rare enough to be worth
 * chasing when it appears.
 */

export function weddingName(wedding, fallback = 'Unknown') {
  if (!wedding) return fallback;

  const trim = v => (typeof v === 'string' ? v.trim() : '');

  const project = trim(wedding.project_name);
  if (project) return project;

  const couple = trim(wedding.couple_names);
  if (couple) return couple;

  const partners = [trim(wedding.partner1_name), trim(wedding.partner2_name)].filter(Boolean);
  if (partners.length) return partners.join(' and ');

  // A date is not a name, but it identifies the wedding to anyone who works
  // here, which "Unknown" does not.
  const date = trim(wedding.wedding_date);
  if (date) return `Wedding on ${date}`;

  return fallback;
}

/** The couple's own name, for anything shown TO them. Never the workspace label. */
export function coupleName(wedding, fallback = 'you') {
  if (!wedding) return fallback;
  const trim = v => (typeof v === 'string' ? v.trim() : '');
  const couple = trim(wedding.couple_names);
  if (couple) return couple;
  const partners = [trim(wedding.partner1_name), trim(wedding.partner2_name)].filter(Boolean);
  return partners.length ? partners.join(' and ') : fallback;
}
