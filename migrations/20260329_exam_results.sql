-- Migration: Add exam_results table for student results
-- Created: 2026-03-29

CREATE TABLE IF NOT EXISTS exam_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    exam_type TEXT NOT NULL,
    term TEXT NOT NULL,
    year INTEGER NOT NULL,
    score DECIMAL(5,2),
    grade TEXT,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_exam_results_school ON exam_results(school_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_student ON exam_results(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_class ON exam_results(class_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_subject ON exam_results(subject_id);

-- Add missing permissions if needed
GRANT ALL PRIVILEGES ON TABLE exam_results TO postgres, anon, authenticated, service_role;
