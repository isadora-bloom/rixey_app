-- Migration: Add missing NOT NULL constraints, indexes, and updated_at columns
-- to tables created by add_wedding_planning_tables.sql
-- Safe to re-run (uses IF NOT EXISTS / exception handling)

-- ============ NOT NULL CONSTRAINTS ============
-- These tables have wedding_id FK but allow NULL, which means orphaned rows can exist

DO $$ BEGIN
  ALTER TABLE allergy_registry ALTER COLUMN wedding_id SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE bedroom_assignments ALTER COLUMN wedding_id SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ceremony_order ALTER COLUMN wedding_id SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE decor_inventory ALTER COLUMN wedding_id SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE makeup_schedule ALTER COLUMN wedding_id SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE shuttle_schedule ALTER COLUMN wedding_id SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ============ MISSING INDEXES ============
-- wedding_id is the primary query filter for all these tables

CREATE INDEX IF NOT EXISTS idx_allergy_registry_wedding ON allergy_registry(wedding_id);
CREATE INDEX IF NOT EXISTS idx_bedroom_assignments_wedding ON bedroom_assignments(wedding_id);
CREATE INDEX IF NOT EXISTS idx_ceremony_order_wedding ON ceremony_order(wedding_id);
CREATE INDEX IF NOT EXISTS idx_decor_inventory_wedding ON decor_inventory(wedding_id);
CREATE INDEX IF NOT EXISTS idx_makeup_schedule_wedding ON makeup_schedule(wedding_id);
CREATE INDEX IF NOT EXISTS idx_shuttle_schedule_wedding ON shuttle_schedule(wedding_id);
CREATE INDEX IF NOT EXISTS idx_bar_shopping_list_wedding ON bar_shopping_list(wedding_id);
CREATE INDEX IF NOT EXISTS idx_bar_recipes_wedding ON bar_recipes(wedding_id);
CREATE INDEX IF NOT EXISTS idx_wedding_photos_wedding ON wedding_photos(wedding_id);
CREATE INDEX IF NOT EXISTS idx_wedding_party_wedding ON wedding_party(wedding_id);

-- ============ MISSING updated_at COLUMNS ============
-- Needed for sync, conflict resolution, and audit

ALTER TABLE allergy_registry ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE bedroom_assignments ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE ceremony_order ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE decor_inventory ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE makeup_schedule ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE shuttle_schedule ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE planning_checklist ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE vendor_checklist ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE inspo_gallery ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Auto-update updated_at on modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for auto-updating (safe: drops if exists first)
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'allergy_registry', 'bedroom_assignments', 'ceremony_order',
    'decor_inventory', 'makeup_schedule', 'shuttle_schedule',
    'planning_checklist', 'vendor_checklist', 'inspo_gallery'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', tbl);
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
      tbl
    );
  END LOOP;
END $$;
