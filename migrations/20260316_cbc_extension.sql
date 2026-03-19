-- CBC Extension Migration Script

-- 1. Create Competency Level Enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'competency_level') THEN
        CREATE TYPE competency_level AS ENUM ('EE', 'ME', 'AE', 'BE');
    END IF;
END $$;

-- 2. Strands Table
CREATE TABLE IF NOT EXISTS strands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Sub-Strands Table
CREATE TABLE IF NOT EXISTS sub_strands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    strand_id UUID REFERENCES strands(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Learning Outcomes Table
CREATE TABLE IF NOT EXISTS learning_outcomes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    sub_strand_id UUID REFERENCES sub_strands(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Lessons Table
CREATE TABLE IF NOT EXISTS lessons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    strand_id UUID REFERENCES strands(id) ON DELETE CASCADE,
    sub_strand_id UUID REFERENCES sub_strands(id) ON DELETE CASCADE,
    learning_outcome_id UUID REFERENCES learning_outcomes(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    key_inquiry_questions JSONB,
    core_competencies JSONB,
    values JSONB,
    pcis JSONB,
    lesson_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Lesson Activities Table
CREATE TABLE IF NOT EXISTS lesson_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- group discussion, role play, etc.
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Competency Assessments Table
CREATE TABLE IF NOT EXISTS competency_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
    learning_outcome_id UUID REFERENCES learning_outcomes(id) ON DELETE CASCADE,
    lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
    level competency_level NOT NULL,
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Learner Portfolios Table
CREATE TABLE IF NOT EXISTS learner_portfolios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    evidence_url TEXT,
    evidence_type TEXT, -- essay, photo, audio, video, worksheet
    teacher_comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Update existing tables
-- Add lesson_id to materials
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='materials' AND column_name='lesson_id') THEN
        ALTER TABLE materials ADD COLUMN lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add lesson_id to assignments
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assignments' AND column_name='lesson_id') THEN
        ALTER TABLE assignments ADD COLUMN lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add lesson_id to cats
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cats' AND column_name='lesson_id') THEN
        ALTER TABLE cats ADD COLUMN lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 10. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_strands_subject ON strands(subject_id);
CREATE INDEX IF NOT EXISTS idx_sub_strands_strand ON sub_strands(strand_id);
CREATE INDEX IF NOT EXISTS idx_learning_outcomes_sub_strand ON learning_outcomes(sub_strand_id);
CREATE INDEX IF NOT EXISTS idx_lessons_class_subject ON lessons(class_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_competency_assessments_student ON competency_assessments(student_id);
CREATE INDEX IF NOT EXISTS idx_learner_portfolios_student ON learner_portfolios(student_id);

-- 11. Enable RLS
ALTER TABLE strands ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_strands ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE competency_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE learner_portfolios ENABLE ROW LEVEL SECURITY;
