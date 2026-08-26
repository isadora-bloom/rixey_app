-- Close the three vendor tables that anyone can still read.
--
-- Migration 018 locked down twenty-six tables and deliberately left `vendors`
-- open, with a note saying why: "read directly by the public directory". That
-- was true. The couple-facing page queried the table from the browser with the
-- anon key, so revoking the grant would have emptied it.
--
-- It is not true any more. That page was deleted on 26 August when the two
-- vendor directories were merged into one, and the surviving directory reads
-- through the API on the service-role key. Nothing in any browser touches this
-- table. The exemption outlived its reason, which is the usual way an
-- exemption becomes a hole.
--
-- Meanwhile the table grew. In August it gained email, phone, internal_notes
-- and, in an earlier round, edit_token. That last one is the entire security
-- model of a vendor profile: no password, no account, the link IS the
-- credential. It has been selectable with the anon key, which ships inside
-- every copy of the front end, since the vendor portal was built.
--
-- The other two are mine, from this week, created without RLS at all:
--
--   vendor_merge_review        which vendors might be the same vendor
--   vendor_contact_evidence    every phone number and address held for a
--                              vendor, with where it came from. A list of
--                              other people's business contact details, which
--                              is not ours to leave lying in the road.
--
-- Both roles are revoked, not only anon: a signed-in couple's browser uses the
-- same key with the `authenticated` role, and none of these three is queried
-- from a browser. Checked before writing this. The API is unaffected, since
-- the service-role key ignores grants.
--
-- No BEGIN/COMMIT: Supabase runs migrations in its own transaction.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'vendors',
    'vendor_merge_review',
    'vendor_contact_evidence'
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

COMMENT ON TABLE vendors IS
  'Venue-side. Reached only through the API. What couples see is the filtered subset returned by /api/vendor-directory, and what a vendor sees is their own row via /api/vendor-portal/:token. Neither reads this table from a browser.';
COMMENT ON COLUMN vendors.edit_token IS
  'The whole of the security on a vendor profile: no password, no account, the link is the credential. Never expose this on a couple-facing or public response.';
COMMENT ON TABLE vendor_contact_evidence IS
  'Third-party business contact details. Venue-side only.';
