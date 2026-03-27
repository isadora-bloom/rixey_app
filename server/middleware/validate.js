/**
 * Middleware factory: Strip req.body down to only allowed fields.
 * Returns 400 if body is empty after stripping.
 *
 * Usage: app.post('/api/foo', validateBody(['name', 'email']), handler)
 */
export function validateBody(allowedFields) {
  return (req, res, next) => {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Request body is required' });
    }

    const cleaned = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        cleaned[field] = req.body[field];
      }
    }

    if (Object.keys(cleaned).length === 0) {
      return res.status(400).json({
        error: 'No valid fields provided',
        allowed: allowedFields
      });
    }

    req.body = cleaned;
    next();
  };
}
