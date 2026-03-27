import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

/**
 * Middleware: Verify Supabase JWT and attach user to request.
 * Returns 401 if no valid token is provided.
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.slice(7);
  if (!token || token === 'undefined' || token === 'null') {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    req.userId = user.id;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * Middleware: Verify the user is an admin.
 * Chains requireAuth internally.
 */
export async function requireAdmin(req, res, next) {
  requireAuth(req, res, async () => {
    try {
      const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('is_admin')
        .eq('id', req.userId)
        .single();

      if (error || !profile?.is_admin) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      req.isAdmin = true;
      next();
    } catch (err) {
      console.error('Admin check error:', err);
      return res.status(403).json({ error: 'Admin verification failed' });
    }
  });
}

/**
 * Middleware: Try to authenticate but don't block if no token.
 * Useful for routes that work for both authenticated and anonymous users.
 */
export async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.slice(7);
  if (!token || token === 'undefined' || token === 'null') {
    return next();
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user) {
      req.user = user;
      req.userId = user.id;
    }
  } catch {
    // Silently continue — auth is optional
  }
  next();
}
