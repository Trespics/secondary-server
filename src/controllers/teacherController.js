const supabase = require('../config/supabase');

// ─── Dashboard Stats ─────────────────────────────────────────────────
const getDashboardStats = async (req, res) => {
  const teacher_id = req.user.id;

  try {
    // Classes assigned to this teacher
    const { data: classSubjects } = await supabase.safeQuery(() =>
      supabase
        .from('class_subjects')
        .select('class_id, subject_id, classes(name), subjects(name)')
        .eq('teacher_id', teacher_id)
    );

    const classIds = [...new Set((classSubjects || []).map(cs => cs.class_id))];

    // Count students in those classes
    let studentCount = 0;
    if (classIds.length > 0) {
      const { count } = await supabase.safeQuery(() =>
        supabase
          .from('enrollments')
          .select('id', { count: 'exact' })
          .in('class_id', classIds)
      );
      studentCount = count || 0;
    }

    // Pending grading
    const { count: pendingGrading } = await supabase.safeQuery(async () => {
      const { data: assignments } = await supabase.safeQuery(() => 
        supabase.from('assignments').select('id').eq('teacher_id', teacher_id)
      );
      
      const assignmentIds = assignments?.map(a => a.id) || [];
      if (assignmentIds.length === 0) return { data: [], count: 0 };

      return supabase
        .from('submissions')
        .select('id', { count: 'exact' })
        .eq('status', 'submitted')
        .in('assignment_id', assignmentIds);
    });

    res.json({
      classesAssigned: classIds.length,
      totalStudents: studentCount,
      pendingGrading: pendingGrading || 0,
      classes: classSubjects || [],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Get My Classes ──────────────────────────────────────────────────
const getMyClasses = async (req, res) => {
  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('class_subjects')
        .select('*, classes(*), subjects(*)')
        .eq('teacher_id', req.user.id)
    );

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Get Students in Teacher's Classes ───────────────────────────────
const getMyStudents = async (req, res) => {
  try {
    const { data: classSubjects } = await supabase.safeQuery(() =>
      supabase
        .from('class_subjects')
        .select('class_id')
        .eq('teacher_id', req.user.id)
    );

    const classIds = [...new Set((classSubjects || []).map(cs => cs.class_id))];

    if (classIds.length === 0) return res.json([]);

    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('enrollments')
        .select('*, users(id, name, email, student_id, avatar_url), classes(name)')
        .in('class_id', classIds)
    );

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Upload Material ─────────────────────────────────────────────────
const uploadMaterial = async (req, res) => {
  const teacher_id = req.user.id;

  try {
    // Determine if it's a bulk upload or single upload
    const materialsData = req.body.materials || [req.body];
    
    const insertPayload = materialsData.map(material => ({
      school_id: material.school_id || req.user.school_id,
      teacher_id,
      class_id: material.class_id,
      subject_id: material.subject_id,
      lesson_id: material.lesson_id || null,
      strand_id: material.strand_id || null,
      sub_strand_id: material.sub_strand_id || null,
      learning_outcome_id: material.learning_outcome_id || null,
      title: material.title,
      description: material.description,
      type: material.type,
      file_url: material.file_url,
      content_link: material.content_link,
      is_public: true, // Materials are public immediately now
    }));

    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('materials')
        .insert(insertPayload)
        .select()
    );

    if (error) throw error;
    
    // If it was a single insert, return single object for backwards compatibility, else return array
    if (!req.body.materials && data && data.length === 1) {
      res.status(201).json(data[0]);
    } else {
      res.status(201).json(data);
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ─── Get My Materials ────────────────────────────────────────────────
const getMaterials = async (req, res) => {
  const { sub_strand_id } = req.query;
  const teacher_id = req.user.id;
  try {
    const { data, error } = await supabase.safeQuery(() => {
      let query = supabase
        .from('materials')
        .select('*, classes(*), subjects(*)')
        .eq('teacher_id', teacher_id);
      
      if (sub_strand_id) {
        query = query.eq('sub_strand_id', sub_strand_id);
      }
      return query.order('created_at', { ascending: false });
    });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateMaterial = async (req, res) => {
  const { id } = req.params;
  const { class_id, subject_id, lesson_id, title, description, type, file_url, content_link } = req.body;
  const teacher_id = req.user.id;

  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('materials')
        .update({
          class_id,
          subject_id,
          lesson_id,
          title,
          description,
          type,
          file_url,
          content_link
        })
        .eq('id', id)
        .eq('teacher_id', teacher_id)
        .select()
        .single()
    );

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteMaterial = async (req, res) => {
  const { id } = req.params;
  const teacher_id = req.user.id;

  try {
    const { error } = await supabase.safeQuery(() =>
      supabase
        .from('materials')
        .delete()
        .eq('id', id)
        .eq('teacher_id', teacher_id)
    );

    if (error) throw error;
    res.json({ message: 'Material deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Past Papers ─────────────────────────────────────────────────────
const getPastPapers = async (req, res) => {
  const teacher_id = req.user.id;
  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('past_papers')
        .select('*, classes(name), subjects(name)')
        .eq('teacher_id', teacher_id)
        .order('created_at', { ascending: false })
    );

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const uploadPastPaper = async (req, res) => {
  const teacher_id = req.user.id;
  
  try {
    // Handle both single object and array of objects
    const pastPapersData = Array.isArray(req.body.pastPapers) ? req.body.pastPapers : [req.body];
    
    const insertPayload = pastPapersData.map(paper => ({
      school_id: paper.school_id || req.user.school_id,
      teacher_id,
      class_id: paper.class_id,
      subject_id: paper.subject_id,
      title: paper.title,
      file_url: paper.file_url
    }));
    
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('past_papers')
        .insert(insertPayload)
        .select()
    );

    if (error) throw error;
    
    // Return single object if it was a single insert, else return array
    if (!Array.isArray(req.body.pastPapers) && data && data.length === 1) {
      res.status(201).json(data[0]);
    } else {
      res.status(201).json(data);
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updatePastPaper = async (req, res) => {
  const { id } = req.params;
  const { class_id, subject_id, title, file_url } = req.body;
  const teacher_id = req.user.id;

  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('past_papers')
        .update({ class_id, subject_id, title, file_url })
        .eq('id', id)
        .eq('teacher_id', teacher_id)
        .select()
        .single()
    );

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deletePastPaper = async (req, res) => {
  const { id } = req.params;
  const teacher_id = req.user.id;

  try {
    const { error } = await supabase.safeQuery(() =>
      supabase
        .from('past_papers')
        .delete()
        .eq('id', id)
        .eq('teacher_id', teacher_id)
    );

    if (error) throw error;
    res.json({ message: 'Past paper deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Material Reports ────────────────────────────────────────────────
const getMaterialReports = async (req, res) => {
  const teacher_id = req.user.id;
  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('material_reports')
        .select('*, materials(title, type), users!material_reports_student_id_fkey(name)')
        .eq('teacher_id', teacher_id)
        .order('created_at', { ascending: false })
    );

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const resolveMaterialReport = async (req, res) => {
  const { id } = req.params;
  const teacher_id = req.user.id;

  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('material_reports')
        .update({ status: 'resolved' })
        .eq('id', id)
        .eq('teacher_id', teacher_id)
        .select()
        .single()
    );

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ─── Create Assignment ───────────────────────────────────────────────
const createAssignment = async (req, res) => {
  const { 
    school_id, class_id, subject_id, lesson_id, 
    strand_id, sub_strand_id, learning_outcome_id,
    title, instructions, due_date, is_mcq, file_url,
    questions, time_limit_minutes 
  } = req.body;
  const teacher_id = req.user.id;

  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('assignments')
        .insert([{
          school_id: school_id || req.user.school_id,
          teacher_id,
          class_id,
          subject_id,
          lesson_id,
          strand_id,
          sub_strand_id,
          learning_outcome_id,
          title,
          instructions,
          due_date,
          is_mcq,
          file_url,
          questions: questions || [],
          time_limit_minutes: time_limit_minutes || 0,
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

// ─── Get My Assignments ──────────────────────────────────────────────
const getMyAssignments = async (req, res) => {
  const { sub_strand_id } = req.query;
  const teacher_id = req.user.id;
  try {
    const { data, error } = await supabase.safeQuery(() => {
      let query = supabase
        .from('assignments')
        .select('*, classes(*), subjects(*)')
        .eq('teacher_id', teacher_id);

      if (sub_strand_id) {
        query = query.eq('sub_strand_id', sub_strand_id);
      }
      return query.order('created_at', { ascending: false });
    });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Create CAT ──────────────────────────────────────────────────────
const createCAT = async (req, res) => {
  const { school_id, class_id, subject_id, lesson_id, title, time_limit_minutes, start_time, end_time, questions } = req.body;
  const teacher_id = req.user.id;

  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('cats')
        .insert([{
          school_id: school_id || req.user.school_id,
          teacher_id,
          class_id,
          subject_id,
          lesson_id,
          title,
          time_limit_minutes,
          start_time,
          end_time,
          questions: questions || [],
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

// ─── Get My CATs ─────────────────────────────────────────────────────
const getMyCATs = async (req, res) => {
  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('cats')
        .select('*, classes(name), subjects(name)')
        .eq('teacher_id', req.user.id)
        .order('created_at', { ascending: false })
    );

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Get Submissions for Teacher's Assignments ───────────────────────
const getSubmissions = async (req, res) => {
  try {
    // Get teacher's assignment IDs
    const { data: assignments } = await supabase.safeQuery(() =>
      supabase
        .from('assignments')
        .select('id')
        .eq('teacher_id', req.user.id)
    );

    const assignmentIds = (assignments || []).map(a => a.id);
    if (assignmentIds.length === 0) return res.json([]);

    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('submissions')
        .select('*, assignments(title, subject_id), users(name, student_id)')
        .in('assignment_id', assignmentIds)
        .order('submitted_at', { ascending: false })
    );

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Grade Submission ────────────────────────────────────────────────
const gradeSubmission = async (req, res) => {
  const { submission_id } = req.params;
  const { marks_obtained, feedback } = req.body;

  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('submissions')
        .update({
          marks_obtained,
          feedback,
          status: 'graded',
          graded_at: new Date().toISOString(),
        })
        .eq('id', submission_id)
        .select()
        .single()
    );

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ─── Get Profile ─────────────────────────────────────────────────────
const getProfile = async (req, res) => {
  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('users')
        .select('*, teacher_details(*)')
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

// ─── Update Profile ──────────────────────────────────────────────────
const updateProfile = async (req, res) => {
  const { name, phone, avatar_url, bio, specialization, experience_years } = req.body;

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

    // Update teacher_details table
    const detailUpdates = {};
    if (bio !== undefined) detailUpdates.bio = bio;
    if (specialization !== undefined) detailUpdates.specialization = specialization;
    if (experience_years !== undefined) detailUpdates.experience_years = experience_years;

    if (Object.keys(detailUpdates).length > 0) {
      const { error: detailError } = await supabase.safeQuery(() =>
        supabase
          .from('teacher_details')
          .upsert({ user_id: req.user.id, ...detailUpdates }, { onConflict: 'user_id' })
      );
      if (detailError) throw detailError;
    }

    // Fetch updated profile
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('users')
        .select('*, teacher_details(*)')
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

// ─── Get Notifications ───────────────────────────────────────────────
const getNotifications = async (req, res) => {
  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('notifications')
        .select('*, sender:users!sender_id(name)')
        .or(`recipient_id.eq.${req.user.id},recipient_id.is.null`)
        .order('created_at', { ascending: false })
        .limit(50)
    );

    if (error) throw error;
    
    // Flatten result
    const processed = (data || []).map(n => ({
      ...n,
      sender_name: n.sender?.name || 'System'
    }));

    res.json(processed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createNotification = async (req, res) => {
  const { title, message, type, recipient_id } = req.body;
  const sender_id = req.user.id;
  const school_id = req.user.school_id;

  if (!title || !message) {
    return res.status(400).json({ error: 'Title and message are required' });
  }

  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('notifications')
        .insert([{
          school_id,
          sender_id,
          recipient_id: recipient_id || null, // null means broadcast to school
          title,
          message,
          type: type || 'general',
          is_read: false
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

const deleteNotification = async (req, res) => {
  const { id } = req.params;
  const user_id = req.user.id;

  try {
    const { error } = await supabase.safeQuery(() =>
      supabase
        .from('notifications')
        .delete()
        .eq('id', id)
        .eq('sender_id', user_id) // Can only delete their own
    );

    if (error) throw error;
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const markNotificationAsRead = async (req, res) => {
  const { id } = req.params;
  const user_id = req.user.id;

  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .or(`recipient_id.eq.${user_id},recipient_id.is.null`)
        .select()
        .single()
    );

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const markAllNotificationsAsRead = async (req, res) => {
  const user_id = req.user.id;

  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('notifications')
        .update({ is_read: true })
        .or(`recipient_id.eq.${user_id},recipient_id.is.null`)
        .eq('is_read', false)
        .select()
    );

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  getDashboardStats,
  getMyClasses,
  getMyStudents,
  uploadMaterial,
  getMaterials,
  updateMaterial,
  deleteMaterial,
  createAssignment,
  getMyAssignments,
  createCAT,
  getMyCATs,
  getSubmissions,
  gradeSubmission,
  getProfile,
  updateProfile,   
  getNotifications,
  getMaterialReports,
  resolveMaterialReport,
  getPastPapers,
  uploadPastPaper,
  updatePastPaper,
  deletePastPaper,
  createNotification,
  deleteNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead
};
