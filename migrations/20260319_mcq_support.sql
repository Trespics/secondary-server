-- Add MCQ and Time Limit support to Assignments
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS questions JSONB DEFAULT '[]';
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS time_limit_minutes INTEGER DEFAULT 0;

-- Add MCQ and Time Limit support to CATs
-- cats table should already have time_limit_minutes, start_time, end_time
ALTER TABLE cats ADD COLUMN IF NOT EXISTS questions JSONB DEFAULT '[]';

-- Update Submissions for MCQ results
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS answers JSONB DEFAULT '[]';
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS score DECIMAL(5,2);
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS max_score INTEGER;
