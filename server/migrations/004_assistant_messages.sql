CREATE TABLE IF NOT EXISTS assistant_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'assistant')),
  body TEXT NOT NULL,
  safety TEXT NOT NULL DEFAULT 'standard' CHECK (safety IN ('standard', 'urgent')),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS assistant_messages_user_idx
  ON assistant_messages(user_id, created_at);
