const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const { sendEmail } = require('../services/brevoService');
const fs = require('fs');
const path = require('path');

// ─── Helper function for consistent logging ─────────────────────────
// ... rest of helper functions ...

// ─── User Registration (Admin registers teachers + students) ─────────
const registerUser = async (req, res) => {
  const { school_id, role, name, email, phone, password: providedPassword, student_id, parent_contact, class_id } = req.body;
  const password = providedPassword || '12345678';
  
  logInfo('registerUser', 'Registration attempt', { 
    email, 
    role, 
    name, 
    school_id: school_id || req.user?.school_id,
  });

  if (!name || !email || !role) {
    logWarning('registerUser', 'Missing required fields');
    return res.status(400).json({ error: 'Name, email, and role are required' });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const insertData = {
      school_id: school_id || req.user.school_id,
      role,
      name,
      email: email.toLowerCase().trim(),
      phone,
      password_hash,
      student_id,
      parent_contact,
      is_active: true,
    };

    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('users')
        .insert([insertData])
        .select('id, school_id, role, name, email, phone, student_id, parent_contact, is_active, created_at')
        .single()
    );

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'A user with this email already exists' });
      }
      throw error;
    }

    // Enrollment logic (unchanged)
    if (role === 'student' && class_id) {
       await supabase.safeQuery(() =>
        supabase.from('enrollments').insert([{ student_id: data.id, class_id }])
      );
    }

    // Fetch school details
    const { data: school } = await supabase.safeQuery(() =>
      supabase.from('schools').select('name, logo_url').eq('id', insertData.school_id).single()
    );

    // Send welcome email using template
    const templatePath = path.join(__dirname, '../emails/Login-email.html');
    if (fs.existsSync(templatePath)) {
      let htmlContent = fs.readFileSync(templatePath, 'utf8');
      const roleName = role.charAt(0).toUpperCase() + role.slice(1);
      
      htmlContent = htmlContent
        .replace(/{{school_logo}}/g, school?.logo_url || 'https://trespics.com/logo.png')
        .replace(/{{school_name}}/g, school?.name || 'Our School')
        .replace(/{{recipient_name}}/g, name)
        .replace(/{{user_role}}/g, roleName)
        .replace(/{{default_password}}/g, password);

      sendEmail(
        email,
        `Welcome to ${school?.name || 'Trespics Academy'}`,
        htmlContent
      ).catch(err => logError('registerUser', err, { context: 'Email sending' }));
    } else {
      sendEmail(
        email,
        "Welcome to Trespics Academy",
        `<h1>Welcome ${name}!</h1><p>Your account as <strong>${role}</strong> has been created.</p><p>Login Password: <strong>${password}</strong></p>`
      ).catch(err => logError('registerUser', err, { context: 'Fallback email sending' }));
    }

    res.status(201).json(data);
  } catch (error) {
    logError('registerUser', error);
    res.status(400).json({ error: error.message });
  }
};

// ─── Get All Users ───────────────────────────────────────────────────
const getUsers = async (req, res) => {
  logInfo('getUsers', 'Fetching users list', { 
    userRole: req.user?.role,
    schoolId: req.user?.school_id,
    roleFilter: req.query.role 
  });

  try {
    let query = supabase
      .from('users')
      .select('id, school_id, role, name, email, phone, student_id, parent_contact, is_active, avatar_url, created_at')
      .order('created_at', { ascending: false });

    // Filter by school if user has one
    if (req.user.school_id) {
      logInfo('getUsers', 'Applying school filter', { schoolId: req.user.school_id });
      query = query.eq('school_id', req.user.school_id);
    }

    // Filter by role if provided
    if (req.query.role) {
      logInfo('getUsers', 'Applying role filter', { role: req.query.role });
      query = query.eq('role', req.query.role);
    }

    const { data, error } = await supabase.safeQuery(() => query);
    
    if (error) {
      logError('getUsers', error);
      throw error;
    }

    logSuccess('getUsers', `Retrieved ${data?.length || 0} users`);
    res.json(data);
  } catch (error) {
    logError('getUsers', error);
    res.status(500).json({ error: error.message });
  }
};

// ─── Update User ─────────────────────────────────────────────────────
const updateUser = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  logInfo('updateUser', 'Updating user', { userId: id, updates });

  try {
    const updateData = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.email !== undefined) updateData.email = updates.email.toLowerCase().trim();
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.role !== undefined) updateData.role = updates.role;
    if (updates.is_active !== undefined) updateData.is_active = updates.is_active;
    if (updates.student_id !== undefined) updateData.student_id = updates.student_id;
    if (updates.parent_contact !== undefined) updateData.parent_contact = updates.parent_contact;

    logInfo('updateUser', 'Applying updates', updateData);

    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('users')
        .update(updateData)
        .eq('id', id)
        .select('id, school_id, role, name, email, phone, student_id, parent_contact, is_active, avatar_url, created_at')
        .single()
    );

    if (error) {
      logError('updateUser', error, { userId: id, updates: updateData });
      throw error;
    }

    logSuccess('updateUser', 'User updated successfully', { userId: id, email: data.email });
    res.json(data);
  } catch (error) {
    logError('updateUser', error);
    res.status(400).json({ error: error.message });
  }
};

// ─── Delete User ─────────────────────────────────────────────────────
const deleteUser = async (req, res) => {
  const { id } = req.params;
  
  logInfo('deleteUser', 'Attempting to delete user', { userId: id, requestedBy: req.user?.id });

  try {
    const { error } = await supabase.safeQuery(() =>
      supabase
        .from('users')
        .delete()
        .eq('id', id)
    );

    if (error) {
      logError('deleteUser', error, { userId: id });
      throw error;
    }

    logSuccess('deleteUser', 'User deleted successfully', { userId: id });
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    logError('deleteUser', error);
    res.status(500).json({ error: error.message });
  }
};

// ─── Dashboard Stats ─────────────────────────────────────────────────
const getDashboardStats = async (req, res) => {
  logInfo('getDashboardStats', 'Fetching dashboard stats', { 
    userId: req.user?.id,
    schoolId: req.user?.school_id 
  });

  try {
    const schoolFilter = req.user.school_id;

    // Get user counts by role
    logInfo('getDashboardStats', 'Fetching user counts');
    let usersQuery = supabase.from('users').select('role', { count: 'exact' });
    if (schoolFilter) usersQuery = usersQuery.eq('school_id', schoolFilter);
    const { data: users, error: usersError } = await supabase.safeQuery(() => usersQuery);
    
    if (usersError) {
      logError('getDashboardStats', usersError, { context: 'Fetching users' });
      throw usersError;
    }

    const totalStudents = users ? users.filter(u => u.role === 'student').length : 0;
    const totalTeachers = users ? users.filter(u => u.role === 'teacher').length : 0;

    logInfo('getDashboardStats', `Found ${totalStudents} students, ${totalTeachers} teachers`);

    // Get class count
    logInfo('getDashboardStats', 'Fetching class count');
    let classQuery = supabase.from('classes').select('id', { count: 'exact' });
    if (schoolFilter) classQuery = classQuery.eq('school_id', schoolFilter);
    const { count: totalClasses, error: classError } = await supabase.safeQuery(() => classQuery);
    
    if (classError) {
      logError('getDashboardStats', classError, { context: 'Fetching classes' });
      throw classError;
    }

    // Get pending materials count
    logInfo('getDashboardStats', 'Fetching pending materials count');
    let materialsQuery = supabase.from('materials').select('id', { count: 'exact', head: true }).eq('is_public', false);
    if (schoolFilter) materialsQuery = materialsQuery.eq('school_id', schoolFilter);
    const { count: pendingMaterials, error: materialsError } = await supabase.safeQuery(() => materialsQuery);

    if (materialsError) {
      logError('getDashboardStats', materialsError, { context: 'Fetching pending materials' });
      throw materialsError;
    }

    // Get pending past papers count
    logInfo('getDashboardStats', 'Fetching pending past papers count');
    let pastPapersQuery = supabase.from('past_papers').select('id', { count: 'exact', head: true }).eq('is_public', false);
    if (schoolFilter) pastPapersQuery = pastPapersQuery.eq('school_id', schoolFilter);
    const { count: pendingPastPapers, error: pastPapersError } = await supabase.safeQuery(() => pastPapersQuery);

    if (pastPapersError) {
      logError('getDashboardStats', pastPapersError, { context: 'Fetching pending past papers' });
      throw pastPapersError;
    }

    const stats = {
      totalStudents,
      totalTeachers,
      totalClasses: totalClasses || 0,
      pendingMaterials: (pendingMaterials || 0) + (pendingPastPapers || 0),
    };

    logSuccess('getDashboardStats', 'Dashboard stats retrieved', stats);
    res.json(stats);
  } catch (error) {
    logError('getDashboardStats', error);
    res.status(500).json({ error: error.message });
  }
};

// ─── Get School ──────────────────────────────────────────────────────
const getSchool = async (req, res) => {
  logInfo('getSchool', 'Fetching school details', { userId: req.user?.id, schoolId: req.user?.school_id });

  try {
    if (!req.user.school_id) {
      logInfo('getSchool', 'User has no school association');
      return res.json(null);
    }

    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('schools')
        .select('*')
        .eq('id', req.user.school_id)
        .single()
    );

    if (error) {
      logError('getSchool', error, { schoolId: req.user.school_id });
      throw error;
    }

    logSuccess('getSchool', 'School details retrieved', data);
    res.json(data);
  } catch (error) {
    logError('getSchool', error);
    res.status(500).json({ error: error.message });
  }
};

// ─── Update School ───────────────────────────────────────────────────
const updateSchool = async (req, res) => {
  const updates = req.body;
  
  logInfo('updateSchool', 'Updating school details', { 
    schoolId: req.user?.school_id, 
    updates 
  });

  try {
    const updateData = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.address !== undefined) updateData.address = updates.address;
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.logo_url !== undefined) updateData.logo_url = updates.logo_url;
    if (updates.motto !== undefined) updateData.motto = updates.motto;

    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('schools')
        .update(updateData)
        .eq('id', req.user.school_id)
        .select()
        .single()
    );

    if (error) {
      logError('updateSchool', error, { schoolId: req.user.school_id, updates: updateData });
      throw error;
    }

    logSuccess('updateSchool', 'School updated successfully', data);
    res.json(data);
  } catch (error) {
    logError('updateSchool', error);
    res.status(400).json({ error: error.message });
  }
};

// ─── Announcements CRUD ──────────────────────────────────────────────
const getAnnouncements = async (req, res) => {
  logInfo('getAnnouncements', 'Fetching announcements', { schoolId: req.user?.school_id });

  try {
    let query = supabase
      .from('notifications')
      .select('*')
      .is('recipient_id', null)
      .order('created_at', { ascending: false });

    if (req.user.school_id) {
      query = query.eq('school_id', req.user.school_id);
    }

    const { data, error } = await supabase.safeQuery(() => query);
    
    if (error) {
      logError('getAnnouncements', error);
      throw error;
    }

    logSuccess('getAnnouncements', `Retrieved ${data?.length || 0} announcements`);
    res.json(data || []);
  } catch (error) {
    logError('getAnnouncements', error);
    res.status(500).json({ error: error.message });
  }
};

const createAnnouncement = async (req, res) => {
  const { title, message, type, recipient_id } = req.body;
  
  logInfo('createAnnouncement', 'Creating new announcement', { 
    title, 
    type, 
    schoolId: req.user?.school_id 
  });

  if (!title || !message) {
    logWarning('createAnnouncement', 'Missing required fields', { title: !!title, message: !!message });
    return res.status(400).json({ error: 'Title and message are required' });
  }

  try {
    const insertData = {
      school_id: req.user.school_id,
      sender_id: req.user.id,
      recipient_id: recipient_id || null, // null = broadcast
      title,
      message,
      type: type || 'general',
      is_read: false,
    };

    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('notifications')
        .insert([insertData])
        .select()
        .single()
    );

    if (error) {
      logError('createAnnouncement', error, { insertData });
      throw error;
    }

    logSuccess('createAnnouncement', 'Announcement created successfully', { id: data.id, title: data.title });
    res.status(201).json(data);
  } catch (error) {
    logError('createAnnouncement', error);
    res.status(400).json({ error: error.message });
  }
};

const deleteAnnouncement = async (req, res) => {
  const { id } = req.params;
  
  logInfo('deleteAnnouncement', 'Deleting announcement', { 
    announcementId: id, 
    schoolId: req.user?.school_id 
  });

  try {
    const { error } = await supabase.safeQuery(() =>
      supabase
        .from('notifications')
        .delete()
        .eq('id', id)
    );

    if (error) {
      logError('deleteAnnouncement', error, { announcementId: id });
      throw error;
    }

    logSuccess('deleteAnnouncement', 'Announcement deleted successfully', { id });
    res.json({ message: 'Announcement deleted' });
  } catch (error) {
    logError('deleteAnnouncement', error);
    res.status(500).json({ error: error.message });
  }
};

// ─── Materials (Content Approval) ────────────────────────────────────
const getMaterials = async (req, res) => {
  logInfo('getMaterials', 'Fetching materials', { 
    schoolId: req.user?.school_id,
    statusFilter: req.query.status 
  });

  try {
    let query = supabase
      .from('materials')
      .select('*, users(name)')
      .order('created_at', { ascending: false });

    if (req.user.school_id) {
      query = query.eq('school_id', req.user.school_id);
    }

    const { data, error } = await supabase.safeQuery(() => query);
    
    if (error) {
      logError('getMaterials', error);
      throw error;
    }

    logSuccess('getMaterials', `Retrieved ${data?.length || 0} materials`);
    res.json(data || []);
  } catch (error) {
    logError('getMaterials', error);
    res.status(500).json({ error: error.message });
  }
};

const flagMaterial = async (req, res) => {
  const { id } = req.params;
  
  logInfo('flagMaterial', 'Flagging material as inappropriate', { 
    materialId: id, 
    schoolId: req.user?.school_id 
  });

  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('materials')
        .update({ is_flagged: true })
        .eq('id', id)
        .select('*, users(name)')
        .single()
    );

    if (error) {
      logError('flagMaterial', error, { materialId: id });
      throw error;
    }

    logSuccess('flagMaterial', `Material flagged successfully`, { 
      id: data.id, 
      title: data.title
    });
    res.json(data);
  } catch (error) {
    logError('flagMaterial', error);
    res.status(500).json({ error: error.message });
  }
};

const unflagMaterial = async (req, res) => {
  const { id } = req.params;
  
  logInfo('unflagMaterial', 'Removing flag from material', { 
    materialId: id, 
    schoolId: req.user?.school_id 
  });

  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('materials')
        .update({ is_flagged: false })
        .eq('id', id)
        .select('*, users(name)')
        .single()
    );

    if (error) {
      logError('unflagMaterial', error, { materialId: id });
      throw error;
    }

    logSuccess('unflagMaterial', `Material flag removed successfully`, { 
      id: data.id, 
      title: data.title
    });
    res.json(data);
  } catch (error) {
    logError('unflagMaterial', error);
    res.status(500).json({ error: error.message });
  }
};

const createMaterial = async (req, res) => {
  const { class_id, subject_id, title, description, type, file_url, content_link, is_public } = req.body;
  
  logInfo('createMaterial', 'Creating new material', { 
    title, 
    type, 
    class_id, 
    subject_id,
    userId: req.user?.id,
    schoolId: req.user?.school_id 
  });

  if (!title || !type) {
    logWarning('createMaterial', 'Missing required fields', { title: !!title, type: !!type });
    return res.status(400).json({ error: 'Title and type are required' });
  }

  try {
    const insertData = {
      school_id: req.user.school_id,
      teacher_id: req.user.id,
      class_id,
      subject_id,
      title,
      description,
      type,
      file_url,
      content_link,
      is_public: is_public !== undefined ? is_public : true
    };

    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('materials')
        .insert([insertData])
        .select()
        .single()
    );

    if (error) {
      logError('createMaterial', error, { insertData });
      throw error;
    }

    logSuccess('createMaterial', 'Material created successfully', { 
      id: data.id, 
      title: data.title,
      is_public: data.is_public 
    });
    res.status(201).json(data);
  } catch (error) {
    logError('createMaterial', error);
    res.status(400).json({ error: error.message });
  }
};

const updateMaterial = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  logInfo('updateMaterial', 'Updating material', { 
    materialId: id, 
    updates,
    schoolId: req.user?.school_id 
  });

  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('materials')
        .update(updates)
        .eq('id', id)
        .eq('school_id', req.user.school_id)
        .select()
        .single()
    );

    if (error) {
      logError('updateMaterial', error, { materialId: id, updates });
      throw error;
    }

    logSuccess('updateMaterial', 'Material updated successfully', { id: data.id, title: data.title });
    res.json(data);
  } catch (error) {
    logError('updateMaterial', error);
    res.status(400).json({ error: error.message });
  }
};

const deleteMaterial = async (req, res) => {
  const { id } = req.params;
  
  logInfo('deleteMaterial', 'Deleting material', { 
    materialId: id, 
    schoolId: req.user?.school_id 
  });

  try {
    const { error } = await supabase.safeQuery(() =>
      supabase
        .from('materials')
        .delete()
        .eq('id', id)
        .eq('school_id', req.user.school_id)
    );

    if (error) {
      logError('deleteMaterial', error, { materialId: id });
      throw error;
    }

    logSuccess('deleteMaterial', 'Material deleted successfully', { id });
    res.json({ message: 'Material deleted' });
  } catch (error) {
    logError('deleteMaterial', error);
    res.status(500).json({ error: error.message });
  }
};

// ─── Classes ─────────────────────────────────────────────────────────
const createClass = async (req, res) => {
  const { name } = req.body;
  
  logInfo('createClass', 'Creating new class', { 
    name, 
    schoolId: req.user?.school_id 
  });

  if (!name) {
    logWarning('createClass', 'Missing class name');
    return res.status(400).json({ error: 'Class name is required' });
  }

  try {
    const insertData = { school_id: req.user.school_id, name, grade_level: req.body.grade_level || 0 };
    
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('classes')
        .insert([insertData])
        .select()
        .single()
    );

    if (error) {
      logError('createClass', error, { insertData });
      throw error;
    }

    logSuccess('createClass', 'Class created successfully', { id: data.id, name: data.name, grade_level: data.grade_level });
    res.status(201).json(data);
  } catch (error) {
    logError('createClass', error);
    res.status(400).json({ error: error.message });
  }
};

// ─── Get Classes ─────────────────────────────────────────────────────
const getClasses = async (req, res) => {
  logInfo('getClasses', 'Fetching classes with counts', { schoolId: req.user?.school_id });

  try {
    // We fetch classes and use Supabase's count feature for related tables
    // Note: This assumes the relationships are correctly defined in Supabase
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('classes')
        .select(`
          *,
          enrollments(count),
          class_subjects(count)
        `)
        .eq('school_id', req.user.school_id)
        .order('grade_level', { ascending: true })
        .order('name', { ascending: true })
    );

    if (error) {
      logError('getClasses', error);
      throw error;
    }

    // Map the counts to a flatter structure for easier frontend consumption
    const classesWithCounts = data.map(c => ({
      ...c,
      student_count: c.enrollments?.[0]?.count || 0,
      subject_count: c.class_subjects?.[0]?.count || 0
    }));

    logSuccess('getClasses', `Retrieved ${classesWithCounts.length} classes with counts`);
    res.json(classesWithCounts);
  } catch (error) {
    logError('getClasses', error);
    res.status(500).json({ error: error.message });
  }
};

const updateClass = async (req, res) => {
  const { id } = req.params;
    const { name, grade_level } = req.body;
  
  logInfo('updateClass', 'Updating class', { classId: id, name, grade_level });

  try {
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (grade_level !== undefined) updateData.grade_level = grade_level;

    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('classes')
        .update(updateData)
        .eq('id', id)
        .eq('school_id', req.user.school_id)
        .select()
        .single()
    );

    if (error) {
      logError('updateClass', error, { classId: id, name });
      throw error;
    }

    logSuccess('updateClass', 'Class updated successfully', { id: data.id, name: data.name });
    res.json(data);
  } catch (error) {
    logError('updateClass', error);
    res.status(400).json({ error: error.message });
  }
};

const deleteClass = async (req, res) => {
  const { id } = req.params;
  
  logInfo('deleteClass', 'Deleting class', { classId: id, schoolId: req.user?.school_id });

  try {
    const { error } = await supabase.safeQuery(() =>
      supabase
        .from('classes')
        .delete()
        .eq('id', id)
        .eq('school_id', req.user.school_id)
    );

    if (error) {
      logError('deleteClass', error, { classId: id });
      throw error;
    }

    logSuccess('deleteClass', 'Class deleted successfully', { id });
    res.json({ message: 'Class deleted successfully' });
  } catch (error) {
    logError('deleteClass', error);
    res.status(500).json({ error: error.message });
  }
};

// ─── Teacher Assignments ─────────────────────────────────────────────
const getTeacherAssignments = async (req, res) => {
  const { class_id } = req.query;
  logInfo('getTeacherAssignments', 'Fetching teacher assignments', { class_id });

  try {
    let query = supabase
      .from('class_subjects')
      .select('*, classes!inner(id, name, school_id), subjects!inner(id, name, code, image_url, school_id), users(name)');
    
    if (req.user.school_id) {
      query = query.eq('classes.school_id', req.user.school_id);
    }

    if (class_id) {
      query = query.eq('class_id', class_id);
    }

    const { data, error } = await supabase.safeQuery(() => query.order('id'));
    
    if (error) {
      logError('getTeacherAssignments', error);
      throw error;
    }

    logSuccess('getTeacherAssignments', `Retrieved ${data?.length || 0} assignments`);
    res.json(data || []);
  } catch (error) {
    logError('getTeacherAssignments', error);
    res.status(500).json({ error: error.message });
  }
};

const assignTeacherToClass = async (req, res) => {
  const { class_id, subject_id, teacher_id } = req.body;
  
  logInfo('assignTeacherToClass', 'Assigning teacher to class', { 
    class_id, 
    subject_id, 
    teacher_id 
  });

  if (!class_id || !subject_id) {
    logWarning('assignTeacherToClass', 'Missing required fields', { class_id: !!class_id, subject_id: !!subject_id });
    return res.status(400).json({ error: 'Class and subject are required' });
  }

  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('class_subjects')
        .upsert({ class_id, subject_id, teacher_id }, { onConflict: 'class_id,subject_id' })
        .select()
        .single()
    );

    if (error) {
      logError('assignTeacherToClass', error, { class_id, subject_id, teacher_id });
      throw error;
    }

    logSuccess('assignTeacherToClass', 'Teacher assigned successfully', { 
      id: data.id, 
      class_id, 
      subject_id, 
      teacher_id 
    });
    res.status(201).json(data);
  } catch (error) {
    logError('assignTeacherToClass', error);
    res.status(400).json({ error: error.message });
  }
};

const removeTeacherAssignment = async (req, res) => {
  const { id } = req.params;
  
  logInfo('removeTeacherAssignment', 'Removing teacher assignment', { assignmentId: id });

  try {
    const { error } = await supabase.safeQuery(() => supabase.from('class_subjects').delete().eq('id', id));
    
    if (error) {
      logError('removeTeacherAssignment', error, { assignmentId: id });
      throw error;
    }

    logSuccess('removeTeacherAssignment', 'Assignment removed successfully', { id });
    res.json({ message: 'Assignment removed' });
  } catch (error) {
    logError('removeTeacherAssignment', error);
    res.status(500).json({ error: error.message });
  }
};

// ─── Grade-Wide Subjects ─────────────────────────────────────────────
const getGradeSubjects = async (req, res) => {
  const { grade_level } = req.query;
  const school_id = req.user.school_id;

  logInfo('getGradeSubjects', 'Fetching grade-wide subjects', { grade_level, school_id });

  try {
    let query = supabase
      .from('grade_subjects')
      .select('*, subjects(*)')
      .eq('school_id', school_id);
    
    if (grade_level) {
      query = query.eq('grade_level', grade_level);
    }

    const { data, error } = await supabase.safeQuery(() => query.order('grade_level'));
    
    if (error) {
      logError('getGradeSubjects', error, { grade_level });
      throw error;
    }

    logSuccess('getGradeSubjects', 'Grade subjects fetched successfully', { count: data.length });
    res.json(data);
  } catch (error) {
    logError('getGradeSubjects', error);
    res.status(500).json({ error: error.message });
  }
};

const assignSubjectToGrade = async (req, res) => {
  const { grade_level, subject_id } = req.body;
  const school_id = req.user.school_id;

  logInfo('assignSubjectToGrade', 'Assigning subject to grade level', { grade_level, subject_id, school_id });

  if (!grade_level || !subject_id) {
    return res.status(400).json({ error: 'Grade level and subject ID are required' });
  }

  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('grade_subjects')
        .upsert({ school_id, grade_level, subject_id }, { onConflict: 'school_id,grade_level,subject_id' })
        .select()
        .single()
    );

    if (error) {
      logError('assignSubjectToGrade', error, { grade_level, subject_id });
      throw error;
    }

    logSuccess('assignSubjectToGrade', 'Subject assigned to grade successfully', { id: data.id });
    res.status(201).json(data);
  } catch (error) {
    logError('assignSubjectToGrade', error);
    res.status(400).json({ error: error.message });
  }
};

const removeGradeSubject = async (req, res) => {
  const { id } = req.params;
  
  logInfo('removeGradeSubject', 'Removing grade-wide subject association', { id });

  try {
    const { error } = await supabase.safeQuery(() => 
      supabase.from('grade_subjects').delete().eq('id', id)
    );
    
    if (error) {
      logError('removeGradeSubject', error, { id });
      throw error;
    }

    logSuccess('removeGradeSubject', 'Association removed successfully', { id });
    res.json({ message: 'Association removed' });
  } catch (error) {
    logError('removeGradeSubject', error);
    res.status(500).json({ error: error.message });
  }
};

// ─── Student Enrollments ─────────────────────────────────────────────
const getEnrollments = async (req, res) => {
  const { class_id } = req.query;
  
  logInfo('getEnrollments', 'Fetching enrollments', { class_id });

  try {
    let query = supabase.from('enrollments').select('*, users!student_id(name, email), classes(name)');
    if (class_id) {
      logInfo('getEnrollments', 'Applying class filter', { class_id });
      query = query.eq('class_id', class_id);
    }
    
    const { data, error } = await supabase.safeQuery(() => query);
    
    if (error) {
      logError('getEnrollments', error);
      throw error;
    }

    logSuccess('getEnrollments', `Retrieved ${data?.length || 0} enrollments`);
    res.json(data || []);
  } catch (error) {
    logError('getEnrollments', error);
    res.status(500).json({ error: error.message });
  }
};

const enrollStudent = async (req, res) => {
  const { student_id, class_id } = req.body;
  
  logInfo('enrollStudent', 'Enrolling student in class', { student_id, class_id });

  if (!student_id || !class_id) {
    logWarning('enrollStudent', 'Missing required fields', { student_id: !!student_id, class_id: !!class_id });
    return res.status(400).json({ error: 'Student and class are required' });
  }

  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('enrollments')
        .upsert({ student_id, class_id }, { onConflict: 'student_id,class_id' })
        .select()
        .single()
    );

    if (error) {
      logError('enrollStudent', error, { student_id, class_id });
      throw error;
    }

    logSuccess('enrollStudent', 'Student enrolled successfully', { 
      id: data.id, 
      student_id, 
      class_id 
    });
    res.status(201).json(data);
  } catch (error) {
    logError('enrollStudent', error);
    res.status(400).json({ error: error.message });
  }
};

const unenrollStudent = async (req, res) => {
  const { id } = req.params;
  
  logInfo('unenrollStudent', 'Unenrolling student', { enrollmentId: id });

  try {
    const { error } = await supabase.safeQuery(() => supabase.from('enrollments').delete().eq('id', id));
    
    if (error) {
      logError('unenrollStudent', error, { enrollmentId: id });
      throw error;
    }

    logSuccess('unenrollStudent', 'Student unenrolled successfully', { id });
    res.json({ message: 'Student unenrolled' });
  } catch (error) {
    logError('unenrollStudent', error);
    res.status(500).json({ error: error.message });
  }
};

const promoteStudents = async (req, res) => {
  logInfo('promoteStudents', 'Starting student promotion process', { 
    requestedBy: req.user?.id,
    schoolId: req.user?.school_id 
  });

  try {
    const school_id = req.user.school_id;

    // 1. Get all classes for this school, ordered by grade_level
    const { data: classes, error: classError } = await supabase.safeQuery(() =>
      supabase
        .from('classes')
        .select('id, grade_level')
        .eq('school_id', school_id)
        .order('grade_level', { ascending: true })
    );

    if (classError) throw classError;

    if (!classes || classes.length < 2) {
      return res.status(400).json({ error: 'Need at least two classes to perform promotion' });
    }

    // 2. Create a mapping of current class_id to next class_id
    const promotionMap = {};
    for (let i = 0; i < classes.length - 1; i++) {
      promotionMap[classes[i].id] = classes[i + 1].id;
    }
    // Note: Students in the last class (highest grade_level) are not promoted here.
    // They might need a graduation process.

    // 3. Get all current enrollments
    const { data: enrollments, error: enrollError } = await supabase.safeQuery(() =>
      supabase
        .from('enrollments')
        .select('id, student_id, class_id')
    );

    if (enrollError) throw enrollError;

    let promotedCount = 0;
    let errors = [];

    // 4. Update each enrollment with the next class_id
    for (const enrollment of enrollments) {
      const nextClassId = promotionMap[enrollment.class_id];
      if (nextClassId) {
        logInfo('promoteStudents', `Promoting student ${enrollment.student_id} to class ${nextClassId}`);
        const { error: updateError } = await supabase.safeQuery(() =>
          supabase
            .from('enrollments')
            .update({ class_id: nextClassId })
            .eq('id', enrollment.id)
        );

        if (updateError) {
          logError('promoteStudents', updateError, { enrollmentId: enrollment.id });
          errors.push({ enrollmentId: enrollment.id, error: updateError.message });
        } else {
          promotedCount++;
        }
      }
    }

    logSuccess('promoteStudents', 'Promotion process completed', { promotedCount, errorCount: errors.length });
    
    res.json({ 
      message: 'Promotion process completed', 
      promotedCount, 
      errors: errors.length > 0 ? errors : undefined 
    });
  } catch (error) {
    logError('promoteStudents', error);
    res.status(500).json({ error: error.message });
  }
};

// ─── Subjects ────────────────────────────────────────────────────────
const getSubjects = async (req, res) => {
  logInfo('getSubjects', 'Fetching subjects', { schoolId: req.user?.school_id });

  try {
    let query = supabase.from('subjects').select('*').order('name');
    if (req.user.school_id) {
      query = query.eq('school_id', req.user.school_id);
    }
    
    const { data, error } = await supabase.safeQuery(() => query);
    
    if (error) {
      logError('getSubjects', error);
      throw error;
    }

    logSuccess('getSubjects', `Retrieved ${data?.length || 0} subjects`);
    res.json(data || []);
  } catch (error) {
    logError('getSubjects', error);
    res.status(500).json({ error: error.message });
  }
};

const createSubject = async (req, res) => {
  const { name, code, image_url } = req.body;
  
  logInfo('createSubject', 'Creating new subject', { 
    name, 
    code, 
    schoolId: req.user?.school_id 
  });

  if (!name) {
    logWarning('createSubject', 'Missing subject name');
    return res.status(400).json({ error: 'Subject name is required' });
  }

  try {
    const insertData = {
      school_id: req.user.school_id,
      name,
      code,
      image_url
    };

    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('subjects')
        .insert([insertData])
        .select()
        .single()
    );

    if (error) {
      logError('createSubject', error, { insertData });
      throw error;
    }

    logSuccess('createSubject', 'Subject created successfully', { id: data.id, name: data.name, code: data.code });
    res.status(201).json(data);
  } catch (error) {
    logError('createSubject', error);
    res.status(400).json({ error: error.message });
  }
};

const updateSubject = async (req, res) => {
  const { id } = req.params;
  const { name, code, image_url } = req.body;
  
  logInfo('updateSubject', 'Updating subject', { 
    subjectId: id, 
    name, 
    code 
  });

  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('subjects')
        .update({ name, code, image_url })
        .eq('id', id)
        .eq('school_id', req.user.school_id)
        .select()
        .single()
    );

    if (error) {
      logError('updateSubject', error, { subjectId: id, name, code });
      throw error;
    }

    logSuccess('updateSubject', 'Subject updated successfully', { id: data.id, name: data.name });
    res.json(data);
  } catch (error) {
    logError('updateSubject', error);
    res.status(400).json({ error: error.message });
  }
};

const deleteSubject = async (req, res) => {
  const { id } = req.params;
  
  logInfo('deleteSubject', 'Deleting subject', { 
    subjectId: id, 
    schoolId: req.user?.school_id 
  });

  try {
    const { error } = await supabase.safeQuery(() =>
      supabase
        .from('subjects')
        .delete()
        .eq('id', id)
        .eq('school_id', req.user.school_id)
    );

    if (error) {
      logError('deleteSubject', error, { subjectId: id });
      throw error;
    }

    logSuccess('deleteSubject', 'Subject deleted successfully', { id });
    res.json({ message: 'Subject deleted' });
  } catch (error) {
    logError('deleteSubject', error);
    res.status(500).json({ error: error.message });
  }
};

// ─── Activity Logs ───────────────────────────────────────────────────
const getActivityLogs = async (req, res) => {
  logInfo('getActivityLogs', 'Fetching activity logs', { schoolId: req.user?.school_id });

  try {
    let query = supabase
      .from('activity_logs')
      .select('*, users(name)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (req.user.school_id) {
      query = query.eq('school_id', req.user.school_id);
    }

    const { data, error } = await supabase.safeQuery(() => query);
    
    if (error) {
      logError('getActivityLogs', error);
      throw error;
    }

    logSuccess('getActivityLogs', `Retrieved ${data?.length || 0} activity logs`);
    res.json(data || []);
  } catch (error) {
    logError('getActivityLogs', error);
    res.status(500).json({ error: error.message });
  }
};

// ─── CBC Curriculum Management ───────────────────────────────────────
const getStrands = async (req, res) => {
  const { subject_id } = req.query;
  
  logInfo('getStrands', 'Fetching strands', { 
    subject_id, 
    schoolId: req.user?.school_id 
  });

  try {
    let query = supabase.from('strands').select('*').eq('school_id', req.user.school_id);
    if (subject_id) {
      query = query.eq('subject_id', subject_id);
    }
    
    const { data, error } = await supabase.safeQuery(() => query.order('name'));
    
    if (error) {
      logError('getStrands', error);
      throw error;
    }

    logSuccess('getStrands', `Retrieved ${data?.length || 0} strands`);
    res.json(data || []);
  } catch (error) {
    logError('getStrands', error);
    res.status(500).json({ error: error.message });
  }
};

const createStrand = async (req, res) => {
  const { subject_id, name } = req.body;
  
  logInfo('createStrand', 'Creating new strand', { 
    subject_id, 
    name, 
    schoolId: req.user?.school_id 
  });

  if (!subject_id || !name) {
    logWarning('createStrand', 'Missing required fields', { subject_id: !!subject_id, name: !!name });
    return res.status(400).json({ error: 'Subject and name are required' });
  }

  try {
    const insertData = { 
      school_id: req.user.school_id, 
      subject_id, 
      name 
    };

    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('strands')
        .insert([insertData])
        .select()
        .single()
    );

    if (error) {
      logError('createStrand', error, { insertData });
      throw error;
    }

    logSuccess('createStrand', 'Strand created successfully', { 
      id: data.id, 
      name: data.name, 
      subject_id: data.subject_id 
    });
    res.status(201).json(data);
  } catch (error) {
    logError('createStrand', error);
    res.status(400).json({ error: error.message });
  }
};

const updateStrand = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  
  logInfo('updateStrand', 'Updating some strand', { 
    strandId: id, 
    name, 
    schoolId: req.user?.school_id 
  });

  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('strands')
        .update({ name })
        .eq('id', id)
        .eq('school_id', req.user.school_id)
        .select()
        .single()
    );

    if (error) {
      logError('updateStrand', error, { strandId: id, name });
      throw error;
    }

    logSuccess('updateStrand', 'Strand updated successfully', { id: data.id, name: data.name });
    res.json(data);
  } catch (error) {
    logError('updateStrand', error);
    res.status(400).json({ error: error.message });
  }
};

const deleteStrand = async (req, res) => {
  const { id } = req.params;
  
  logInfo('deleteStrand', 'Deleting strand', { 
    strandId: id, 
    schoolId: req.user?.school_id 
  });

  try {
    const { error } = await supabase.safeQuery(() =>
      supabase
        .from('strands')
        .delete()
        .eq('id', id)
        .eq('school_id', req.user.school_id)
    );

    if (error) {
      logError('deleteStrand', error, { strandId: id });
      throw error;
    }

    logSuccess('deleteStrand', 'Strand deleted successfully', { id });
    res.json({ message: 'Strand deleted' });
  } catch (error) {
    logError('deleteStrand', error);
    res.status(500).json({ error: error.message });
  }
};

const getSubStrands = async (req, res) => {
  const { strand_id } = req.query;
  
  logInfo('getSubStrands', 'Fetching sub-strands', { 
    strand_id, 
    schoolId: req.user?.school_id 
  });

  try {
    let query = supabase.from('sub_strands').select('*').eq('school_id', req.user.school_id);
    if (strand_id) {
      query = query.eq('strand_id', strand_id);
    }
    
    const { data, error } = await supabase.safeQuery(() => query.order('name'));
    
    if (error) {
      logError('getSubStrands', error);
      throw error;
    }

    logSuccess('getSubStrands', `Retrieved ${data?.length || 0} sub-strands`);
    res.json(data || []);
  } catch (error) {
    logError('getSubStrands', error);
    res.status(500).json({ error: error.message });
  }
};

const createSubStrand = async (req, res) => {
  const { strand_id, name } = req.body;
  
  logInfo('createSubStrand', 'Creating new sub-strand', { 
    strand_id, 
    name, 
    schoolId: req.user?.school_id 
  });

  if (!strand_id || !name) {
    logWarning('createSubStrand', 'Missing required fields', { strand_id: !!strand_id, name: !!name });
    return res.status(400).json({ error: 'Strand and name are required' });
  }

  try {
    const insertData = { 
      school_id: req.user.school_id, 
      strand_id, 
      name 
    };

    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('sub_strands')
        .insert([insertData])
        .select()
        .single()
    );

    if (error) {
      logError('createSubStrand', error, { insertData });
      throw error;
    }

    logSuccess('createSubStrand', 'Sub-strand created successfully', { 
      id: data.id, 
      name: data.name, 
      strand_id: data.strand_id 
    });
    res.status(201).json(data);
  } catch (error) {
    logError('createSubStrand', error);
    res.status(400).json({ error: error.message });
  }
};

const updateSubStrand = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  
  logInfo('updateSubStrand', 'Updating sub-strand', { 
    subStrandId: id, 
    name, 
    schoolId: req.user?.school_id 
  });

  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('sub_strands')
        .update({ name })
        .eq('id', id)
        .eq('school_id', req.user.school_id)
        .select()
        .single()
    );

    if (error) {
      logError('updateSubStrand', error, { subStrandId: id, name });
      throw error;
    }

    logSuccess('updateSubStrand', 'Sub-strand updated successfully', { id: data.id, name: data.name });
    res.json(data);
  } catch (error) {
    logError('updateSubStrand', error);
    res.status(400).json({ error: error.message });
  }
};

const deleteSubStrand = async (req, res) => {
  const { id } = req.params;
  
  logInfo('deleteSubStrand', 'Deleting sub-strand', { 
    subStrandId: id, 
    schoolId: req.user?.school_id 
  });

  try {
    const { error } = await supabase.safeQuery(() =>
      supabase
        .from('sub_strands')
        .delete()
        .eq('id', id)
        .eq('school_id', req.user.school_id)
    );

    if (error) {
      logError('deleteSubStrand', error, { subStrandId: id });
      throw error;
    }

    logSuccess('deleteSubStrand', 'Sub-strand deleted successfully', { id });
    res.json({ message: 'Sub-strand deleted' });
  } catch (error) {
    logError('deleteSubStrand', error);
    res.status(500).json({ error: error.message });
  }
};

const getLearningOutcomes = async (req, res) => {
  const { sub_strand_id } = req.query;
  
  logInfo('getLearningOutcomes', 'Fetching learning outcomes', { 
    sub_strand_id, 
    schoolId: req.user?.school_id 
  });

  try {
    let query = supabase.from('learning_outcomes').select('*').eq('school_id', req.user.school_id);
    if (sub_strand_id) {
      query = query.eq('sub_strand_id', sub_strand_id);
    }
    
    const { data, error } = await supabase.safeQuery(() => query.order('id'));
    
    if (error) {
      logError('getLearningOutcomes', error);
      throw error;
    }

    logSuccess('getLearningOutcomes', `Retrieved ${data?.length || 0} learning outcomes`);
    res.json(data || []);
  } catch (error) {
    logError('getLearningOutcomes', error);
    res.status(500).json({ error: error.message });
  }
};

const createLearningOutcome = async (req, res) => {
  const { sub_strand_id, description } = req.body;
  
  logInfo('createLearningOutcome', 'Creating new learning outcome', { 
    sub_strand_id, 
    description: description?.substring(0, 50) + '...',
    schoolId: req.user?.school_id 
  });

  if (!sub_strand_id || !description) {
    logWarning('createLearningOutcome', 'Missing required fields', { 
      sub_strand_id: !!sub_strand_id, 
      description: !!description 
    });
    return res.status(400).json({ error: 'Sub-strand and description are required' });
  }

  try {
    const insertData = { 
      school_id: req.user.school_id, 
      sub_strand_id, 
      description 
    };

    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('learning_outcomes')
        .insert([insertData])
        .select()
        .single()
    );

    if (error) {
      logError('createLearningOutcome', error, { insertData });
      throw error;
    }

    logSuccess('createLearningOutcome', 'Learning outcome created successfully', { 
      id: data.id, 
      sub_strand_id: data.sub_strand_id,
      description: data.description?.substring(0, 50) + '...'
    });
    res.status(201).json(data);
  } catch (error) {
    logError('createLearningOutcome', error);
    res.status(400).json({ error: error.message });
  }
};

const updateLearningOutcome = async (req, res) => {
  const { id } = req.params;
  const { description } = req.body;
  
  logInfo('updateLearningOutcome', 'Updating learning outcome', { 
    outcomeId: id, 
    description: description?.substring(0, 50) + '...',
    schoolId: req.user?.school_id 
  });

  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('learning_outcomes')
        .update({ description })
        .eq('id', id)
        .eq('school_id', req.user.school_id)
        .select()
        .single()
    );

    if (error) {
      logError('updateLearningOutcome', error, { outcomeId: id });
      throw error;
    }

    logSuccess('updateLearningOutcome', 'Learning outcome updated successfully', { 
      id: data.id,
      description: data.description?.substring(0, 50) + '...'
    });
    res.json(data);
  } catch (error) {
    logError('updateLearningOutcome', error);
    res.status(400).json({ error: error.message });
  }
};

const deleteLearningOutcome = async (req, res) => {
  const { id } = req.params;
  
  logInfo('deleteLearningOutcome', 'Deleting learning outcome', { 
    outcomeId: id, 
    schoolId: req.user?.school_id 
  });

  try {
    const { error } = await supabase.safeQuery(() =>
      supabase
        .from('learning_outcomes')
        .delete()
        .eq('id', id)
        .eq('school_id', req.user.school_id)
    );

    if (error) {
      logError('deleteLearningOutcome', error, { outcomeId: id });
      throw error;
    }

    logSuccess('deleteLearningOutcome', 'Learning outcome deleted successfully', { id });
    res.json({ message: 'Learning outcome deleted' });
  } catch (error) {
    logError('deleteLearningOutcome', error);
    res.status(500).json({ error: error.message });
  }
};

// ─── Profile Management ──────────────────────────────────────────────
const getProfile = async (req, res) => {
  logInfo('getProfile', 'Fetching user profile', { userId: req.user?.id });

  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('users')
        .select('*, admin_details(*), schools(*)')
        .eq('id', req.user.id)
        .single()
    );

    if (error) {
      logError('getProfile', error, { userId: req.user.id });
      throw error;
    }

    const { password_hash, ...safeUser } = data;
    
    logSuccess('getProfile', 'Profile retrieved successfully', { 
      userId: safeUser.id, 
      name: safeUser.name,
      role: safeUser.role 
    });
    res.json(safeUser);
  } catch (error) {
    logError('getProfile', error);
    res.status(500).json({ error: error.message });
  }
};

const updateProfile = async (req, res) => {
  const { name, phone, avatar_url, department, position } = req.body;
  
  logInfo('updateProfile', 'Updating user profile', { 
    userId: req.user?.id,
    updates: { name, phone, hasAvatar: !!avatar_url, department, position }
  });

  try {
    // Update users table
    const userUpdates = {};
    if (name !== undefined) userUpdates.name = name;
    if (phone !== undefined) userUpdates.phone = phone;
    if (avatar_url !== undefined) userUpdates.avatar_url = avatar_url;

    if (Object.keys(userUpdates).length > 0) {
      logInfo('updateProfile', 'Updating users table', userUpdates);
      
      const { error: userError } = await supabase.safeQuery(() =>
        supabase
          .from('users')
          .update(userUpdates)
          .eq('id', req.user.id)
      );
      
      if (userError) {
        logError('updateProfile', userError, { table: 'users', userId: req.user.id, updates: userUpdates });
        throw userError;
      }
    }

    // Update admin_details table
    const detailUpdates = {};
    if (department !== undefined) detailUpdates.department = department;
    if (position !== undefined) detailUpdates.position = position;

    if (Object.keys(detailUpdates).length > 0) {
      logInfo('updateProfile', 'Updating admin_details table', detailUpdates);
      
      const { error: detailError } = await supabase.safeQuery(() =>
        supabase
          .from('admin_details')
          .upsert({ user_id: req.user.id, ...detailUpdates }, { onConflict: 'user_id' })
      );
      
      if (detailError) {
        logError('updateProfile', detailError, { table: 'admin_details', userId: req.user.id, updates: detailUpdates });
        throw detailError;
      }
    }

    // Fetch updated profile
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('users')
        .select('*, admin_details(*), schools(*)')
        .eq('id', req.user.id)
        .single()
    );

    if (error) {
      logError('updateProfile', error, { context: 'Fetching updated profile' });
      throw error;
    }

    const { password_hash, ...safeUser } = data;
    
    logSuccess('updateProfile', 'Profile updated successfully', { 
      userId: safeUser.id, 
      name: safeUser.name,
      updatesApplied: { ...userUpdates, ...detailUpdates }
    });
    res.json(safeUser);
  } catch (error) {
    logError('updateProfile', error);
    res.status(400).json({ error: error.message });
  }
};

const getPastPapers = async (req, res) => {
  logInfo('getPastPapers', 'Fetching past papers list', { schoolId: req.user?.school_id });
  try {
    let query = supabase
      .from('past_papers')
      .select('*, users(name), classes(name), subjects(name)')
      .order('created_at', { ascending: false });

    if (req.user.school_id) {
      query = query.eq('school_id', req.user.school_id);
    }

    const { data, error } = await supabase.safeQuery(() => query);
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const flagPastPaper = async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase.from('past_papers').update({ is_flagged: true }).eq('id', id).select().single()
    );
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const unflagPastPaper = async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase.from('past_papers').update({ is_flagged: false }).eq('id', id).select().single()
    );
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deletePastPaperModeration = async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.safeQuery(() =>
      supabase.from('past_papers').delete().eq('id', id)
    );
    if (error) throw error;
    res.json({ message: 'Past paper deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  registerUser,
  getUsers,
  updateUser,
  deleteUser,
  getDashboardStats,
  getSchool,
  updateSchool,
  getAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  getMaterials,
  flagMaterial,
  unflagMaterial,
  deleteMaterial,
  createMaterial,
  updateMaterial,
  getActivityLogs,
  createClass,
  getClasses,
  updateClass,
  deleteClass,
  getTeacherAssignments,
  assignTeacherToClass,
  removeTeacherAssignment,
  getEnrollments,
  enrollStudent,
  unenrollStudent,
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
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
  promoteStudents,
  getPastPapers,
  flagPastPaper,
  unflagPastPaper,
  deletePastPaperModeration,
  getGradeSubjects,
  assignSubjectToGrade,
  removeGradeSubject,

};