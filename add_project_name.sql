-- Editable workspace/project name for a wedding.
-- couple_names is set once at sign-up and never edited; project_name lets staff
-- give the workspace a clear label (e.g. "Joe & Joan") that shows in admin.
ALTER TABLE public.weddings
  ADD COLUMN IF NOT EXISTS project_name TEXT;
