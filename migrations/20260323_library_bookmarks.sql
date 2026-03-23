-- =============================================
-- Library Bookmarks Table
-- Generated: 2026-03-23
-- =============================================

CREATE TABLE IF NOT EXISTS library_bookmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES library_items(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_library_bookmarks_user ON library_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_library_bookmarks_item ON library_bookmarks(item_id);

GRANT ALL PRIVILEGES ON TABLE library_bookmarks TO postgres, anon, authenticated, service_role;
