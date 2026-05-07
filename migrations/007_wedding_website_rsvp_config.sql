-- RsvpSettings client persists `rsvp_config` (JSONB blob with field toggles +
-- custom questions) into wedding_website_settings. The column never existed,
-- so every save was a no-op even before we discovered the whitelist also
-- stripped it. Adding it now.

ALTER TABLE wedding_website_settings
  ADD COLUMN IF NOT EXISTS rsvp_config JSONB DEFAULT '{}';
