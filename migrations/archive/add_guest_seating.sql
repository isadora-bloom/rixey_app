-- Add table assignment to guests
ALTER TABLE wedding_guests ADD COLUMN IF NOT EXISTS table_assignment TEXT;
