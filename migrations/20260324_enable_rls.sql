-- =============================================
-- Row Level Security (RLS) & Policies
-- Generated: 2026-03-24
-- =============================================

-- =============================================
-- 1. ENABLE RLS ON ALL TABLES
-- =============================================
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
    LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY;';
    END LOOP;
END $$;

-- =============================================
-- 2. HELPER FUNCTIONS
-- =============================================

-- Function to check if the current user is a superadmin
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT role = 'superadmin' 
        FROM public.users 
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if the current user is an admin of a specific school
CREATE OR REPLACE FUNCTION is_admin_of_school(school_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT role = 'admin' AND u.school_id = $1
        FROM public.users u
        WHERE u.id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if the current user is a teacher of a specific school
CREATE OR REPLACE FUNCTION is_teacher_of_school(school_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT role = 'teacher' AND u.school_id = $1
        FROM public.users u
        WHERE u.id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get the role of the current user
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
BEGIN
    RETURN (
        SELECT role 
        FROM public.users 
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get the school_id of the current user
CREATE OR REPLACE FUNCTION get_user_school()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT school_id 
        FROM public.users 
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 3. POLICIES
-- =============================================

-- ---------------------------------------------
-- 3.1. SCHOOLS
-- ---------------------------------------------

-- Select: Everyone (authenticated) can see their own school or all schools if superadmin
CREATE POLICY "Users can view their own school" ON schools
    FOR SELECT USING (
        is_superadmin() OR 
        id = get_user_school()
    );

-- All: Only superadmin can manage schools
CREATE POLICY "Only superadmins can manage schools" ON schools
    FOR ALL USING (is_superadmin());

-- ---------------------------------------------
-- 3.2. USERS
-- ---------------------------------------------

-- Select: Users can view themselves. Admins can view users in their school. Superadmins can view all.
CREATE POLICY "Users can view themselves or admins can view school users" ON users
    FOR SELECT USING (
        auth.uid() = id OR 
        is_superadmin() OR 
        is_admin_of_school(school_id)
    );

-- Update: Users can update their own profile. Admins can update school users. Superadmins can update all.
CREATE POLICY "Users can update themselves or admins can update school users" ON users
    FOR UPDATE USING (
        auth.uid() = id OR 
        is_superadmin() OR 
        is_admin_of_school(school_id)
    );

-- Insert/Delete: Only admins (for their school) and superadmins (all)
CREATE POLICY "Admins and superadmins can insert/delete users" ON users
    FOR ALL USING (
        is_superadmin() OR 
        is_admin_of_school(school_id)
    );

-- ---------------------------------------------
-- 3.3. MATERIALS
-- ---------------------------------------------

-- Select: Students can view materials for their school. Teachers can view materials for their school. Superadmins can view all.
CREATE POLICY "View materials based on school and role" ON materials
    FOR SELECT USING (
        is_superadmin() OR 
        school_id = get_user_school()
    );

-- All: Teachers can manage their own materials. Admins can manage school materials. Superadmins can manage all.
CREATE POLICY "Teachers can manage their own materials" ON materials
    FOR ALL USING (
        is_superadmin() OR 
        is_admin_of_school(school_id) OR
        (get_user_role() = 'teacher' AND teacher_id = auth.uid())
    );

-- ---------------------------------------------
-- 3.4. LESSONS
-- ---------------------------------------------

-- Select: Similar to materials
CREATE POLICY "View lessons based on school and role" ON lessons
    FOR SELECT USING (
        is_superadmin() OR 
        school_id = get_user_school()
    );

-- All: Teachers can manage their own lessons.
CREATE POLICY "Teachers can manage their own lessons" ON lessons
    FOR ALL USING (
        is_superadmin() OR 
        is_admin_of_school(school_id) OR
        (get_user_role() = 'teacher' AND teacher_id = auth.uid())
    );

-- ---------------------------------------------
-- 3.5. ASSIGNMENTS & SUBMISSIONS
-- ---------------------------------------------

-- Assignments: Viewable by anyone in the school/class
CREATE POLICY "View assignments" ON assignments
    FOR SELECT USING (
        is_superadmin() OR 
        school_id = get_user_school()
    );

-- Submissions: Students can manage their own. Teachers can view/grade for their assignments.
CREATE POLICY "Students manage their own submissions" ON submissions
    FOR ALL USING (
        student_id = auth.uid() OR 
        is_superadmin() OR 
        EXISTS (
            SELECT 1 FROM public.users u 
            WHERE u.id = auth.uid() 
            AND (u.role = 'admin' AND u.school_id = (SELECT a.school_id FROM assignments a WHERE a.id = submissions.assignment_id))
        ) OR
        EXISTS (
            SELECT 1 FROM assignments a 
            WHERE a.id = submissions.assignment_id 
            AND a.teacher_id = auth.uid()
        )
    );

-- ---------------------------------------------
-- 3.6. ACADEMIC STRUCTURE (General Read)
-- ---------------------------------------------

-- Applies to: classes, subjects, class_subjects, grade_subjects, enrollments, 
-- strands, sub_strands, learning_outcomes, lesson_activities, past_papers

CREATE POLICY "View academic structure based on school" ON classes
    FOR SELECT USING (is_superadmin() OR school_id = get_user_school());

CREATE POLICY "View subjects" ON subjects
    FOR SELECT USING (is_superadmin() OR school_id = get_user_school());

CREATE POLICY "View past papers" ON past_papers
    FOR SELECT USING (is_public OR is_superadmin() OR school_id = get_user_school());

-- ---------------------------------------------
-- 3.7. NOTIFICATIONS
-- ---------------------------------------------

-- Select: Recipients can view their own notifications.
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (recipient_id = auth.uid() OR is_superadmin());

-- Update: Recipients can mark as read.
CREATE POLICY "Users can update their own notifications" ON notifications
    FOR UPDATE USING (recipient_id = auth.uid());

-- All: Admins/System can create notifications.
CREATE POLICY "System can create notifications" ON notifications
    FOR INSERT WITH CHECK (true); -- Usually handled by service role

-- ---------------------------------------------
-- 3.8. LIBRARY (20260320_library_schema.sql)
-- ---------------------------------------------

-- Select: Everyone (authenticated) can view library items
CREATE POLICY "Anyone authenticated can view library items" ON library_items
    FOR SELECT USING (auth.role() = 'authenticated');

-- All: Only superadmins/admins can manage library items (universal items)
CREATE POLICY "Admins can manage library items" ON library_items
    FOR ALL USING (
        is_superadmin() OR 
        (school_id IS NOT NULL AND is_admin_of_school(school_id))
    );

-- Progress/Favorites/Reviews: Users manage their own
CREATE POLICY "Users manage their own library activity" ON library_progress
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users manage their own favorites" ON library_favorites
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users manage their own reviews" ON library_reviews
    FOR ALL USING (user_id = auth.uid());

-- =============================================
-- 4. SERVICE ROLE BYPASS (Implicit in Supabase)
-- =============================================
-- Note: The service_role key already bypasses RLS. 
-- These policies are for 'authenticated' and 'anon' roles.

-- =============================================
-- 5. FINAL PERMISSIONS RE-GRANT
-- =============================================
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
