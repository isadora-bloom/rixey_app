-- Where a vendor's phone number came from.
--
-- Rixey already holds contact detail for most of these vendors. It is just
-- scattered, in three places, none of which is the vendor record:
--
--   vendor_checklist.vendor_contact   127 bookings, whatever the couple typed
--   wedding_documents.sections        planning docs, often name + email +
--                                     phone + website in one string
--   planning_notes (vendor_contact)   371 lines Claude pulled out of contracts
--
-- Copying the best-looking one onto vendors.email and calling it done would be
-- wrong twice over. It throws away the other three, which is what you want
-- when the first one bounces. And it makes a guess look like a fact, on a
-- table where 111 of those extracted lines are the COUPLE's phone and email
-- rather than the vendor's, because a contract has both on it.
--
-- So every detail found is kept as evidence, with its source, and the vendor
-- record points at the one being used. When Isadora sees a number she can see
-- where it came from and how many places said the same thing.

CREATE TABLE IF NOT EXISTS public.vendor_contact_evidence (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id      uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  kind           text NOT NULL,     -- email | phone | website | instagram | person
  value          text NOT NULL,     -- as written
  value_key      text NOT NULL,     -- normalised, so one number written four ways is one row
  source         text NOT NULL,     -- booking | document | contract_note
  source_detail  text,              -- which booking, which document, which contract
  wedding_id     uuid REFERENCES weddings(id) ON DELETE SET NULL,
  seen_count     integer NOT NULL DEFAULT 1,
  dismissed      boolean NOT NULL DEFAULT false,
  first_seen     timestamptz NOT NULL DEFAULT now(),
  last_seen      timestamptz NOT NULL DEFAULT now()
);

-- The same detail from the same kind of source is one row with a count on it,
-- not five rows. Four weddings all listing the same number is the strongest
-- signal there is that it is the right number, and that only reads if it is
-- counted rather than repeated.
CREATE UNIQUE INDEX IF NOT EXISTS vendor_contact_evidence_unique
  ON public.vendor_contact_evidence (vendor_id, kind, value_key);

CREATE INDEX IF NOT EXISTS vendor_contact_evidence_vendor_idx
  ON public.vendor_contact_evidence (vendor_id, kind);

COMMENT ON TABLE public.vendor_contact_evidence IS
  'Every contact detail seen for a vendor, with where it was seen. vendors.email and friends hold the one in use; this holds the rest and the provenance.';
COMMENT ON COLUMN public.vendor_contact_evidence.value_key IS
  'Phones to their last ten digits, emails and sites lowercased. Two spellings of one number must not read as two numbers.';
COMMENT ON COLUMN public.vendor_contact_evidence.seen_count IS
  'How many separate places said this. Four bookings agreeing is worth more than one contract.';
COMMENT ON COLUMN public.vendor_contact_evidence.dismissed IS
  'Isadora said this one is wrong. Kept rather than deleted so the next import does not offer it again.';
