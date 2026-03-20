const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const { sendEmail } = require('../services/brevoService');
const fs = require('fs');
const path = require('path');

// ─── School Management ────────────────────────────────────────────────
const createSchool = async (req, res) => {
  const { name, address, phone, email, motto, logo_url } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'School name is required' });
  }

  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('schools')
        .insert([{ name, address, phone, email, motto, logo_url }])
        .select()
        .single()
    );

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'A school with this email already exists' });
      }
      throw error;
    }

    res.status(201).json(data);
  } catch (error) {
    console.error('Create school error:', error);
    res.status(400).json({ error: error.message });
  }
};

const getSchools = async (req, res) => {
  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('schools')
        .select('*')
        .order('created_at', { ascending: false })
    );

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateSchool = async (req, res) => {
  const { id } = req.params;
  const { name, address, phone, email, motto, logo_url } = req.body;

  try {
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (address !== undefined) updates.address = address;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) updates.email = email;
    if (motto !== undefined) updates.motto = motto;
    if (logo_url !== undefined) updates.logo_url = logo_url;

    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('schools')
        .update(updates)
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

const deleteSchool = async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase.safeQuery(() =>
      supabase
        .from('schools')
        .delete()
        .eq('id', id)
    );

    if (error) throw error;
    res.json({ message: 'School deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── School Admin Registration ────────────────────────────────────────
const registerSchoolAdmin = async (req, res) => {
  const { school_id, name, email, phone, password } = req.body;

  if (!school_id || !name || !email || !password) {
    return res.status(400).json({ error: 'School ID, name, email, and password are required' });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('users')
        .insert([{
          school_id,
          role: 'admin',
          name,
          email: email.toLowerCase().trim(),
          phone,
          password_hash,
          is_active: true,
        }])
        .select('id, school_id, role, name, email, phone, is_active, created_at')
        .single()
    );

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'A user with this email already exists' });
      }
      throw error;
    }

    // Send welcome email
    sendEmail(
      email,
      "Welcome to CBC eLearning System",
      `<h1>Welcome ${name}!</h1><p>You have been registered as an administrator for your school.</p><p>You can log in with your email and the password provided by the system administrator.</p>`
    ).catch(err => console.error('Welcome email failed:', err));

    res.status(201).json(data);
  } catch (error) {
    console.error('Register school admin error:', error);
    res.status(400).json({ error: error.message });
  }
};

// ─── Setup Phase (For first-time use) ──────────────────────────────────
const checkSetup = async (req, res) => {
  try {
    const { count, error } = await supabase.safeQuery(() =>
      supabase
        .from('users')     
        .select('id', { count: 'exact', head: true })
        .eq('role', 'superadmin')
    );

    if (error) {
      console.error('Check setup error:', error);
      throw error;
    }
    res.json({ setupRequired: count === 0 });
  } catch (error) {
    console.error('Check setup catch error:', error);
    res.status(500).json({ error: error.message });
  }
};

const setupInitialSuperAdmin = async (req, res) => {
  const { name, email, phone, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('users')
        .insert([{
          role: 'superadmin',
          name,
          email: email.toLowerCase().trim(),
          phone,
          password_hash,
          is_active: true,
        }])
        .select('id, role, name, email, phone, is_active, created_at')
        .single()
    );

    if (error) {
      console.error('Setup insert error:', error);
      throw error;
    }

    res.status(201).json(data);
  } catch (error) {
    console.error('Setup initial superadmin catch error:', error);
    res.status(400).json({ error: error.message });
  }
};

// ─── Superadmin Dashboard Stats ────────────────────────────────────────
const getSuperAdminStats = async (req, res) => {
  try {
    const { count: totalSchools } = await supabase.safeQuery(() => supabase.from('schools').select('id', { count: 'exact' }));
    const { count: totalUsers } = await supabase.safeQuery(() => supabase.from('users').select('id', { count: 'exact' }));
    const { count: totalStudents } = await supabase.safeQuery(() => supabase.from('users').select('id', { count: 'exact' }).eq('role', 'student'));
    const { count: totalTeachers } = await supabase.safeQuery(() => supabase.from('users').select('id', { count: 'exact' }).eq('role', 'teacher'));

    res.json({
      totalSchools: totalSchools || 0,
      totalUsers: totalUsers || 0,
      totalStudents: totalStudents || 0,
      totalTeachers: totalTeachers || 0,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getSchoolAdmins = async (req, res) => {
  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('users')
        .select('id, school_id, role, name, email, phone, is_active, created_at, schools(name)')
        .eq('role', 'admin')
        .order('created_at', { ascending: false })
    );

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Subject Management (Global) ──────────────────────────────────────
const getSubjects = async (req, res) => {
  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('subjects')
        .select('*, schools(name)')
        .order('created_at', { ascending: false })
    );

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createSubject = async (req, res) => {
  const { school_id, name, code, image_url } = req.body;
  if (!school_id || !name) {
    return res.status(400).json({ error: 'School ID and name are required' });
  }

  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('subjects')
        .insert([{ school_id, name, code, image_url }])
        .select()
        .single()
    );

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateSubject = async (req, res) => {
  const { id } = req.params;
  const { name, code, image_url } = req.body;

  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('subjects')
        .update({ name, code, image_url })
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

const deleteSubject = async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase.safeQuery(() =>
      supabase
        .from('subjects')
        .delete()
        .eq('id', id)
    );

    if (error) throw error;
    res.json({ message: 'Subject deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getProfile = async (req, res) => {
  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('users')
        .select('*, super_admin_details(*)')
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
  const { name, phone, avatar_url, position } = req.body;

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

    // Update super_admin_details table
    const detailUpdates = {};
    if (position !== undefined) detailUpdates.position = position;

    if (Object.keys(detailUpdates).length > 0) {
      const { error: detailError } = await supabase.safeQuery(() =>
        supabase
          .from('super_admin_details')
          .upsert({ user_id: req.user.id, ...detailUpdates }, { onConflict: 'user_id' })
      );
      if (detailError) throw detailError;
    }

    // Fetch updated profile
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('users')
        .select('*, super_admin_details(*)')
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

// ─── Class Management (Superadmin) ───────────────────────────────────
const getClasses = async (req, res) => {
  const { school_id } = req.query;
  try {
    let query = supabase.from('classes').select('*, schools(name)');
    if (school_id) {
      query = query.eq('school_id', school_id);
    }
    const { data, error } = await supabase.safeQuery(() => query.order('name'));
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Subject-Class Assignments (Superadmin) ──────────────────────────
const getAssignments = async (req, res) => {
  const { school_id, class_id } = req.query;
  try {
    let query = supabase
      .from('class_subjects')
      .select('*, classes!inner(id, name, school_id), subjects!inner(id, name, code, image_url, school_id), users(name)');

    if (school_id) {
      query = query.eq('classes.school_id', school_id);
    }
    if (class_id) {
      query = query.eq('class_id', class_id);
    }

    const { data, error } = await supabase.safeQuery(() => query);
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const assignSubjectToClass = async (req, res) => {
  const { class_id, subject_id, teacher_id } = req.body;
  
  if (!class_id || !subject_id) {
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

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const removeAssignment = async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.safeQuery(() => supabase.from('class_subjects').delete().eq('id', id));
    if (error) throw error;
    res.json({ message: 'Assignment removed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Contact Messages Management (Superadmin) ────────────────────────
const getContactMessages = async (req, res) => {
  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false })
    );

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const replyToContactMessage = async (req, res) => {
  const { id } = req.params;
  const { reply_message } = req.body;
  const admin_id = req.user.id;

  if (!reply_message) {
    return res.status(400).json({ error: 'Reply message is required' });
  }

  try {
    // 1. Fetch original message
    const { data: contact, error: fetchError } = await supabase.safeQuery(() =>
      supabase.from('contact_messages').select('*').eq('id', id).single()
    );

    if (fetchError || !contact) {
      if (!contact) return res.status(404).json({ error: 'Message not found' });
      throw fetchError;
    }

    if (contact.status === 'replied') {
      return res.status(400).json({ error: 'This message has already been replied to.' });
    }

    // 2. Read HTML Template
    const templatePath = path.join(__dirname, '../emails/Reply-email.html');
    let htmlContent = fs.readFileSync(templatePath, 'utf8');

    // 3. Replace Placeholders
    const userName = contact.name || 'User';
    const originalMessage = contact.message;
    const replyDate = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
    const ticketId = contact.id.split('-')[0].toUpperCase();

    htmlContent = htmlContent
      .replace(/{{User_Name}}/g, userName)
      .replace(/{{Original_Message}}/g, originalMessage)
      .replace(/{{Admin_Reply_Message}}/g, reply_message)
      .replace(/{{Reply_Date}}/g, replyDate)
      .replace(/{{Ticket_ID}}/g, ticketId)
      .replace(/{{Inbox_Link}}/g, 'https://trespics.com/contact')
      .replace(/{{Inbox_Link_Plain}}/g, 'https://trespics.com/contact')
      .replace(/{{Company_Address}}/g, 'Nairobi, Kenya');

    // 4. Send Email
    await sendEmail(
      contact.email,
      `Re: ${contact.subject || 'Your Support Request'}`,
      htmlContent
    );

    // 5. Update Database Record
    const { data: updatedContact, error: updateError } = await supabase.safeQuery(() =>
      supabase
        .from('contact_messages')
        .update({
          status: 'replied',
          reply_message,
          replied_by: admin_id,
          replied_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()
    );

    if (updateError) throw updateError;

    res.json({ message: 'Reply sent successfully', contact: updatedContact });
  } catch (error) {
    console.error('Reply mail error:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  createSchool,
  getSchools,
  updateSchool,
  deleteSchool,
  registerSchoolAdmin,
  getSchoolAdmins,
  getSuperAdminStats,
  checkSetup,
  setupInitialSuperAdmin,
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  getClasses,
  getAssignments,
  assignSubjectToClass,
  removeAssignment,
  getContactMessages,
  replyToContactMessage
};
