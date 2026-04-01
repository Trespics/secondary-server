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
  const { school_id, class_id, subject_id, lesson_id, title, exam_type, term, time_limit_minutes, start_time, end_time, questions } = req.body;
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
          exam_type: exam_type || 'CAT 1',
          term: term || 'Term 1',
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

const getPerformanceData = async (req, res) => {
  const teacher_id = req.user.id;
  try {
    const { data: classSubjects } = await supabase.safeQuery(() =>
      supabase
        .from('class_subjects')
        .select('class_id, subject_id, classes(name), subjects(name)')
        .eq('teacher_id', teacher_id)
    );

    const classIds = [...new Set((classSubjects || []).map(cs => cs.class_id))];
    if (classIds.length === 0) return res.json({ students: [], subjects: [], classes: [] });

    // Fetch enrollments for these classes
    const { data: enrollments } = await supabase.safeQuery(() =>
      supabase
        .from('enrollments')
        .select('*, users(name, student_id), classes(name)')
        .in('class_id', classIds)
    );

    // Fetch exam results for these classes
    const { data: allExamResults } = await supabase.safeQuery(() =>
      supabase
        .from('exam_results')
        .select('*')
        .in('class_id', classIds)
    );

    // Filter to only the teacher's designated subjects for those classes
    const examResults = (allExamResults || []).filter(er => 
      classSubjects.some(cs => cs.class_id === er.class_id && cs.subject_id === er.subject_id)
    );

    // Processing logic for Student Grades, Subject Performance, Class Performance
    // Helper to calculate CBC level
    const getCBCLevel = (score) => {
      if (score >= 75) return 'EE';
      if (score >= 50) return 'ME';
      if (score >= 25) return 'AE';
      return 'BE';
    };

    // 1. Student Grades
    const studentGrades = (enrollments || []).map(e => {
        const studentResults = examResults.filter(r => r.student_id === e.student_id);
        const examGrades = {};
        ['CAT 1', 'CAT 2', 'End Term'].forEach(type => {
            const typeResults = studentResults.filter(r => r.exam_type === type);
            if (typeResults.length > 0) {
                const total = typeResults.reduce((acc, curr) => acc + parseFloat(curr.score), 0);
                examGrades[type] = (total / typeResults.length).toFixed(1);
            } else {
                examGrades[type] = null;
            }
        });

        return {
            student_id: e.student_id,
            name: e.users?.name,
            admission_no: e.users?.student_id,
            class_name: e.classes?.name,
            grades: examGrades
        };
    });

    // 2. Subject Performance
    const subjectPerformance = (classSubjects || []).map(cs => {
        const subjectResults = examResults.filter(r => r.subject_id === cs.subject_id && r.class_id === cs.class_id);
        const performance = {};
        ['CAT 1', 'CAT 2', 'End Term'].forEach(type => {
            const typeResults = subjectResults.filter(r => r.exam_type === type);
            
            if (typeResults.length > 0) {
                const total = typeResults.reduce((acc, curr) => acc + parseFloat(curr.score), 0);
                const average = total / typeResults.length;
                performance[type] = {
                    average: average.toFixed(1),
                    level: getCBCLevel(average)
                };
            } else {
                performance[type] = null;
            }
        });

        return {
            subject_id: cs.subject_id,
            subject_name: cs.subjects?.name,
            class_name: cs.classes?.name,
            performance
        };
    });

    // 3. Class Performance (Aggregated from subjects)
    const classPerformance = classIds.map(cid => {
        const cls = classSubjects.find(cs => cs.class_id === cid);
        const clsSubjects = subjectPerformance.filter(sp => sp.class_name === cls?.classes?.name);
        
        const performance = {};
        ['CAT 1', 'CAT 2', 'End Term'].forEach(type => {
            const typeScores = clsSubjects.map(sp => sp.performance[type]?.average).filter(s => s !== null && s !== undefined).map(s => parseFloat(s));
            if (typeScores.length > 0) {
                const average = typeScores.reduce((acc, curr) => acc + curr, 0) / typeScores.length;
                performance[type] = {
                    average: average.toFixed(1),
                    level: getCBCLevel(average)
                };
            } else {
                performance[type] = null;
            }
        });

        return {
            class_id: cid,
            class_name: cls?.classes?.name,
            performance
        };
    });

    res.json({
      students: studentGrades,
      subjects: subjectPerformance,
      classes: classPerformance
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
// ─── Messaging ───────────────────────────────────────────────────────

const getMessages = async (req, res) => {
  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('messages')
        .select('*, sender:users!parent_messages_sender_id_fkey(id, name, avatar_url, role, phone), receiver:users!parent_messages_receiver_id_fkey(id, name, avatar_url, role, phone)')
        .or(`sender_id.eq.${req.user.id},receiver_id.eq.${req.user.id}`)
        .order('created_at', { ascending: false })
    );

    if (error) throw error;

    const conversations = {};
    (data || []).forEach(msg => {
      const partnerId = msg.sender_id === req.user.id ? msg.receiver_id : msg.sender_id;
      const partner = msg.sender_id === req.user.id ? msg.receiver : msg.sender;

      if (!conversations[partnerId]) {
        conversations[partnerId] = {
          partner,
          lastMessage: msg,
          unreadCount: 0,
          messages: []
        };
      }

      conversations[partnerId].messages.push(msg);

      if (!msg.read_status && msg.receiver_id === req.user.id) {
        conversations[partnerId].unreadCount++;
      }
    });

    // Resolve parent names from student records
    const convList = Object.values(conversations);
    const parentPhones = convList
      .filter((c) => c.partner?.role === 'parent' && c.partner?.phone)
      .map((c) => c.partner.phone);

    if (parentPhones.length > 0) {
      const { data: students } = await supabase.safeQuery(() =>
        supabase
          .from('users')
          .select('parent_name, parent_contact')
          .eq('role', 'student')
          .in('parent_contact', parentPhones)
      );

      if (students?.length) {
        const nameMap = {};
        students.forEach(s => {
          if (s.parent_name && s.parent_contact) nameMap[s.parent_contact] = s.parent_name;
        });
        convList.forEach((c) => {
          if (c.partner?.role === 'parent' && c.partner?.phone && nameMap[c.partner.phone]) {
            c.partner.name = nameMap[c.partner.phone];
          }
        });
      }
    }

    res.json(convList);
  } catch (error) {
    console.error('Teacher getMessages error:', error);
    res.status(500).json({ error: error.message });
  }
};

const getConversation = async (req, res) => {
  try {
    const { parentId } = req.params;

    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('messages')
        .select('*, sender:users!parent_messages_sender_id_fkey(id, name, avatar_url)')
        .or(`and(sender_id.eq.${req.user.id},receiver_id.eq.${parentId}),and(sender_id.eq.${parentId},receiver_id.eq.${req.user.id})`)
        .order('created_at', { ascending: true })
    );

    if (error) throw error;

    await supabase.safeQuery(() =>
      supabase
        .from('messages')
        .update({ read_status: true })
        .eq('sender_id', parentId)
        .eq('receiver_id', req.user.id)
        .eq('read_status', false)
    );

    res.json(data || []);
  } catch (error) {
    console.error('Teacher getConversation error:', error);
    res.status(500).json({ error: error.message });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { receiver_id, message, file_url, file_type } = req.body;

    if (!receiver_id || (!message && !file_url)) {
      return res.status(400).json({ error: 'Receiver and message/file are required' });
    }

    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('messages')
        .insert([{
          school_id: req.user.school_id,
          sender_id: req.user.id,
          receiver_id,
          message: message || '',
          file_url: file_url || null,
          file_type: file_type || null,
          read_status: false
        }])
        .select('*, sender:users!parent_messages_sender_id_fkey(id, name, avatar_url)')
        .single()
    );

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Teacher sendMessage error:', error);
    res.status(400).json({ error: error.message });
  }
};

const markMessageRead = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.safeQuery(() =>
      supabase
        .from('messages')
        .update({ read_status: true })
        .eq('id', id)
        .eq('receiver_id', req.user.id)
    );

    if (error) throw error;
    res.json({ message: 'Message marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getParents = async (req, res) => {
  try {
    // 1. Get teacher's classes
    const { data: classSubjects } = await supabase.safeQuery(() =>
      supabase
        .from('class_subjects')
        .select('class_id')
        .eq('teacher_id', req.user.id)
    );

    const classIds = [...new Set((classSubjects || []).map(cs => cs.class_id))];
    if (classIds.length === 0) return res.json([]);

    // 2. Get students in these classes
    const { data: enrollments } = await supabase.safeQuery(() =>
      supabase
        .from('enrollments')
        .select('student_id')
        .in('class_id', classIds)
    );

    const studentIds = [...new Set((enrollments || []).map(e => e.student_id))];
    if (studentIds.length === 0) return res.json([]);

    // 3. Get student details to find parent info
    const { data: students } = await supabase.safeQuery(() =>
      supabase
        .from('users')
        .select('id, name, parent_name, parent_contact')
        .in('id', studentIds)
        .eq('role', 'student')
    );

    const parentContacts = [...new Set((students || []).map(s => s.parent_contact).filter(c => !!c))];
    if (parentContacts.length === 0) return res.json([]);

    // 4. Find valid parent users by phone/contact
    const { data: parents, error } = await supabase.safeQuery(() =>
      supabase
        .from('users')
        .select('id, name, email, avatar_url, phone')
        .eq('role', 'parent')
        .eq('school_id', req.user.school_id)
        .in('phone', parentContacts)
    );

    if (error) throw error;

    // Map students to parents and resolve real names
    const result = (parents || []).map(p => {
      const parentStudents = (students || []).filter(s => s.parent_contact === p.phone);
      const resolvedName = parentStudents[0]?.parent_name || p.name;
      return {
        ...p,
        name: resolvedName,
        children: parentStudents.map(s => s.name)
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Teacher getParents error:', error);
    res.status(500).json({ error: error.message });
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
  markAllNotificationsAsRead,
  getPerformanceData,
  // Messaging
  getMessages,
  getConversation,
  sendMessage,
  markMessageRead,
  getParents
};
