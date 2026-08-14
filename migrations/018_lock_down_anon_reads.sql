-- Stop the public key reading the whole database.
--
-- VITE_SUPABASE_ANON_KEY ships inside the JavaScript bundle. It is not a
-- secret and was never meant to be one — it is only safe if the database
-- refuses to answer it. Ours answers almost everything: 31 of 61 tables are
-- readable by anyone who opens the site and copies the key out of the source.
--
-- Including, worst of all:
--
--   gmail_tokens   the venue's Gmail OAuth refresh token
--   zoom_tokens    the venue's Zoom OAuth refresh token
--
-- A refresh token is durable access to that mailbox. Everything else on this
-- list is a privacy problem; those two are an account takeover.
--
-- Then 13,601 planning notes, 1,247 processed emails, 1,362 texts, 91
-- contracts, 40 direct messages, every couple's budget, and the rest.
--
-- ## Why REVOKE rather than only RLS
--
-- Supabase grants ALL on public tables to anon and authenticated by default,
-- and RLS is what is supposed to hold the line. Enabling RLS alone leaves the
-- grant in place, so a policy added carelessly later re-opens everything. A
-- revoked privilege cannot be re-opened by a policy.
--
-- Both roles are revoked, not just anon: a signed-in couple's browser uses the
-- same key with the `authenticated` role, and none of these tables is queried
-- from the browser at all. Verified before writing this — zero direct client
-- references to any of them, and no realtime subscriptions. Every one is
-- reached through the server, which uses the service-role key and is
-- unaffected by grants to anon or authenticated.
--
-- ## Deliberately NOT in this list
--
--   vendors, accommodations   read directly by the public directory and
--                             accommodations pages, so they must stay readable
--   weddings                  sign-up looks a wedding up by event code with
--                             the anon key before the user has an account.
--                             Locking it now would break account creation, so
--                             that lookup moves server-side first. It leaks all
--                             47 event codes today and is the next job.
--   profiles                  already policy-protected, and column privileges
--                             were tightened in migration 014
--
-- No BEGIN/COMMIT: Supabase runs migrations in its own transaction.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    -- Credentials. These two are the reason this migration is urgent.
    'gmail_tokens', 'zoom_tokens',
    -- Everything a couple has ever written or been sent
    'planning_notes', 'planning_checklist', 'direct_messages', 'notifications',
    'contracts', 'uncertain_questions', 'onboarding_progress', 'couple_photos',
    -- Ingested correspondence
    'processed_emails', 'processed_quo_messages', 'processed_zoom_meetings',
    -- Planning detail
    'vendor_checklist', 'bar_shopping_list', 'bar_recipes', 'inspo_gallery',
    'wedding_borrow_selections', 'wedding_timeline', 'wedding_tables',
    'wedding_staffing', 'table_layouts', 'wedding_budget',
    -- Venue-side
    'storefront_items', 'manor_assets', 'usage_logs', 'activity_log'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
      EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', t);
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

COMMENT ON TABLE gmail_tokens IS
  'OAuth credentials for the venue mailbox. Service role only — anon and authenticated hold no privileges. Never expose through a client-reachable path.';
COMMENT ON TABLE zoom_tokens IS
  'OAuth credentials for the venue Zoom account. Service role only, as above.';

-- After running, this should return no rows:
--   SELECT table_name, grantee, privilege_type
--   FROM information_schema.role_table_grants
--   WHERE table_schema = 'public'
--     AND grantee IN ('anon','authenticated')
--     AND table_name IN ('gmail_tokens','zoom_tokens','planning_notes','contracts');
