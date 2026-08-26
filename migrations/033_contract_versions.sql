-- A contract that arrives twice is one contract, not two.
--
-- `contracts` has six columns: wedding, filename, file type, extracted text,
-- and when it landed. There is no vendor on it and no notion of a version, so
-- every upload is a new and unrelated document. Sarah and Kevan have eleven
-- rows, two of them called MUA Contract.pdf, and across the table five
-- filename-and-wedding pairs are sitting there twice.
--
-- That is not only untidy. Sage reads every contract on a wedding into her
-- context when she is asked a contract question, so a superseded catering
-- contract and the final one go in together and she answers from whichever she
-- reaches first. "Final contract for Sarah & Kevan" arrived on 25 August and
-- had nowhere to say what it was final about.
--
-- `wedding_documents` already solved this with version + supersedes_id, and
-- this follows it rather than inventing a second shape. The one addition is
-- `superseded_by`, the other end of the same link, because contracts are read
-- as a list far more often than one at a time and "give me what still counts"
-- should be a filter rather than a join against the rest of the table.
--
-- ## What makes two contracts the same contract
--
-- The same wedding and the same vendor. Not the same filename: "Catering
-- Contract.pdf" and "Banquet Event Order - Serendipity_original (1).pdf" are
-- the same agreement, and two different vendors both sending "Contract.pdf"
-- are not. So the vendor is recorded on the row, normalised through
-- shared/vendor-names.js the same way vendor_checklist is, and that is what
-- versions chain on.
--
-- ## Where it came from
--
-- Contracts could only ever arrive by hand. Now that an email keeps its
-- attachments, one can arrive by itself, and `source` plus `gmail_message_id`
-- are what stop the same attachment being filed on every sync.
--
-- ## Which one is the most recent
--
-- The date on the contract, not the date it was found. These are not the same
-- thing and the gap between them is where the mistakes live: a caterer sends
-- the final version in March and somebody uploads it in August, while a scan
-- of the original January agreement goes up the same afternoon. Ordered by
-- upload, January wins and the vendor screen shows terms nobody is working to.
--
-- vendor_checklist.contract_date is already spoken for and does not mean this.
-- It is written as venueToday() at the moment of upload, commented "the day it
-- was signed at the venue", and it is nothing of the kind: it is the day
-- somebody pressed the button. The couple-facing screen renders it honestly as
-- "Contract uploaded"; the vendor screen renders it as the contract's date,
-- which is where this surfaced. Rather than redefine a column holding two
-- years of upload dates, the real one is added alongside and read first.
--
-- No BEGIN/COMMIT: Supabase runs migrations in its own transaction.

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS vendor_name       TEXT,
  ADD COLUMN IF NOT EXISTS vendor_key        TEXT,
  ADD COLUMN IF NOT EXISTS vendor_type       TEXT,
  ADD COLUMN IF NOT EXISTS vendor_id         UUID REFERENCES vendors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version           INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS supersedes_id     UUID REFERENCES contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS superseded_by     UUID REFERENCES contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source            TEXT NOT NULL DEFAULT 'upload',
  ADD COLUMN IF NOT EXISTS gmail_message_id  TEXT,
  ADD COLUMN IF NOT EXISTS storage_path      TEXT,
  ADD COLUMN IF NOT EXISTS document_date     DATE;

-- The same distinction on the booking, where the vendor screen reads it.
ALTER TABLE vendor_checklist
  ADD COLUMN IF NOT EXISTS contract_document_date DATE;

COMMENT ON COLUMN vendor_checklist.contract_document_date IS
  'The date printed on the contract. contract_date is the day it was uploaded, whatever its comment says. Read this one first and fall back.';

COMMENT ON COLUMN contracts.vendor_key IS
  'normaliseVendorName() from shared/vendor-names.js. What versions chain on, with wedding_id.';
COMMENT ON COLUMN contracts.superseded_by IS
  'The contract that replaced this one. NULL means this is the one that still counts, and every read surface filters on it.';
COMMENT ON COLUMN contracts.source IS
  'upload | chat | vendor | email. An email-sourced contract carries gmail_message_id so the next sync knows it is already here.';
COMMENT ON COLUMN contracts.storage_path IS
  'Path in the vendor-contracts bucket. Older rows kept only the extracted text, so this is null for them and the PDF is gone.';
COMMENT ON COLUMN contracts.document_date IS
  'The date on the contract itself where one could be read, which is not the date it happened to be uploaded.';

-- Reading a wedding's live contracts is the common query, by a distance.
CREATE INDEX IF NOT EXISTS idx_contracts_current
  ON contracts (wedding_id) WHERE superseded_by IS NULL;

-- Chaining a new version onto the right predecessor.
CREATE INDEX IF NOT EXISTS idx_contracts_vendor_key
  ON contracts (wedding_id, vendor_key);

-- The same attachment must not be filed twice. Partial, because everything
-- that arrived by hand has no message id and they are not duplicates of each
-- other.
--
-- Deliberately NOT a unique constraint used with .upsert({ onConflict }):
-- PostgREST cannot resolve onConflict against a partial index and returns
-- 42P10. Callers check first and insert.
CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_gmail_message
  ON contracts (gmail_message_id, filename) WHERE gmail_message_id IS NOT NULL;
