-- Add contact fields to wedding_guests
ALTER TABLE wedding_guests ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE wedding_guests ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE wedding_guests ADD COLUMN IF NOT EXISTS address TEXT;
