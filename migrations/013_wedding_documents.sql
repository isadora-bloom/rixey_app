-- Planning documents a couple or planner sends in, and what we read out of them.
--
-- Every wedding arrives with paperwork nobody can act on: a 53-page planner
-- deck, a spreadsheet with ten tabs and no two the same. Alyssa & Brett's PDF
-- names twelve people with dietary restrictions; the portal's allergy registry
-- has eleven of them. Rachel Hill (mushrooms) and Katie Taylor (no meat) are
-- in the document and not on the kitchen sheet, five weeks out.
--
-- So this is a diff problem, not an import problem. The portal is usually
-- mostly right, and what matters is the handful of things it is missing or
-- disagrees with. The existing sheet-diff machinery already does exactly that
-- for Google Sheets — DiffEntry, the apply ops, the review grid, the audit log
-- — so this stores documents in a shape that can feed it.
--
-- Versioned on purpose. Re-uploading a revised plan should show what the
-- planner changed since last time, separately from what differs from the
-- portal. text_hash makes "this is the same file again" free to detect.
--
-- No BEGIN/COMMIT: Supabase runs migrations in its own transaction.

CREATE TABLE IF NOT EXISTS wedding_documents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id     uuid NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  filename       text NOT NULL,
  kind           text NOT NULL DEFAULT 'other',   -- pdf | xlsx | docx | other
  storage_path   text,
  byte_size      integer,

  -- What we pulled out, kept verbatim. The parser reads this, never the file,
  -- so a better parser can be re-run over old uploads without the original.
  extracted_text text,
  -- sha256 of extracted_text. Same hash means the same document, whatever the
  -- filename says, so re-uploading an unchanged file is a no-op we can spot.
  text_hash      text,
  page_count     integer,

  -- The AI's structured read: { dietary: [...], vendors: [...], bedrooms: [...] }.
  -- Null until parsed. Stored so a diff can be rebuilt without paying for the
  -- extraction twice.
  sections       jsonb,
  parsed_at      timestamptz,
  parse_error    text,

  version        integer NOT NULL DEFAULT 1,
  supersedes_id  uuid REFERENCES wedding_documents(id) ON DELETE SET NULL,

  uploaded_by    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wedding_documents_wedding_idx
  ON wedding_documents (wedding_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wedding_documents_hash_idx
  ON wedding_documents (wedding_id, text_hash);

COMMENT ON TABLE wedding_documents IS
  'Uploaded planning documents, versioned. extracted_text is the source of truth for parsing; the original file is kept for provenance only.';
COMMENT ON COLUMN wedding_documents.text_hash IS
  'sha256 of extracted_text. Identical hash means the same document content, so a re-upload can be recognised rather than re-parsed.';
COMMENT ON COLUMN wedding_documents.sections IS
  'The structured read of the document. Rebuilt by re-parsing; never edited by hand.';

ALTER TABLE wedding_documents ENABLE ROW LEVEL SECURITY;
