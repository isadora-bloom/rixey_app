-- One record per vendor, for every vendor who has worked here.
--
-- `vendors` has only ever meant "vendor we recommend": 110 rows Isadora typed
-- in. What couples actually booked lives in `vendor_checklist`, one row per
-- wedding, with the vendor's name as free text and no link to anything. 176
-- distinct names in there, 136 real vendors once the spellings are collapsed,
-- and only 37 of them match a name in the recommendations.
--
-- So there was no such thing as a vendor. There was a name Isadora typed on a
-- list, and a different name a couple typed on a form, nine times over in
-- Sammy's case, and nothing joining them. You could not ask how many weddings
-- Sammy's has done here, or see the four contracts they have sent, because
-- neither question had a subject.
--
-- This makes the vendor the subject.
--
--   vendors                 every vendor, booked or recommended or both
--   vendors.is_recommended  whether couples see them in the directory
--   vendors.aliases         every spelling seen, so the next import matches
--   vendor_checklist.vendor_id   which vendor that booking was
--
-- Being recommended stops being what a vendor row IS and becomes something a
-- vendor row HAS. All 110 existing rows are recommendations, so they keep it.

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS is_recommended BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS aliases TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS categories TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- Everything already in the table is there because Isadora recommends it.
UPDATE vendors SET is_recommended = true WHERE is_recommended = false;

-- A vendor can be more than one thing, and pretending otherwise loses facts.
-- Carpe Donut is in this table twice, once under Brunch and once under Food
-- Truck, because there was nowhere to say "both". They are also, per Isadora
-- on 26 August, the same company as Rodeo Catering, which makes three. The
-- single `category` stays as the primary one so nothing that reads it breaks;
-- `categories` is what the directory groups on.
UPDATE vendors SET categories = ARRAY[category] WHERE cardinality(categories) = 0 AND category IS NOT NULL;

COMMENT ON COLUMN vendors.is_recommended IS
  'In the couple-facing directory. A vendor who has worked here but is not recommended is still a vendor.';
COMMENT ON COLUMN vendors.aliases IS
  'Other spellings this vendor has been booked under. Sammy''s has nine.';
COMMENT ON COLUMN vendors.categories IS
  'Every category this vendor belongs in. `category` is the primary one and stays in step with the first entry.';
COMMENT ON COLUMN vendors.internal_notes IS
  'Venue-side only. `notes` is shown to couples; this is not.';

-- Alias lookup wants to be an index, not 136 rows scanned per import.
CREATE INDEX IF NOT EXISTS idx_vendors_aliases ON vendors USING GIN (aliases);


-- ── Merging without deleting ────────────────────────────────────────────────
--
-- Carpe Donut is in this table twice. The obvious fix is to delete one, and
-- the obvious fix is wrong: each row carries its own edit_token, and a vendor
-- may be holding a link built from the one that gets deleted. Their link would
-- die with no way to tell them why.
--
-- So a merged row stays. It drops out of the directory and out of the vendor
-- list, and anything arriving on its token is served the row it merged into.

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS merged_into UUID REFERENCES vendors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vendors_merged_into ON vendors(merged_into) WHERE merged_into IS NOT NULL;

COMMENT ON COLUMN vendors.merged_into IS
  'Set when this row turned out to be a duplicate of another vendor. The row is kept so its edit_token still resolves; everything else should follow the pointer.';


-- ── The link ────────────────────────────────────────────────────────────────

ALTER TABLE vendor_checklist
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vendor_checklist_vendor_id ON vendor_checklist(vendor_id);

COMMENT ON COLUMN vendor_checklist.vendor_id IS
  'Which vendor this booking was. Nullable on purpose: a row we cannot place confidently stays unlinked and visible rather than being guessed at.';


-- ── Contracts that do not quietly stop working ──────────────────────────────
--
-- All 101 contracts are stored as Supabase signed URLs, saved into the row
-- with a one-year token baked into them. The earliest dies on 23 February
-- 2027 and the last in August 2027. Nothing would have said so. A couple or
-- Isadora would click a contract next spring and get an error, on a document
-- that is still sitting perfectly safely in the bucket.
--
-- The path is the durable thing. Links get minted on read, short-lived.

ALTER TABLE vendor_checklist
  ADD COLUMN IF NOT EXISTS contract_path TEXT;

COMMENT ON COLUMN vendor_checklist.contract_path IS
  'Object key in the vendor-contracts bucket. The URL in contract_url expires; this does not.';


-- ── Names the matcher is not sure about ─────────────────────────────────────
--
-- "Ivett Beauty Co." and "Ivett Beauty Co" are the same company and can be
-- merged without asking. "Carpe Donut/Rodeo Catering" is two vendors in one
-- field, and "Nate Clancy" is a person who DJs for ImTheDJ, not a misspelling
-- of it. A matcher that cannot tell has to ask rather than guess, so the ones
-- it cannot tell about land here and wait for a human.

CREATE TABLE IF NOT EXISTS public.vendor_merge_review (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id     uuid REFERENCES vendors(id) ON DELETE CASCADE,
  candidate_id  uuid REFERENCES vendors(id) ON DELETE CASCADE,
  reason        text NOT NULL,
  evidence      jsonb NOT NULL DEFAULT '{}'::jsonb,
  status        text NOT NULL DEFAULT 'open',   -- open | merged | separate
  resolved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vendor_merge_review_status_idx
  ON public.vendor_merge_review (status, created_at DESC);

-- The same pair should not queue twice.
CREATE UNIQUE INDEX IF NOT EXISTS vendor_merge_review_pair_idx
  ON public.vendor_merge_review (LEAST(vendor_id, candidate_id), GREATEST(vendor_id, candidate_id));

COMMENT ON TABLE public.vendor_merge_review IS
  'Vendor names that might be the same vendor. Open rows are a question waiting for Isadora, not a backlog of failures.';
