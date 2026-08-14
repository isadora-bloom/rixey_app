-- Stop a logged-in user editing their own is_admin.
--
-- profiles has an RLS policy "Users update own profile" for the authenticated
-- role, which is correct and necessary — someone has to be able to change
-- their own name. The problem is that **Postgres RLS cannot restrict which
-- columns an UPDATE touches.** A policy that says "this row is yours" says
-- nothing about which fields of it you may write.
--
-- is_admin, role and wedding_id all live on that same row. So the policy that
-- lets someone fix a typo in their name also lets them, from the browser
-- console with the anon key that ships in the bundle:
--
--   supabase.from('profiles').update({ is_admin: true }).eq('id', myId)
--
-- ...which grants them every admin route in the system, since requireAdmin
-- reads exactly that column.
--
-- Column privileges are the right tool, because unlike RLS they are per
-- column. Table-level UPDATE is withdrawn and granted back only for the two
-- fields the application actually writes.
--
-- Checked before writing this: the only client-side UPDATE to profiles in the
-- whole frontend is src/pages/Dashboard.jsx:703, which sets name and phone.
-- Sign-up and wedding creation use INSERT, which this does not touch. The
-- server writes with the service-role key, which is unaffected by grants to
-- `authenticated`. So nothing legitimate breaks.
--
-- No BEGIN/COMMIT: Supabase runs migrations in its own transaction.

-- Blanket UPDATE first: a table-level grant covers every column, so granting
-- specific columns on top of it would achieve nothing.
REVOKE UPDATE ON public.profiles FROM authenticated;
REVOKE UPDATE ON public.profiles FROM anon;

-- Exactly what the profile editor writes, and nothing else.
GRANT UPDATE (name, phone) ON public.profiles TO authenticated;

COMMENT ON COLUMN public.profiles.is_admin IS
  'Grants every admin route. Writable only by the service role — authenticated users hold no UPDATE privilege on this column, because RLS alone cannot stop a user editing it on their own row. See migrations/014.';
COMMENT ON COLUMN public.profiles.wedding_id IS
  'Which wedding this person can see. Writable only by the service role; a user must not be able to move themselves into another couple''s wedding.';

-- After running, this should show only name and phone:
--   SELECT column_name, privilege_type
--   FROM information_schema.column_privileges
--   WHERE table_name = 'profiles' AND grantee = 'authenticated' AND privilege_type = 'UPDATE'
--   ORDER BY column_name;
