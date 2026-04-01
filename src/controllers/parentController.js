const supabase = require('../config/supabase');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ─── Get Parent Profile ──────────────────────────────────────────────
const getProfile = async (req, res) => {
  try {
    const { data: user, error } = await supabase.safeQuery(() =>
      supabase
        .from('users')
        .select('*, schools(*)')
        .eq('id', req.user.id)
        .single()
    );

    if (error) throw error;

    // Get matching students (dynamic match by phone and school)
    const { data: students } = await supabase.safeQuery(() =>
      supabase
        .from('users')
        .select('id, name, email, avatar_url, student_id, parent_name')
        .eq('role', 'student')
        .eq('school_id', user.school_id)
        .eq('parent_contact', user.phone)
    );

    // If parent doesn't have a name yet (is "Parent"), try to use student's recorded parent_name
    let resolvedName = user.name;
    if ((!resolvedName || resolvedName === 'Parent') && students?.length > 0) {
      resolvedName = students[0].parent_name || 'Parent';
    }

    const { password_hash, ...safeUser } = user;
    res.json({
      ...safeUser,
      name: resolvedName,
      students: (students || []).map(s => ({
        ...s,
        relationship: 'parent'
      }))
    });
  } catch (error) {
    console.error('Parent getProfile error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ─── Get Linked Students ─────────────────────────────────────────────
const getStudents = async (req, res) => {
  try {
    // 1. Get the parent's phone to match students
    const { data: parent, error: parentError } = await supabase.safeQuery(() =>
      supabase.from('users').select('phone, school_id').eq('id', req.user.id).single()
    );

    if (parentError || !parent) {
      throw parentError || new Error('Parent not found');
    }

    // 2. Fetch students dynamically by matching phone and school
    const { data: students, error } = await supabase.safeQuery(() =>
      supabase
        .from('users')
        .select('id, name, email, avatar_url, student_id')
        .eq('role', 'student')
        .eq('school_id', parent.school_id)
        .eq('parent_contact', parent.phone)
    );

    if (error) throw error;
    if (!students || students.length === 0) return res.json([]);

    const studentIds = students.map(s => s.id);

    // Get enrollment info for each student
    const { data: enrollments } = await supabase.safeQuery(() =>
      supabase
        .from('enrollments')
        .select('student_id, classes(id, name, grade_level)')
        .in('student_id', studentIds)
    );

    const enrollmentMap = {};
    (enrollments || []).forEach(e => {
      enrollmentMap[e.student_id] = e.classes;
    });

    const result = students.map(s => ({
      ...s,
      class: enrollmentMap[s.id] || null,
      relationship: 'parent'
    }));

    res.json(result);
  } catch (error) {
    console.error('Parent getStudents error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ─── Get Student Performance (exam results) ──────────────────────────
const getStudentPerformance = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { term, year, exam_type } = req.query;

    // Verify parent access: Student's parent_contact must match Parent's phone
    const { data: parent } = await supabase.from('users').select('phone, school_id').eq('id', req.user.id).single();
    const { data: student } = await supabase
      .from('users')
      .select('id, parent_contact, school_id')
      .eq('id', studentId)
      .single();

    if (!student || student.parent_contact !== parent.phone || student.school_id !== parent.school_id) {
      return res.status(403).json({ error: 'You do not have access to this student\'s data' });
    }

    let query = supabase
      .from('exam_results')
      .select('*, subjects(name, code), classes(name)')
      .eq('student_id', studentId)
      .eq('school_id', req.user.school_id);

    if (term) query = query.eq('term', term);
    if (year) query = query.eq('year', year);
    if (exam_type) query = query.eq('exam_type', exam_type);

    const { data, error } = await supabase.safeQuery(() =>
      query.order('created_at', { ascending: false })
    );

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Parent getStudentPerformance error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ─── Get Student Report Card ─────────────────────────────────────────
const getStudentReportCard = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Access check: match student parent_contact with parent phone
    const { data: parent } = await supabase.from('users').select('phone, school_id').eq('id', req.user.id).single();
    const { data: student } = await supabase
      .from('users')
      .select('id, parent_contact, school_id')
      .eq('id', studentId)
      .single();

    if (!student || student.parent_contact !== parent.phone || student.school_id !== parent.school_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get student's enrollment
    const { data: enrollment } = await supabase.safeQuery(() =>
      supabase
        .from('enrollments')
        .select('class_id, classes(name)')
        .eq('student_id', studentId)
        .single()
    );

    if (!enrollment) return res.json({ class_name: 'Not Enrolled', subjects: [] });

    // Fetch CATs for this class
    const { data: cats } = await supabase.safeQuery(() =>
      supabase
        .from('cats')
        .select('*, subjects(name, code)')
        .eq('class_id', enrollment.class_id)
    );

    // Fetch student's submissions
    const { data: submissions } = await supabase.safeQuery(() =>
      supabase
        .from('submissions')
        .select('*')
        .eq('student_id', studentId)
        .in('cat_id', (cats || []).map(c => c.id))
    );

    // Group scores by subject
    const subjectMap = {};
    (cats || []).forEach(cat => {
      const subjectName = cat.subjects?.name;
      if (!subjectMap[subjectName]) {
        subjectMap[subjectName] = {
          subject_name: subjectName,
          subject_code: cat.subjects?.code,
          grades: { 'CAT 1': null, 'CAT 2': null, 'End Term': null }
        };
      }

      const sub = (submissions || []).find(s => s.cat_id === cat.id);
      if (sub && sub.marks_obtained !== null) {
        const score = (parseFloat(sub.marks_obtained) / parseFloat(sub.max_score || 1) * 100).toFixed(1);
        subjectMap[subjectName].grades[cat.exam_type] = score;
      }
    });

    res.json({
      class_name: enrollment.classes?.name,
      subjects: Object.values(subjectMap)
    });
  } catch (error) {
    console.error('Parent getStudentReportCard error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ─── Get Dashboard Stats ─────────────────────────────────────────────
const getDashboardStats = async (req, res) => {
  try {
    // 1. Get the parent's phone to match students
    const { data: parent, error: parentError } = await supabase.safeQuery(() =>
      supabase.from('users').select('phone, school_id').eq('id', req.user.id).single()
    );

    if (parentError || !parent) {
      throw parentError || new Error('Parent not found');
    }

    // 2. Fetch students dynamically by matching phone and school
    const { data: students, error } = await supabase.safeQuery(() =>
      supabase
        .from('users')
        .select('id, name, avatar_url, student_id')
        .eq('role', 'student')
        .eq('school_id', parent.school_id)
        .eq('parent_contact', parent.phone)
    );

    if (error) throw error;
    if (!students || students.length === 0) {
      return res.json({ students: [], averageScore: 0, totalSubjects: 0, recentResults: [] });
    }

    const studentIds = students.map(s => s.id);

    // Get enrollments
    const { data: enrollments } = await supabase.safeQuery(() =>
      supabase
        .from('enrollments')
        .select('student_id, classes(id, name, grade_level)')
        .in('student_id', studentIds)
    );

    // Get recent exam results
    const { data: recentResults } = await supabase.safeQuery(() =>
      supabase
        .from('exam_results')
        .select('*, subjects(name), classes(name)')
        .in('student_id', studentIds)
        .eq('school_id', req.user.school_id)
        .order('created_at', { ascending: false })
        .limit(20)
    );

    // Calculate average
    const scores = (recentResults || []).filter(r => r.score !== null).map(r => parseFloat(r.score));
    const averageScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 0;

    // Get subject count
    const subjectIds = [...new Set((recentResults || []).map(r => r.subject_id))];

    // Get unread notifications count
    const { data: notifCount } = await supabase.safeQuery(() =>
      supabase
        .from('notifications')
        .select('id', { count: 'exact' })
        .or(`recipient_id.eq.${req.user.id},recipient_id.is.null`)
        .eq('is_read', false)
    );

    // Get unread messages count
    const { data: msgCount } = await supabase.safeQuery(() =>
      supabase
        .from('messages')
        .select('id', { count: 'exact' })
        .eq('receiver_id', req.user.id)
        .eq('read_status', false)
    );

    const enrollmentMap = {};
    (enrollments || []).forEach(e => {
      enrollmentMap[e.student_id] = e.classes;
    });

    // Get latest school announcements (broadcasts)
    const { data: announcements } = await supabase.safeQuery(() =>
      supabase
        .from('notifications')
        .select('*')
        .is('recipient_id', null)
        .eq('school_id', req.user.school_id)
        .order('created_at', { ascending: false })
        .limit(5)
    );

    res.json({
      students: (students || []).map(s => ({
        ...s,
        class: enrollmentMap[s.id] || null
      })),
      averageScore: parseFloat(averageScore),
      totalSubjects: subjectIds.length,
      recentResults: (recentResults || []).map(r => ({
        ...r,
        student_name: (students || []).find(s => s.id === r.student_id)?.name || 'Student'
      })),
      announcements: announcements || [],
      unreadNotifications: notifCount?.length || 0,
      unreadMessages: msgCount?.length || 0
    });
  } catch (error) {
    console.error('Parent getDashboardStats error:', error);
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
    console.error('Parent getNotifications error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ─── Mark Notification Read ──────────────────────────────────────────
const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.safeQuery(() =>
      supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('recipient_id', req.user.id)
    );

    if (error) throw error;
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Get Messages (conversations list) ───────────────────────────────
const getMessages = async (req, res) => {
  try {
    // Get all messages involving this parent
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('messages')
        .select('*, sender:users!parent_messages_sender_id_fkey(id, name, avatar_url, role), receiver:users!parent_messages_receiver_id_fkey(id, name, avatar_url, role)')
        .or(`sender_id.eq.${req.user.id},receiver_id.eq.${req.user.id}`)
        .order('created_at', { ascending: false })
    );

    if (error) throw error;

    // Group by conversation partner (teacher)
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
    
    res.json(Object.values(conversations));
  } catch (error) {
    console.error('Parent getMessages error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ─── Get Conversation with specific teacher ──────────────────────────
const getConversation = async (req, res) => {
  try {
    const { teacherId } = req.params;

    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('messages')
        .select('*, sender:users!parent_messages_sender_id_fkey(id, name, avatar_url)')
        .or(`and(sender_id.eq.${req.user.id},receiver_id.eq.${teacherId}),and(sender_id.eq.${teacherId},receiver_id.eq.${req.user.id})`)
        .order('created_at', { ascending: true })
    );

    if (error) throw error;

    // Mark received messages as read
    await supabase.safeQuery(() =>
      supabase
        .from('messages')
        .update({ read_status: true })
        .eq('sender_id', teacherId)
        .eq('receiver_id', req.user.id)
        .eq('read_status', false)
    );

    res.json(data || []);
  } catch (error) {
    console.error('Parent getConversation error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ─── Send Message ────────────────────────────────────────────────────
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
    console.error('Parent sendMessage error:', error);
    res.status(400).json({ error: error.message });
  }
};

// ─── Mark Message Read ───────────────────────────────────────────────
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

// ─── Get Teachers (for starting new conversations) ───────────────────
const getTeachers = async (req, res) => {
  try {
    // 1. Get the parent's phone to match students
    const { data: parent, error: parentError } = await supabase.safeQuery(() =>
      supabase.from('users').select('phone, school_id').eq('id', req.user.id).single()
    );

    if (parentError || !parent) {
      throw parentError || new Error('Parent not found');
    }

    // 2. Fetch students dynamically by matching phone and school
    const { data: students, error: studentError } = await supabase.safeQuery(() =>
      supabase
        .from('users')
        .select('id')
        .eq('role', 'student')
        .eq('school_id', parent.school_id)
        .eq('parent_contact', parent.phone)
    );

    if (studentError) throw studentError;
    if (!students || students.length === 0) return res.json([]);

    const studentIds = students.map(s => s.id);

    // Get enrollments
    const { data: enrollments } = await supabase.safeQuery(() =>
      supabase
        .from('enrollments')
        .select('class_id')
        .in('student_id', studentIds)
    );

    const classIds = [...new Set((enrollments || []).map(e => e.class_id))];
    if (classIds.length === 0) return res.json([]);

    // Get teachers for these classes
    const { data: classSubjects } = await supabase.safeQuery(() =>
      supabase
        .from('class_subjects')
        .select('teacher_id, subjects(name)')
        .in('class_id', classIds)
        .not('teacher_id', 'is', null)
    );

    const teacherIds = [...new Set((classSubjects || []).map(cs => cs.teacher_id))];
    if (teacherIds.length === 0) return res.json([]);

    const { data: teachers, error } = await supabase.safeQuery(() =>
      supabase
        .from('users')
        .select('id, name, email, avatar_url')
        .in('id', teacherIds)
    );

    if (error) throw error;

    // Map subjects to teachers
    const teacherSubjects = {};
    (classSubjects || []).forEach(cs => {
      if (!teacherSubjects[cs.teacher_id]) {
        teacherSubjects[cs.teacher_id] = [];
      }
      if (cs.subjects?.name && !teacherSubjects[cs.teacher_id].includes(cs.subjects.name)) {
        teacherSubjects[cs.teacher_id].push(cs.subjects.name);
      }
    });

    const result = (teachers || []).map(t => ({
      ...t,
      subjects: teacherSubjects[t.id] || []
    }));

    res.json(result);
  } catch (error) {
    console.error('Parent getTeachers error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ─── Setup Parent Profile ──────────────────────────────────────────────
const setupParentProfile = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const { data: updatedUser, error } = await supabase.safeQuery(() =>
      supabase
        .from('users')
        .update({
          email: email.toLowerCase().trim(),
          password_hash
        })
        .eq('id', req.user.id)
        .select('*, schools(*)')
        .single()
    );

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Email is already in use by another account' });
      }
      throw error;
    }

    const { password_hash: _hash, ...safeUser } = updatedUser;
    
    // Issue a new token
    const token = jwt.sign(
      { id: safeUser.id, role: safeUser.role, school_id: safeUser.school_id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '365d' }
    );

    res.json({ message: 'Profile setup successfully', user: safeUser, token });
  } catch (error) {
    console.error('Setup profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getProfile,
  getStudents,
  getStudentPerformance,
  getStudentReportCard,
  getDashboardStats,
  getNotifications,
  markNotificationRead,
  getMessages,
  getConversation,
  sendMessage,
  markMessageRead,
  getTeachers,
  setupParentProfile
};
