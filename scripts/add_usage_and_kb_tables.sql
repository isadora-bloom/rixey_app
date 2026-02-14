-- Usage tracking for API costs
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_id UUID REFERENCES weddings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL, -- 'chat', 'chat-with-file', 'extract-contract', etc.
  input_tokens INT DEFAULT 0,
  output_tokens INT DEFAULT 0,
  model TEXT DEFAULT 'claude-sonnet',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_logs_wedding ON usage_logs(wedding_id);
CREATE INDEX idx_usage_logs_created ON usage_logs(created_at);

-- RLS for usage_logs (admin only)
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can view all usage" ON usage_logs FOR ALL USING (true);

-- Ensure knowledge_base has all needed columns
-- (This table likely exists, but let's make sure it has what we need)
DO $$
BEGIN
  -- Add 'active' column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'knowledge_base' AND column_name = 'active') THEN
    ALTER TABLE knowledge_base ADD COLUMN active BOOLEAN DEFAULT true;
  END IF;

  -- Add 'created_at' column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'knowledge_base' AND column_name = 'created_at') THEN
    ALTER TABLE knowledge_base ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  -- Add 'updated_at' column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'knowledge_base' AND column_name = 'updated_at') THEN
    ALTER TABLE knowledge_base ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Client onboarding progress tracking
CREATE TABLE IF NOT EXISTS onboarding_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_id UUID NOT NULL UNIQUE REFERENCES weddings(id) ON DELETE CASCADE,
  couple_photo_uploaded BOOLEAN DEFAULT false,
  first_message_sent BOOLEAN DEFAULT false,
  vendor_added BOOLEAN DEFAULT false,
  inspo_uploaded BOOLEAN DEFAULT false,
  checklist_item_completed BOOLEAN DEFAULT false,
  onboarding_dismissed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for onboarding_progress
ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own onboarding" ON onboarding_progress
  FOR SELECT USING (
    wedding_id IN (SELECT wedding_id FROM profiles WHERE id = auth.uid())
  );
CREATE POLICY "Users can update own onboarding" ON onboarding_progress
  FOR UPDATE USING (
    wedding_id IN (SELECT wedding_id FROM profiles WHERE id = auth.uid())
  );
CREATE POLICY "Admin can manage all onboarding" ON onboarding_progress
  FOR ALL USING (true);
