const supabase = require('../config/supabase');

// ─── Curriculum Hierarchy ──────────────────────────────────────────

const getStrands = async (req, res) => {
    const { subject_id } = req.query;
    try {
        let query = supabase.from('strands').select('*');
        if (subject_id) query = query.eq('subject_id', subject_id);
        
        const { data, error } = await supabase.safeQuery(() => query.order('name'));
        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getSubStrands = async (req, res) => {
    const { strand_id } = req.query;
    try {
        let query = supabase.from('sub_strands').select('*');
        if (strand_id) query = query.eq('strand_id', strand_id);
        
        const { data, error } = await supabase.safeQuery(() => query.order('name'));
        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getLearningOutcomes = async (req, res) => {
    const { sub_strand_id } = req.query;
    try {
        let query = supabase.from('learning_outcomes').select('*');
        if (sub_strand_id) query = query.eq('sub_strand_id', sub_strand_id);
        
        const { data, error } = await supabase.safeQuery(() => query.order('id'));
        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// --- CRUD Operations for Strands ---
const createStrand = async (req, res) => {
    const { subject_id, name } = req.body;
    const school_id = req.user.school_id;
    try {
        const { data, error } = await supabase.safeQuery(() =>
            supabase
                .from('strands')
                .insert([{ school_id, subject_id, name }])
                .select()
                .single()
        );
        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const updateStrand = async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    try {
        const { data, error } = await supabase.safeQuery(() =>
            supabase
                .from('strands')
                .update({ name })
                .eq('id', id)
                .select()
                .single()
        );
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const deleteStrand = async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase.safeQuery(() =>
            supabase.from('strands').delete().eq('id', id)
        );
        if (error) throw error;
        res.json({ message: 'Strand deleted' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// --- CRUD Operations for Sub-strands ---
const createSubStrand = async (req, res) => {
    const { strand_id, name } = req.body;
    const school_id = req.user.school_id;
    try {
        const { data, error } = await supabase.safeQuery(() =>
            supabase
                .from('sub_strands')
                .insert([{ school_id, strand_id, name }])
                .select()
                .single()
        );
        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const updateSubStrand = async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    try {
        const { data, error } = await supabase.safeQuery(() =>
            supabase
                .from('sub_strands')
                .update({ name })
                .eq('id', id)
                .select()
                .single()
        );
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const deleteSubStrand = async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase.safeQuery(() =>
            supabase.from('sub_strands').delete().eq('id', id)
        );
        if (error) throw error;
        res.json({ message: 'Sub-strand deleted' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// --- CRUD Operations for Learning Outcomes ---
const createLearningOutcome = async (req, res) => {
    const { sub_strand_id, description } = req.body;
    const school_id = req.user.school_id;
    try {
        const { data, error } = await supabase.safeQuery(() =>
            supabase
                .from('learning_outcomes')
                .insert([{ school_id, sub_strand_id, description }])
                .select()
                .single()
        );
        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const updateLearningOutcome = async (req, res) => {
    const { id } = req.params;
    const { description } = req.body;
    try {
        const { data, error } = await supabase.safeQuery(() =>
            supabase
                .from('learning_outcomes')
                .update({ description })
                .eq('id', id)
                .select()
                .single()
        );
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const deleteLearningOutcome = async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase.safeQuery(() =>
            supabase.from('learning_outcomes').delete().eq('id', id)
        );
        if (error) throw error;
        res.json({ message: 'Learning outcome deleted' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};


// ─── Lessons ─────────────────────────────────────────────────────────

const createLesson = async (req, res) => {
    const { 
        class_id, subject_id, strand_id, sub_strand_id, learning_outcome_id, 
        title, key_inquiry_questions, core_competencies, values, pcis, lesson_date,
        activities 
    } = req.body;
    const teacher_id = req.user.id;
    const school_id = req.user.school_id;

    try {
        // 1. Insert Lesson
        const { data: lesson, error: lessonError } = await supabase.safeQuery(() =>
            supabase
                .from('lessons')
                .insert([{
                    school_id, teacher_id, class_id, subject_id, strand_id, sub_strand_id, 
                    learning_outcome_id, title, key_inquiry_questions, 
                    core_competencies, values, pcis, lesson_date
                }])
                .select()
                .single()
        );

        if (lessonError) throw lessonError;

        // 2. Insert Activities if any
        if (activities && Array.isArray(activities) && activities.length > 0) {
            const activitiesData = activities.map(act => ({
                lesson_id: lesson.id,
                type: act.type,
                description: act.description
            }));
            const { error: actError } = await supabase.safeQuery(() =>
                supabase.from('lesson_activities').insert(activitiesData)
            );
            if (actError) throw actError;
        }

        res.status(201).json(lesson);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const getLessons = async (req, res) => {
    const { class_id, subject_id } = req.query;
    try {
        let query = supabase.from('lessons').select('*, strands(name), sub_strands(name)');
        if (class_id) query = query.eq('class_id', class_id);
        if (subject_id) query = query.eq('subject_id', subject_id);
        
        const { data, error } = await supabase.safeQuery(() => query.order('lesson_date', { ascending: false }));
        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getLessonDetails = async (req, res) => {
    const { id } = req.params;
    try {
        const { data, error } = await supabase.safeQuery(() =>
            supabase
                .from('lessons')
                .select('*, strands(name), sub_strands(name), learning_outcomes(description), lesson_activities(*)')
                .eq('id', id)
                .single()
        );

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(404).json({ error: 'Lesson not found' });
    }
};

// ─── Assessments ─────────────────────────────────────────────────────

const assessCompetency = async (req, res) => {
    const { student_id, learning_outcome_id, lesson_id, level, comments } = req.body;
    const teacher_id = req.user.id;
    const school_id = req.user.school_id;

    try {
        const { data, error } = await supabase.safeQuery(() =>
            supabase
                .from('competency_assessments')
                .insert([{
                    school_id, student_id, teacher_id, learning_outcome_id, lesson_id, level, comments
                }])
                .select()
                .single()
        );

        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const getStudentCompetencyReport = async (req, res) => {
    const { student_id } = req.params;
    const { subject_id } = req.query;

    try {
        let query = supabase
            .from('competency_assessments')
            .select(`
                *,
                learning_outcomes(description, sub_strands(name, strands(name, subjects(name)))),
                lessons(title)
            `)
            .eq('student_id', student_id);

        const { data, error } = await supabase.safeQuery(() => query.order('created_at', { ascending: false }));
        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ─── Portfolio ───────────────────────────────────────────────────────

const uploadPortfolioEvidence = async (req, res) => {
    const { student_id, lesson_id, title, evidence_url, evidence_type } = req.body;
    const school_id = req.user.school_id;

    try {
        const { data, error } = await supabase.safeQuery(() =>
            supabase
                .from('learner_portfolios')
                .insert([{
                    school_id, student_id, lesson_id, title, evidence_url, evidence_type
                }])
                .select()
                .single()
        );

        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const getStudentPortfolio = async (req, res) => {
    const { student_id } = req.params;
    try {
        const { data, error } = await supabase.safeQuery(() =>
            supabase
                .from('learner_portfolios')
                .select('*, lessons(title, subject_id, subjects(name))')
                .eq('student_id', student_id)
                .order('created_at', { ascending: false })
        );

        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const addPortfolioComment = async (req, res) => {
    const { id } = req.params;
    const { teacher_comments } = req.body;
    
    try {
        const { data, error } = await supabase.safeQuery(() =>
            supabase
                .from('learner_portfolios')
                .update({ teacher_comments })
                .eq('id', id)
                .select()
                .single()
        );

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

module.exports = {
    getStrands,
    createStrand,
    updateStrand,
    deleteStrand,
    getSubStrands,
    createSubStrand,
    updateSubStrand,
    deleteSubStrand,
    getLearningOutcomes,
    createLearningOutcome,
    updateLearningOutcome,
    deleteLearningOutcome,
    createLesson,
    getLessons,
    getLessonDetails,
    assessCompetency,
    getStudentCompetencyReport,
    uploadPortfolioEvidence,
    getStudentPortfolio,
    addPortfolioComment
};
