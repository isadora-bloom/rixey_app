-- The WeddingDetails client form captures 18 fields that were never added
-- to the wedding_details table. Every autosave was failing with
-- "column does not exist" and the data never persisted. Adding them now.
--
-- All new columns are nullable. Numeric-looking inputs (counts, max guest
-- counts) are stored as TEXT because the form uses uncontrolled string
-- values and couples often type "TBD" or ranges.

ALTER TABLE wedding_details ADD COLUMN IF NOT EXISTS partner1_parents              TEXT;
ALTER TABLE wedding_details ADD COLUMN IF NOT EXISTS partner1_parents_met          BOOLEAN;
ALTER TABLE wedding_details ADD COLUMN IF NOT EXISTS partner2_parents              TEXT;
ALTER TABLE wedding_details ADD COLUMN IF NOT EXISTS partner2_parents_met          BOOLEAN;
ALTER TABLE wedding_details ADD COLUMN IF NOT EXISTS wedding_party_count_1         TEXT;
ALTER TABLE wedding_details ADD COLUMN IF NOT EXISTS wedding_party_count_2         TEXT;
ALTER TABLE wedding_details ADD COLUMN IF NOT EXISTS dog_sitter_name               TEXT;
ALTER TABLE wedding_details ADD COLUMN IF NOT EXISTS dog_sitter_time               TEXT;
ALTER TABLE wedding_details ADD COLUMN IF NOT EXISTS contract_checkin              TEXT;
ALTER TABLE wedding_details ADD COLUMN IF NOT EXISTS contract_checkout             TEXT;
ALTER TABLE wedding_details ADD COLUMN IF NOT EXISTS contract_max_rehearsal        TEXT;
ALTER TABLE wedding_details ADD COLUMN IF NOT EXISTS contract_max_wedding          TEXT;
ALTER TABLE wedding_details ADD COLUMN IF NOT EXISTS contract_overnights           TEXT;
ALTER TABLE wedding_details ADD COLUMN IF NOT EXISTS contract_rehearsal_hours      TEXT;
ALTER TABLE wedding_details ADD COLUMN IF NOT EXISTS contract_wedding_hours        TEXT;
ALTER TABLE wedding_details ADD COLUMN IF NOT EXISTS providing_cake_cutter_notes   TEXT;
ALTER TABLE wedding_details ADD COLUMN IF NOT EXISTS high_chairs_needed            BOOLEAN;
ALTER TABLE wedding_details ADD COLUMN IF NOT EXISTS high_chairs_count             TEXT;
