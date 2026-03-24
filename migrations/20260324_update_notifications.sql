-- Add sender_id to notifications to track who sent it
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Ensure school_id is NOT NULL if we want to filter by school
ALTER TABLE notifications ALTER COLUMN school_id SET NOT NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_notifications_sender ON notifications(sender_id);
