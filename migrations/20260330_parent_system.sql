-- Migration: Add parent system (parent role, parents linking table, parent messages)
-- Created: 2026-03-30

-- 1. Add 'parent' to user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'parent';

-- 2. Parents linking table (links a parent user to student users)
CREATE TABLE IF NOT EXISTS parents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    relationship TEXT DEFAULT 'parent',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(parent_id, student_id)
);

-- 3. Parent-Teacher messages
CREATE TABLE IF NOT EXISTS parent_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_parents_parent_id ON parents(parent_id);
CREATE INDEX IF NOT EXISTS idx_parents_student_id ON parents(student_id);
CREATE INDEX IF NOT EXISTS idx_parent_messages_sender ON parent_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_parent_messages_receiver ON parent_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_parent_messages_school ON parent_messages(school_id);
CREATE INDEX IF NOT EXISTS idx_parent_messages_created ON parent_messages(created_at);

-- 5. Permissions
GRANT ALL PRIVILEGES ON TABLE parents TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON TABLE parent_messages TO postgres, anon, authenticated, service_role;
