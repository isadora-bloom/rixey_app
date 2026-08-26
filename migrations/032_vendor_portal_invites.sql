-- When a vendor was last sent their portal link.
--
-- 52 vendors now have an email address on file and a link nobody has ever sent
-- them. The link is the whole point of the vendor portal: seven vendors found
-- theirs somehow and filled in photos and bios, and the other two hundred
-- never had the chance.
--
-- One column, so a second run of the invite does not email the same florist
-- twice. A repeat is worse than it sounds: these are working businesses, and a
-- venue that emails them twice about the same thing is a venue whose next
-- email gets skimmed.

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS portal_invited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS portal_invite_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN vendors.portal_invited_at IS
  'Last time their portal link was emailed to them. NULL means they have never been asked.';
COMMENT ON COLUMN vendors.portal_invite_count IS
  'How many times. A vendor who has been asked twice and still written nothing is a different problem from one who has never been asked.';
