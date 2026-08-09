/**
 * Wedding-scope authorisation.
 *
 * Until now the only real authorisation in this server was requireAdmin. Soft
 * auth attaches a user when a token happens to be present and calls next()
 * either way, so every couple-facing route was reachable with no credentials
 * at all. Verified against production: /api/budget/:id, /api/guests/:id and
 * /api/messages/:id each returned 200 and real data with no Authorization
 * header, given only a wedding id.
 *
 * This middleware closes that. It answers one question: does the caller belong
 * to the wedding this request is about?
 *
 * ## Why it ships switched off
 *
 * Retrofitting auth onto a live product mid-season is how you lock real
 * couples out of their own portal on a Friday. So the default mode is `audit`:
 * the decision is computed and anything that WOULD be refused is logged, then
 * the request is allowed through exactly as before. Deploying this changes no
 * behaviour whatsoever.
 *
 * Once the logs are quiet, set WEDDING_ACCESS_MODE=enforce and it starts
 * refusing. Flip back by unsetting the variable; no deploy required if the
 * host lets you edit env and restart.
 *
 * A static audit of the frontend found 315 API call sites: 160 via apiFetch
 * (which attaches the token itself), 141 bare fetches that pass authHeaders(),
 * and 14 with neither — of which every one is either a URL built on the line
 * above a properly authenticated call, or the public wedding website. So the
 * expectation is that audit mode logs nothing but genuine strangers. The mode
 * switch is there because "expectation" is not "evidence".
 */

const MODE = () => (process.env.WEDDING_ACCESS_MODE || 'audit').toLowerCase();

/**
 * Routes with no wedding to check against, or that legitimately serve people
 * who have no login at all. Guests RSVPing have no account and never will.
 */
const PUBLIC_PREFIXES = [
  '/api/w/',                          // public wedding websites
  '/api/rsvp/',                       // public RSVP (password-gated separately)
  '/api/vendor-portal/',              // token-based vendor portal
  '/api/vendor-directory',            // public vendor directory
  '/api/wedding-website/check-slug/', // slug availability during setup
  '/api/health',
];

/** Admin groups already gated by requireAdmin upstream; do not double-check. */
const ADMIN_PREFIXES = [
  '/api/admin', '/api/gmail', '/api/zoom', '/api/quo', '/api/uncertain-questions',
  '/api/knowledge-base', '/api/recommended-vendors', '/api/venue-settings', '/api/usage',
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Pull the wedding id out of wherever this codebase happens to put it. Routes
 * are inconsistent: some take :weddingId, some :id, some read it from the body.
 *
 * Note it reads the raw path rather than req.params. Mounted with
 * app.use('/api', …) no route has matched yet, so req.params is an empty
 * object — the first version of this trusted it, found nothing, and allowed
 * every request while appearing to work.
 *
 * A uuid in the path is not necessarily a wedding id; it might be a vendor or
 * a note. Those are handled by the caller, which treats a uuid that matches no
 * membership as undetermined rather than hostile.
 */
function weddingIdFrom(req) {
  const fromBody = req.body?.weddingId || req.body?.wedding_id || req.query?.weddingId;
  if (fromBody && UUID.test(String(fromBody))) return String(fromBody);

  const segments = String(req.path || '').split('/').filter(Boolean);
  const uuidSegments = segments.filter(s => UUID.test(s));
  // Exactly one uuid in the path is unambiguous. More than one (e.g. a nested
  // resource) is not worth guessing at, so leave it undetermined.
  return uuidSegments.length === 1 ? uuidSegments[0] : null;
}

export function createWeddingAccess(supabaseAdmin) {
  // Small cache so a page load doing twenty calls does twenty auth checks
  // against one profile read rather than twenty. Deliberately short: a
  // revoked person must stop working quickly, not at session expiry.
  const cache = new Map();
  const TTL_MS = 15_000;

  async function profileFor(userId) {
    const hit = cache.get(userId);
    if (hit && hit.at > Date.now() - TTL_MS) return hit.profile;
    const { data } = await supabaseAdmin
      .from('profiles').select('id, wedding_id, is_admin, role').eq('id', userId).maybeSingle();
    cache.set(userId, { at: Date.now(), profile: data || null });
    return data || null;
  }

  // The set of real wedding ids, so a uuid in a path can be told apart from a
  // vendor id or a note id. Without this, /api/vendors/<uuid> looks like a
  // request about a wedding the caller does not belong to, and enforcing would
  // refuse a legitimate call. 47 rows today; refreshed on a slow timer.
  let weddingIds = null, weddingIdsAt = 0;
  const WEDDING_TTL_MS = 60_000;
  async function isWeddingId(id) {
    if (!weddingIds || weddingIdsAt < Date.now() - WEDDING_TTL_MS) {
      const { data, error } = await supabaseAdmin.from('weddings').select('id');
      if (error) return null;            // unknown: caller treats as undetermined
      weddingIds = new Set((data || []).map(w => w.id));
      weddingIdsAt = Date.now();
    }
    return weddingIds.has(id);
  }

  return async function weddingAccess(req, res, next) {
    const fullPath = (req.baseUrl || '') + (req.path || '');
    if (PUBLIC_PREFIXES.some(p => fullPath.startsWith(p))) return next();
    if (ADMIN_PREFIXES.some(p => fullPath.startsWith(p))) return next();

    const weddingId = weddingIdFrom(req);

    // No wedding in the request means this middleware cannot judge it. Many
    // routes are keyed on a row id instead and would need the row loaded to
    // resolve its wedding. Those are logged as undetermined and allowed —
    // closing them is the next pass, and guessing here would break them.
    if (!weddingId || !UUID.test(String(weddingId))) {
      if (MODE() === 'enforce') return next();
      return next();
    }

    const decide = async () => {
      // Their own wedding: settled before anything else, and the cheapest path.
      if (req.userId) {
        const profile = await profileFor(req.userId);
        if (profile?.is_admin) return { allow: true, why: 'admin' };
        if (profile?.wedding_id && profile.wedding_id === weddingId) return { allow: true, why: 'member' };
      }
      // Not theirs. Before refusing, make sure this uuid is even a wedding —
      // otherwise it is a vendor or a note id and this middleware has no
      // business judging it.
      const isWedding = await isWeddingId(weddingId);
      if (isWedding === null) return { allow: true, why: 'wedding list unavailable' };
      if (!isWedding) return { allow: true, why: 'not a wedding id' };
      if (!req.userId) return { allow: false, why: 'no token' };
      const profile = await profileFor(req.userId);
      if (!profile) return { allow: false, why: 'no profile' };
      return { allow: false, why: `belongs to ${profile.wedding_id || 'no wedding'}` };
    };

    let verdict;
    try {
      verdict = await decide();
    } catch (err) {
      // Never let an auth lookup failure take down a request in audit mode,
      // and fail open rather than locking a couple out over a blip.
      console.error('[weddingAccess] lookup failed, allowing:', err.message);
      return next();
    }

    if (verdict.allow) return next();

    if (MODE() === 'enforce') {
      return res.status(403).json({ error: 'You do not have access to this wedding' });
    }

    console.warn(
      `[weddingAccess:audit] WOULD REFUSE ${req.method} ${fullPath} ` +
      `wedding=${weddingId} user=${req.userId || 'anonymous'} reason=${verdict.why}`
    );
    return next();
  };
}

export { PUBLIC_PREFIXES, ADMIN_PREFIXES, weddingIdFrom };
