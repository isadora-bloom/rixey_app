-- A vendor profile that nobody can see is the same as no profile.
--
-- Seven vendors used their token links between 14 July and 5 August 2026 and
-- filled their profiles in properly: Gateau, Bride and Joy, Vinosity, Court's
-- Kitchen, Serendipity, Atoka Strings, Tara Sink. Thirty-seven photos and six
-- bios between them. Every one sat at is_published = false, because going live
-- needed a tick in admin and nothing anywhere said there was a tick waiting.
-- No couple ever saw a word of it.
--
-- The tick is gone. A vendor who saves is live. But "live" and "never decided"
-- were the same value before, so hiding someone had no way to survive their
-- next save. Hence three states:
--
--   NULL   nobody has decided. The vendor has not filled anything in yet.
--   TRUE   live to couples.
--   FALSE  Rixey hid them on purpose. Stays hidden however often they save.
--
-- The default goes with it. A row inserted from the admin form is a vendor
-- Isadora typed in herself, and has no self-written profile to show, so NULL
-- is the honest starting point rather than a decision nobody made.

ALTER TABLE vendors ALTER COLUMN is_published DROP DEFAULT;

-- Nothing has ever been published, so every existing false is the default
-- landing on the row, not a judgement. Reset them all to "no decision".
UPDATE vendors SET is_published = NULL WHERE is_published = false;

-- Then honour the seven who did the work.
UPDATE vendors SET is_published = true WHERE last_vendor_update IS NOT NULL;
