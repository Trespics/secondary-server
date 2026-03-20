-- =============================================
-- Library Module Schema
-- Generated: 2026-03-20
-- =============================================

-- =============================================
-- 1. ENUMS
-- =============================================
DO $$ BEGIN
    CREATE TYPE library_item_type AS ENUM ('Book', 'Video', 'Audio', 'Paper');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================
-- 2. LIBRARY TABLES
-- =============================================

CREATE TABLE IF NOT EXISTS library_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pre-populate some basic categories
INSERT INTO library_categories (name, description) VALUES
('Science', 'Scientific literature and resources'),
('History', 'Historical texts and documentaries'),
('Literature', 'Novels, poems, and plays'),
('Textbooks', 'Educational school textbooks'),
('Past Papers', 'Previous examination papers')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS library_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    author TEXT,
    description TEXT,
    category_id UUID REFERENCES library_categories(id) ON DELETE SET NULL,
    type library_item_type NOT NULL DEFAULT 'Book',
    file_url TEXT NOT NULL,
    cover_image_url TEXT,
    is_free BOOLEAN DEFAULT TRUE,
    price DECIMAL(10,2) DEFAULT 0.00,
    access_level TEXT DEFAULT 'All', -- 'All', 'Student', 'Teacher', etc.
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE, -- NULL means universal
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS library_favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES library_items(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, item_id)
);

CREATE TABLE IF NOT EXISTS library_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES library_items(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    review_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, item_id)
);

CREATE TABLE IF NOT EXISTS library_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES library_items(id) ON DELETE CASCADE,
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, item_id)
);

-- =============================================
-- 3. INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_library_items_category ON library_items(category_id);
CREATE INDEX IF NOT EXISTS idx_library_items_school ON library_items(school_id);
CREATE INDEX IF NOT EXISTS idx_library_favorites_user ON library_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_library_reviews_item ON library_reviews(item_id);
CREATE INDEX IF NOT EXISTS idx_library_progress_user ON library_progress(user_id);

-- =============================================
-- 4. PERMISSIONS
-- =============================================
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
