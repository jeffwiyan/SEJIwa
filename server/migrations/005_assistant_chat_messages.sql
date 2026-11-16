ALTER TABLE messages
  ADD COLUMN sender_type TEXT NOT NULL DEFAULT 'human'
  CHECK (sender_type IN ('human', 'assistant'));

ALTER TABLE messages
  ADD COLUMN safety TEXT NOT NULL DEFAULT 'standard'
  CHECK (safety IN ('standard', 'urgent'));
