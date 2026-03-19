-- Add is_flagged status to materials
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='materials' AND column_name='is_flagged') THEN
        ALTER TABLE materials ADD COLUMN is_flagged BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Create material_reports table
CREATE TABLE IF NOT EXISTS material_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'resolved'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for better performance when querying reports
CREATE INDEX IF NOT EXISTS idx_material_reports_teacher ON material_reports(teacher_id);
CREATE INDEX IF NOT EXISTS idx_material_reports_material ON material_reports(material_id);

-- Enable RLS for material_reports
ALTER TABLE material_reports ENABLE ROW LEVEL SECURITY;
