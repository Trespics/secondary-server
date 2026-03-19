-- =========================================
-- CBC eLearning System - Production Schema
-- =========================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================
-- 1. ENUMS
-- =========================================
CREATE TYPE user_role AS ENUM ('superadmin', 'admin', 'teacher', 'student');
CREATE TYPE material_type AS ENUM ('Notes', 'Video', 'Audio', 'Book', 'Past Paper');
CREATE TYPE competency_level AS ENUM ('EE', 'ME', 'AE', 'BE');

-- =========================================
-- 2. CORE TABLES
-- =========================================
CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    email TEXT UNIQUE,
    logo_url TEXT,
    motto TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    role user_role NOT NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    password_hash TEXT NOT NULL,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reset_password_token TEXT,
    reset_password_expires TIMESTAMP WITH TIME ZONE
);

-- =========================================
-- 3. USER DETAIL TABLES
-- =========================================
CREATE TABLE teacher_details (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT,
    specialization TEXT,
    experience_years INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE student_details (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    student_id TEXT UNIQUE,
    dob DATE,
    gender TEXT,
    parent_name TEXT,
    parent_phone TEXT,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE admin_details (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    department TEXT,
    position TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE super_admin_details (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    position TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================
-- 4. ACADEMIC STRUCTURE
-- =========================================
CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    grade_level INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    image_url TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE class_subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(class_id, subject_id, teacher_id)
);

CREATE TABLE enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    UNIQUE(student_id, class_id)
);

-- =========================================
-- 5. CBC STRUCTURE
-- =========================================
CREATE TABLE strands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE sub_strands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    strand_id UUID NOT NULL REFERENCES strands(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE learning_outcomes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    sub_strand_id UUID NOT NULL REFERENCES sub_strands(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================
-- 6. LESSONS
-- =========================================
CREATE TABLE lessons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    strand_id UUID REFERENCES strands(id),
    sub_strand_id UUID REFERENCES sub_strands(id),
    learning_outcome_id UUID REFERENCES learning_outcomes(id),
    title TEXT NOT NULL,
    key_inquiry_questions JSONB,
    core_competencies JSONB,
    values JSONB,
    pcis JSONB,
    lesson_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE lesson_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================
-- 7. MATERIALS
-- =========================================
CREATE TABLE materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    lesson_id UUID REFERENCES lessons(id),
    strand_id UUID REFERENCES strands(id),
    sub_strand_id UUID REFERENCES sub_strands(id),
    learning_outcome_id UUID REFERENCES learning_outcomes(id),
    title TEXT NOT NULL,
    description TEXT,
    type material_type NOT NULL,
    file_url TEXT,
    content_link TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    is_flagged BOOLEAN DEFAULT FALSE,
    release_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    download_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE material_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================
-- 8. INDEX OPTIMIZATION (CRITICAL 🚀)
-- =========================================

-- Foreign key indexes
CREATE INDEX idx_users_school ON users(school_id);
CREATE INDEX idx_classes_school ON classes(school_id);
CREATE INDEX idx_subjects_school ON subjects(school_id);
CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_enrollments_class ON enrollments(class_id);
CREATE INDEX idx_materials_class ON materials(class_id);
CREATE INDEX idx_materials_subject ON materials(subject_id);
CREATE INDEX idx_materials_teacher ON materials(teacher_id);
CREATE INDEX idx_assignments_class ON assignments(class_id);
CREATE INDEX idx_assignments_subject ON assignments(subject_id);
CREATE INDEX idx_submissions_student ON submissions(student_id);

-- Composite indexes (real-world queries)
CREATE INDEX idx_materials_class_subject ON materials(class_id, subject_id);
CREATE INDEX idx_lessons_class_subject ON lessons(class_id, subject_id);
CREATE INDEX idx_enrollments_student_class ON enrollments(student_id, class_id);

-- =========================================
-- 9. RLS ENABLE
-- =========================================
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

-- =========================================
-- 🔐 10. RLS POLICIES (PRODUCTION GRADE)
-- =========================================

-- Helper: current user's school
CREATE OR REPLACE FUNCTION get_my_school_id()
RETURNS UUID AS $$
    SELECT school_id FROM users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER;

-- USERS
CREATE POLICY "Users can view same school"
ON users FOR SELECT
USING (school_id = get_my_school_id());

CREATE POLICY "Users can update self"
ON users FOR UPDATE
USING (id = auth.uid());

-- SCHOOLS
CREATE POLICY "View own school"
ON schools FOR SELECT
USING (id = get_my_school_id());

-- CLASSES
CREATE POLICY "School isolation classes"
ON classes FOR ALL
USING (school_id = get_my_school_id());

-- SUBJECTS
CREATE POLICY "School isolation subjects"
ON subjects FOR ALL
USING (school_id = get_my_school_id());

-- MATERIALS
CREATE POLICY "View materials in school"
ON materials FOR SELECT
USING (
    school_id = get_my_school_id()
    AND (is_public = TRUE OR teacher_id = auth.uid())
);

CREATE POLICY "Teachers manage own materials"
ON materials FOR ALL
USING (teacher_id = auth.uid());

-- ENROLLMENTS
CREATE POLICY "Students see own enrollments"
ON enrollments FOR SELECT
USING (student_id = auth.uid());

-- MATERIAL REPORTS
ALTER TABLE material_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students create reports"
ON material_reports FOR INSERT
WITH CHECK (student_id = auth.uid());

CREATE POLICY "Teachers view reports"
ON material_reports FOR SELECT
USING (teacher_id = auth.uid());
