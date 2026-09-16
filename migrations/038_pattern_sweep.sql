-- Pattern sweep (15 Sep 2026): two unrelated, cheap fixes bundled together
-- because both are one statement and neither needs its own review round.
--
-- 1. A re-uploaded document was only ever *detectable* as the same one via
--    text_hash — the existing wedding_documents_hash_idx (013) is a plain
--    index, not a constraint, so nothing stopped two rows for the same
--    wedding with the same extracted_text actually existing. Made unique
--    here, partial on text_hash being set so documents still being parsed
--    (text_hash null) never collide with each other.
--
--    If this fails to apply, a wedding already has two rows with the same
--    hash — find it with:
--      select wedding_id, text_hash, count(*) from wedding_documents
--      where text_hash is not null group by 1, 2 having count(*) > 1;
--    and decide by hand which row (if either) to keep before re-running.
--
-- 2. day-of-media's bucket cap was never set at creation (016), so it sat on
--    whatever the project default is. Photos and voice recordings from a
--    walkthrough or a wedding day are exactly the uploads likely to be large;
--    raised to 500MB so the bucket is not what refuses a real recording.
--    (server/index.js's own multer limit for this bucket is separate and
--    lower — this is only the storage-layer ceiling above it.)
--
-- No BEGIN/COMMIT: Supabase runs migrations in its own transaction.

CREATE UNIQUE INDEX IF NOT EXISTS wedding_documents_wedding_hash_uniq
  ON wedding_documents (wedding_id, text_hash)
  WHERE text_hash IS NOT NULL;

UPDATE storage.buckets SET file_size_limit = 524288000 WHERE id = 'day-of-media';
