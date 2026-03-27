-- Add category column to inspo_gallery for photo categorization
ALTER TABLE inspo_gallery ADD COLUMN IF NOT EXISTS category text;
