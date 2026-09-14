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

// Enforcing by default now. It shipped in audit mode so a live season could
// not be broken by a retrofit, and the one thing that would have caused false
// refusals — apiFetch losing its token to a gotrue lock timeout and sending no
// Authorization header at all — has been fixed separately by caching the token.
//
// Set WEDDING_ACCESS_MODE=audit to go back to log-only without a deploy, if
// something legitimate turns out to be refused.
// Anything other than the one word 'audit' enforces. The example env file
// shipped 'production_or_test' for a while, and a typo here must not turn
// authorisation off across forty routes.
const MODE = () => (String(process.env.WEDDING_ACCESS_MODE || '').toLowerCase() === 'audit' ? 'audit' : 'enforce');

/**
 * Routes with no wedding to check against, or that legitimately serve people
 * who have no login at all. Guests RSVPing have no account and never will.
 */
const PUBLIC_PREFIXES = [
  '/api/w/',                          // public wedding websites
  '/api/rsvp/',                       // public RSVP (password-gated separately)
  '/api/vendor-portal/',              // token-based vendor portal
  '/api/vendor-directory',            // not about any one wedding; signed-in check is mounted separately
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
 * Routes keyed on a row id rather than a wedding id.
 *
 * 36 write routes took `/api/thing/:id` and edited or deleted that row without
 * ever asking whose wedding it belonged to. A couple with any valid uuid could
 * change another couple's guests, allergies, ceremony order or planning notes.
 * The id is not a secret — they appear in API responses all over the app.
 *
 * Mapping the path to its table lets the row be loaded, its wedding_id read,
 * and the same membership rule applied as everywhere else. One place, rather
 * than 36 hand-written checks that would drift.
 */
const ROW_TABLES = {
  'vendors': 'vendor_checklist',
  'inspo': 'inspo_gallery',
  'checklist': 'planning_checklist',
  'planning-notes': 'planning_notes',
  'internal-notes': 'wedding_internal_notes',
  'allergies': 'allergy_registry',
  'bedrooms': 'bedroom_assignments',
  'ceremony-order': 'ceremony_order',
  'decor': 'decor_inventory',
  'makeup': 'makeup_schedule',
  'shuttle': 'shuttle_schedule',
  'guests': 'wedding_guests',
  'guest-tags': 'guest_tag_options',
  'meal-options': 'guest_meal_options',
  'bar-shopping': 'bar_shopping_list',
  'bar-recipes': 'bar_recipes',
  'day-of-media': 'day_of_media',
  'wedding-party': 'wedding_party',
  // PUT and DELETE /api/wedding-photos/:photoId edit a row by its own id and
  // were missing from this map, so neither one was ever scoped to a wedding.
  'wedding-photos': 'wedding_photos',
};

/** `/api/<thing>/<uuid>` → { table, id }, when <thing> is one we can resolve. */
function rowLookupFor(path) {
  const parts = String(path || '').split('/').filter(Boolean);
  // req.path is relative to the /api mount, so parts[0] is the resource.
  const [resource, id] = parts;
  if (!resource || !id || !UUID.test(id)) return null;
  // The wedding itself: the id in the path is the wedding id.
  if (resource === 'weddings') return { weddingId: id };
  const table = ROW_TABLES[resource];
  return table ? { table, id } : null;
}

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
 *
 * Only consulted for routes with no row mapping, e.g. POST /api/guests, where
 * the body is the only statement of which wedding the new row belongs to. Once
 * rowLookupFor matches, the row wins and this is not called at all.
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
    const { data, error } = await supabaseAdmin
      .from('profiles').select('id, wedding_id, is_admin, role').eq('id', userId).maybeSingle();
    // A failed read used to be cached as "no profile" for fifteen seconds, so
    // one blip locked a real couple out for the rest of that window and there
    // was nothing in the logs to say why. Throw instead: the caller decides,
    // and nothing wrong gets remembered.
    if (error) throw new Error(`profile read failed: ${error.message}`);
    cache.set(userId, { at: Date.now(), profile: data || null });
    return data || null;
  }

  // The set of real wedding ids, so a uuid in a path can be told apart from a
  // vendor id or a note id. Without this, /api/vendors/<uuid> looks like a
  // request about a wedding the caller does not belong to, and enforcing would
  // refuse a legitimate call. 47 rows today; refreshed on a slow timer.
  let weddingIds = null, weddingIdsAt = 0;
  const WEDDING_TTL_MS = 60_000;
  // A miss refreshes the list before it is believed, with a short cooldown so
  // a stream of garbage uuids cannot turn into a stream of table scans. Found
  // by the smoke test: a wedding created after the list was cached read as
  // "not a wedding" for up to a minute, and "not a wedding" means allow.
  const MISS_COOLDOWN_MS = 5_000;
  async function refreshWeddingIds() {
    const { data, error } = await supabaseAdmin.from('weddings').select('id');
    if (error) return false;
    weddingIds = new Set((data || []).map(w => w.id));
    weddingIdsAt = Date.now();
    return true;
  }
  async function isWeddingId(id) {
    if (!weddingIds || weddingIdsAt < Date.now() - WEDDING_TTL_MS) {
      if (!(await refreshWeddingIds())) return null;   // unknown: caller treats as undetermined
    }
    if (weddingIds.has(id)) return true;
    if (weddingIdsAt < Date.now() - MISS_COOLDOWN_MS) {
      if (!(await refreshWeddingIds())) return null;
      return weddingIds.has(id);
    }
    return false;
  }

  return async function weddingAccess(req, res, next) {
    const fullPath = (req.baseUrl || '') + (req.path || '');
    if (PUBLIC_PREFIXES.some(p => fullPath.startsWith(p))) return next();
    if (ADMIN_PREFIXES.some(p => fullPath.startsWith(p))) return next();

    // A lookup we could not complete. In audit mode it carries on as before; in
    // enforce mode it stops the request, because the alternative is that a
    // database blip silently turns authorisation off for as long as it lasts.
    const unavailable = (why, err) => {
      console.error(`[weddingAccess] ${why} on ${req.method} ${fullPath}: ${err?.message || err}`);
      if (MODE() === 'enforce') {
        return res.status(503).json({ error: 'access check unavailable' });
      }
      return next();
    };

    // Work out which wedding this request is about, in order of certainty.
    //
    // The ROW comes first and body/query are not consulted at all once a row
    // route matches. That order is the whole fix: this used to take a wedding
    // id out of the body or query string in preference to the row actually
    // being edited, so a couple could send
    // PUT /api/guests/<another couple's guest id>?weddingId=<their own>
    // and the check passed on their own wedding while the write landed on
    // someone else's guest. What a request SAYS it is about is never evidence.
    //
    // Most of these resources serve two route shapes on the same prefix:
    // GET /api/guests/:weddingId lists, PUT /api/guests/:id edits one row. So a
    // uuid sitting after a mapped resource is looked up as a row first and
    // falls back to "is it a wedding" only when no such row exists. A uuid is
    // never both.
    let weddingId = null;

    const lookup = rowLookupFor(req.path);

    if (lookup?.weddingId) {
      weddingId = lookup.weddingId;               // /api/weddings/:id/...
    } else if (lookup?.table) {
      let row;
      try {
        const { data, error } = await supabaseAdmin
          .from(lookup.table).select('wedding_id').eq('id', lookup.id).maybeSingle();
        if (error) return unavailable('row lookup failed', error);
        row = data;
      } catch (err) {
        return unavailable('row lookup threw', err);
      }
      if (row?.wedding_id) {
        weddingId = row.wedding_id;
      } else {
        // No such row. Either the list-by-wedding shape of the same route, or
        // a row that genuinely does not exist — which is the route's own 404
        // to give, not ours.
        const known = await isWeddingId(lookup.id);
        if (known === null) return unavailable('weddings read failed', new Error('could not list weddings'));
        if (!known) return next();
        weddingId = lookup.id;
      }
    } else {
      // No row mapping for this route, so the request's own statement of which
      // wedding it concerns is all there is. Confirm it names a real wedding.
      const stated = weddingIdFrom(req);
      if (!stated || !UUID.test(String(stated))) return next();
      const known = await isWeddingId(stated);
      if (known === null) return unavailable('weddings read failed', new Error('could not list weddings'));
      if (!known) {
        // A uuid we cannot attribute to any wedding, on a route we have no
        // mapping for. Logged so the gap is visible rather than silent.
        if (MODE() !== 'enforce') {
          console.warn(`[weddingAccess:audit] unresolved uuid on ${req.method} ${fullPath}`);
        }
        return next();
      }
      weddingId = stated;
    }

    const decide = async () => {
      // Their own wedding: settled before anything else, and the cheapest path.
      if (req.userId) {
        const profile = await profileFor(req.userId);
        if (profile?.is_admin) return { allow: true, why: 'admin' };
        if (profile?.wedding_id && profile.wedding_id === weddingId) return { allow: true, why: 'member' };
      }
      // weddingId is already known to be a real wedding by this point — it was
      // either confirmed against the wedding list or read off the row itself.
      if (!req.userId) return { allow: false, why: 'no token' };
      const profile = await profileFor(req.userId);
      if (!profile) return { allow: false, why: 'no profile' };
      return { allow: false, why: `belongs to ${profile.wedding_id || 'no wedding'}` };
    };

    let verdict;
    try {
      verdict = await decide();
    } catch (err) {
      // This used to fail open, on the reasoning that a blip should not lock a
      // couple out. But failing open means a blip switches authorisation off
      // for everybody at once, and nothing says so. 503 is honest and the
      // client retries.
      return unavailable('membership lookup failed', err);
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

/**
 * Is this caller a member of this wedding, or an admin? Ask once, directly.
 *
 * The middleware above cannot answer this for a multipart route. It is mounted
 * on /api and therefore runs before multer, and on a multipart/form-data
 * request req.body is still an empty object at that point — so every one of
 * /api/seating/import, /api/extract-contract, /api/inspo and /api/couple-photo
 * looked to it like a request about no wedding at all, and sailed through.
 *
 * Those four handlers call this by hand on the line after multer has populated
 * req.body, which is the first moment the wedding id exists.
 *
 * Returns { ok, status, why } rather than sending, so the caller keeps its own
 * response shape.
 */
export async function assertWeddingMember(supabaseAdmin, req, weddingId) {
  if (!req?.userId) return { ok: false, status: 401, why: 'no token' };
  if (!weddingId || !UUID.test(String(weddingId))) {
    return { ok: false, status: 403, why: 'no wedding named' };
  }

  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('id, wedding_id, is_admin')
    .eq('id', req.userId)
    .maybeSingle();

  if (error) return { ok: false, status: 503, why: 'access check unavailable' };
  if (!profile) return { ok: false, status: 403, why: 'no profile' };
  if (profile.is_admin) return { ok: true, status: 200, why: 'admin' };
  if (profile.wedding_id && profile.wedding_id === String(weddingId)) {
    return { ok: true, status: 200, why: 'member' };
  }
  return { ok: false, status: 403, why: `belongs to ${profile.wedding_id || 'no wedding'}` };
}

export { PUBLIC_PREFIXES, ADMIN_PREFIXES, ROW_TABLES, weddingIdFrom, rowLookupFor };
