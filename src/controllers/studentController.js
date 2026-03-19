const supabase = require('../config/supabase');

// ─── Get Profile ─────────────────────────────────────────────────────
const getProfile = async (req, res) => {
  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('users')
        .select('*, student_details(*)')
        .eq('id', req.user.id)
        .single()
    );

    if (error) throw error;
    const { password_hash, ...safeUser } = data;
    res.json(safeUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateProfile = async (req, res) => {
  const { name, phone, avatar_url, dob, gender, parent_name, parent_phone, address } = req.body;

  try {
    // Update users table
    const userUpdates = {};
    if (name !== undefined) userUpdates.name = name;
    if (phone !== undefined) userUpdates.phone = phone;
    if (avatar_url !== undefined) userUpdates.avatar_url = avatar_url;

    if (Object.keys(userUpdates).length > 0) {
      const { error: userError } = await supabase.safeQuery(() =>
        supabase
          .from('users')
          .update(userUpdates)
          .eq('id', req.user.id)
      );
      if (userError) throw userError;
    }

    // Update student_details table
    const detailUpdates = {};
    if (dob !== undefined) detailUpdates.dob = dob;
    if (gender !== undefined) detailUpdates.gender = gender;
    if (parent_name !== undefined) detailUpdates.parent_name = parent_name;
    if (parent_phone !== undefined) detailUpdates.parent_phone = parent_phone;
    if (address !== undefined) detailUpdates.address = address;

    if (Object.keys(detailUpdates).length > 0) {
      const { error: detailError } = await supabase.safeQuery(() =>
        supabase
          .from('student_details')
          .upsert({ user_id: req.user.id, ...detailUpdates }, { onConflict: 'user_id' })
      );
      if (detailError) throw detailError;
    }

    // Fetch updated profile
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('users')
        .select('*, student_details(*)')
        .eq('id', req.user.id)
        .single()
    );

    if (error) throw error;
    const { password_hash, ...safeUser } = data;
    res.json(safeUser);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ─── Get My Subjects (via enrollment → class_subjects) ───────────────
const getSubjects = async (req, res) => {
  try {
    // Get student's enrollment
    const { data: enrollments } = await supabase.safeQuery(() =>
      supabase
        .from('enrollments')
        .select('class_id')
        .eq('student_id', req.user.id)
    );

    const classIds = (enrollments || []).map(e => e.class_id);
    if (classIds.length === 0) return res.json([]);

    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('class_subjects')
        .select('*, subjects(*), classes(name), users(name)')
        .in('class_id', classIds)
    );

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Get Materials for Student's Classes ─────────────────────────────
const getMyMaterials = async (req, res) => {
  try {
    const { data: enrollments } = await supabase.safeQuery(() =>
      supabase
        .from('enrollments')
        .select('class_id')
        .eq('student_id', req.user.id)
    );

    const classIds = (enrollments || []).map(e => e.class_id);
    if (classIds.length === 0) return res.json([]);

    let query = supabase
      .from('materials')
      .select('*, users(name), subjects(name), classes(name)')
      .in('class_id', classIds)
      .order('created_at', { ascending: false });

    if (req.query.type) {
      query = query.eq('type', req.query.type);
    }

    if (req.query.subject_id) {
      query = query.eq('subject_id', req.query.subject_id);
    }

    const { data, error } = await supabase.safeQuery(() => query);

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Report Material ─────────────────────────────────────────────────
const reportMaterial = async (req, res) => {
  const { id } = req.params; // material_id
  const { reason } = req.body;
  const student_id = req.user.id;

  try {
    // Determine the material's teacher (check materials then past_papers)
    let { data: material, error: matError } = await supabase.safeQuery(() =>
      supabase.from('materials').select('teacher_id').eq('id', id).single()
    );

    if (matError || !material) {
      // Try past_papers table
      const { data: paper, error: paperError } = await supabase.safeQuery(() =>
        supabase.from('past_papers').select('teacher_id').eq('id', id).single()
      );
      
      if (paperError || !paper) {
        return res.status(404).json({ error: 'Material or past paper not found' });
      }
      material = paper;
    }

    if (!material?.teacher_id) {
      return res.status(404).json({ error: 'Teacher not found for this item' });
    }

    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('material_reports')
        .insert([{
          material_id: id,
          student_id,
          teacher_id: material.teacher_id,
          reason,
          status: 'pending'
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

// ─── Get Assignments ─────────────────────────────────────────────────
const getAssignments = async (req, res) => {
  try {
    const { data: enrollments } = await supabase.safeQuery(() =>
      supabase
        .from('enrollments')
        .select('class_id')
        .eq('student_id', req.user.id)
    );

    const classIds = (enrollments || []).map(e => e.class_id);
    if (classIds.length === 0) return res.json([]);

    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('assignments')
        .select('*, users(name), subjects(name), classes(name)')
        .in('class_id', classIds)
        .order('due_date', { ascending: true })
    );

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Submit Assignment ───────────────────────────────────────────────
const submitAssignment = async (req, res) => {
  const { assignment_id, file_url } = req.body;
  const student_id = req.user.id;

  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('submissions')
        .insert([{ assignment_id, student_id, file_url, status: 'submitted' }])
        .select()
        .single()
    );

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ─── Get My Grades ───────────────────────────────────────────────────
const getMyGrades = async (req, res) => {
  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('submissions')
        .select('*, assignments(title, subjects(name))')
        .eq('student_id', req.user.id)
        .eq('status', 'graded')
        .order('graded_at', { ascending: false })
    );

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Get Notifications ───────────────────────────────────────────────
const getNotifications = async (req, res) => {
  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('notifications')
        .select('*')
        .or(`recipient_id.eq.${req.user.id},recipient_id.is.null`)
        .order('created_at', { ascending: false })
        .limit(50)
    );

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Get CATs ────────────────────────────────────────────────────────
const getCATs = async (req, res) => {
  try {
    const { data: enrollments } = await supabase.safeQuery(() =>
      supabase
        .from('enrollments')
        .select('class_id')
        .eq('student_id', req.user.id)
    );

    const classIds = (enrollments || []).map(e => e.class_id);
    if (classIds.length === 0) return res.json([]);

    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('cats')
        .select('*, subjects(name), classes(name)')
        .in('class_id', classIds)
        .order('start_time', { ascending: true })
    );

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Get My Results (all submissions with grades) ────────────────────
const getResults = async (req, res) => {
  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('submissions')
        .select('*, assignments(title, subjects(name, code))')
        .eq('student_id', req.user.id)
        .not('marks_obtained', 'is', null)
        .order('graded_at', { ascending: false })
    );

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Past Papers ─────────────────────────────────────────────────────
const getPastPapers = async (req, res) => {
  try {
    const { data: enrollments } = await supabase.safeQuery(() =>
      supabase
        .from('enrollments')
        .select('class_id')
        .eq('student_id', req.user.id)
    );

    const classIds = (enrollments || []).map(e => e.class_id);
    if (classIds.length === 0) return res.json([]);

    let query = supabase
      .from('past_papers')
      .select('*, users!past_papers_teacher_id_fkey(name), subjects(name), classes(name)')
      .in('class_id', classIds)
      .order('created_at', { ascending: false });

    if (req.query.subject_id) {
      query = query.eq('subject_id', req.query.subject_id);
    }

    const { data, error } = await supabase.safeQuery(() => query);

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getSubjects,
  getMyMaterials,
  getAssignments,
  submitAssignment,
  getMyGrades,
  getNotifications,
  getCATs,
  getResults,
  reportMaterial,
  getPastPapers,
};
