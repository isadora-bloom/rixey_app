-- Table for questions Sage is uncertain about
CREATE TABLE IF NOT EXISTS uncertain_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_id UUID REFERENCES weddings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  sage_response TEXT,
  confidence_level INT, -- 0-100
  admin_answer TEXT,
  answered_at TIMESTAMPTZ,
  answered_by TEXT,
  added_to_kb BOOLEAN DEFAULT false,
  kb_category TEXT,
  kb_subcategory TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_uncertain_questions_wedding ON uncertain_questions(wedding_id);
CREATE INDEX idx_uncertain_questions_unanswered ON uncertain_questions(admin_answer) WHERE admin_answer IS NULL;

-- RLS
ALTER TABLE uncertain_questions ENABLE ROW LEVEL SECURITY;

-- Admin can see all
CREATE POLICY "Admin can view all uncertain questions" ON uncertain_questions
  FOR ALL USING (true);
