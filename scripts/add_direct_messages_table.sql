-- Direct Messages between clients and admin team
CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_id UUID NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('client', 'admin')),
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_direct_messages_wedding ON direct_messages(wedding_id);
CREATE INDEX idx_direct_messages_unread ON direct_messages(wedding_id, is_read) WHERE is_read = false;
CREATE INDEX idx_direct_messages_created ON direct_messages(created_at DESC);

-- Enable RLS
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- Clients can view messages for their own wedding
CREATE POLICY "Users can view messages for their wedding" ON direct_messages
  FOR SELECT USING (
    wedding_id IN (
      SELECT wedding_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Clients can send messages (as 'client' type only)
CREATE POLICY "Users can send messages for their wedding" ON direct_messages
  FOR INSERT WITH CHECK (
    wedding_id IN (
      SELECT wedding_id FROM profiles WHERE id = auth.uid()
    )
    AND sender_type = 'client'
  );

-- Clients can mark messages as read
CREATE POLICY "Users can mark messages as read" ON direct_messages
  FOR UPDATE USING (
    wedding_id IN (
      SELECT wedding_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Admin can do everything (via service role key, bypasses RLS)
-- For admin access through anon key, add this policy:
CREATE POLICY "Admin full access to messages" ON direct_messages
  FOR ALL USING (true);
