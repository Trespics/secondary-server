-- =============================================
-- Library System Upgrade - Legal & Compliance
-- Generated: 2026-03-20
-- =============================================

-- 1. Authors Table
CREATE TABLE IF NOT EXISTS library_authors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Publishers Table
CREATE TABLE IF NOT EXISTS library_publishers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    location TEXT,
    website TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Licenses Table
CREATE TABLE IF NOT EXISTS library_licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL, -- e.g., 'CC BY', 'CC BY-SA', 'Public Domain', 'Licensed'
    url TEXT,
    attribution_text TEXT,
    attribution_required BOOLEAN DEFAULT TRUE,
    redistribution_allowed BOOLEAN DEFAULT FALSE,
    commercial_use_allowed BOOLEAN DEFAULT FALSE,
    modification_allowed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Book Metadata Table (Extends library_items)
-- Using a separate table for book-specific metadata to keep library_items generic
CREATE TABLE IF NOT EXISTS library_books (
    item_id UUID PRIMARY KEY REFERENCES library_items(id) ON DELETE CASCADE,
    isbn TEXT,
    publication_year INTEGER,
    edition TEXT,
    language TEXT DEFAULT 'English',
    book_type TEXT NOT NULL CHECK (book_type IN ('public_domain', 'oer', 'licensed', 'external_reference')),
    access_type TEXT NOT NULL CHECK (access_type IN ('full_hosted', 'link_only', 'restricted')),
    source_url TEXT,
    download_url TEXT,
    section_url TEXT, -- Base URL for OER section-level attribution
    publisher_id UUID REFERENCES library_publishers(id) ON DELETE SET NULL,
    license_id UUID REFERENCES library_licenses(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Book-Authors Link Table (Many-to-Many)
CREATE TABLE IF NOT EXISTS library_book_authors (
    book_id UUID REFERENCES library_items(id) ON DELETE CASCADE,
    author_id UUID REFERENCES library_authors(id) ON DELETE CASCADE,
    PRIMARY KEY (book_id, author_id)
);

-- 6. Book Sections (for OER)
CREATE TABLE IF NOT EXISTS library_book_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID REFERENCES library_items(id) ON DELETE CASCADE,
    section_title TEXT NOT NULL,
    section_url TEXT,
    content_body TEXT, -- HTML or Markdown content
    attribution_text TEXT,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Book Citations
CREATE TABLE IF NOT EXISTS library_book_citations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID REFERENCES library_items(id) ON DELETE CASCADE,
    format TEXT NOT NULL, -- 'APA', 'MLA', 'Chicago', 'Custom'
    citation_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Indexes for Optimization
CREATE INDEX IF NOT EXISTS idx_library_books_publisher ON library_books(publisher_id);
CREATE INDEX IF NOT EXISTS idx_library_books_license ON library_books(license_id);
CREATE INDEX IF NOT EXISTS idx_library_book_sections_book ON library_book_sections(book_id);
CREATE INDEX IF NOT EXISTS idx_library_book_citations_book ON library_book_citations(book_id);

-- 9. Permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
