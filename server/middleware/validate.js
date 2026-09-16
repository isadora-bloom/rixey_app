/**
 * Middleware factory: Strip req.body down to only allowed fields.
 * Returns 400 if body is empty after stripping.
 *
 * Usage: app.post('/api/foo', validateBody(['name', 'email']), handler)
 *
 * A field sent that is not in `allowedFields` used to disappear with nothing
 * said — a typo'd key, a client sending a field this route dropped a version
 * ago, or a couple's browser still running old cached JS all looked exactly
 * like success. `req.ignoredFields` carries the names through to whatever
 * runs next (for logging, mainly); the 400 case names them too, since an
 * empty body after stripping is far more useful to debug when it says what
 * got thrown away and not just what would have been kept.
 */
export function validateBody(allowedFields) {
  return (req, res, next) => {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Request body is required' });
    }

    const cleaned = {};
    const ignored = [];
    for (const [field, value] of Object.entries(req.body)) {
      if (value === undefined) continue;
      if (allowedFields.includes(field)) cleaned[field] = value;
      else ignored.push(field);
    }

    if (Object.keys(cleaned).length === 0) {
      return res.status(400).json({
        error: 'No valid fields provided',
        allowed: allowedFields,
        ignored,
      });
    }

    req.body = cleaned;
    req.ignoredFields = ignored;
    next();
  };
}
