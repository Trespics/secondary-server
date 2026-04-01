const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { sendEmail, sendSMS } = require('../services/brevoService');
     
// In-memory store for OTPs
// Structure: { phoneNumber: { otp: string, expiresAt: number } }
const otpStore = new Map();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';


const login = async (req, res) => {
  const { email, password } = req.body;
  
  console.log('=================================');
  console.log('🔐 LOGIN ATTEMPT');
  console.log('=================================');
  console.log(`📧 Email: ${email}`);
  console.log(`🔑 Password provided: ${password ? 'Yes' : 'No'}`);
  console.log(`🕒 Timestamp: ${new Date().toISOString()}`);
  console.log('---------------------------------');

  if (!email || !password) {
    console.log('❌ Missing credentials');
    console.log(`   Email provided: ${!!email}`);
    console.log(`   Password provided: ${!!password}`);
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    console.log('🔍 Querying database for user (with retry)...');
    const { data: user, error } = await supabase.safeQuery(() => 
      supabase
        .from('users')
        .select('*, schools(*)')
        .or(`email.eq.${email.toLowerCase().trim()},student_id.eq.${email.trim()}`)
        .single()
    );

    if (error) {
      console.log('❌ Database error during login:', error);
      // PGRST116 is "no rows returned" for .single() - this is a 401, not a 500
      if (error.code !== 'PGRST116') {
        return res.status(500).json({ 
          error: 'Connection error. Please try again in a moment.',
          status: 'error',
          details: error.message 
        });
      }
    }

    if (!user) {
      console.log('❌ User not found in database');
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    console.log('✅ User found in database:');
    console.log(`   User ID: ${user.id}`);
    console.log(`   User role: ${user.role}`);
    console.log(`   School ID: ${user.school_id}`);
    console.log(`   Account active: ${user.is_active}`);
    console.log(`   Email in DB: ${user.email}`);

    if (!user.is_active) {
      console.log('❌ Account is deactivated');
      console.log(`   User ID: ${user.id}`);
      console.log(`   Deactivation status: ${user.is_active}`);
      return res.status(403).json({ error: 'Account is deactivated. Contact your administrator.' });
    }

    console.log('🔐 Verifying password...');
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    console.log(`   Password valid: ${isValidPassword}`);
    
    if (!isValidPassword) {
      console.log('❌ Invalid password');
      console.log(`   Password hash from DB: ${user.password_hash.substring(0, 20)}...`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    console.log('✅ Password verified successfully');

    console.log('🎫 Generating long-lived JWT token...');
    const token = jwt.sign(
      { id: user.id, role: user.role, school_id: user.school_id },
      JWT_SECRET,
      { expiresIn: '365d' } // Extended session lifespan
    );
    console.log('✅ Token generated successfully');
    console.log(`   Token expires: 365d`);
    console.log(`   Token payload: { id: ${user.id}, role: ${user.role}, school_id: ${user.school_id || 'null'} }`);

    // Don't send password hash to the client
    const { password_hash, ...safeUser } = user;

    console.log('=================================');
    console.log('✅ LOGIN SUCCESSFUL');
    console.log(`👤 User: ${safeUser.first_name} ${safeUser.last_name} (${safeUser.role})`);
    console.log(`🆔 User ID: ${safeUser.id}`);
    console.log(`🏫 School ID: ${safeUser.school_id}`);
    console.log('=================================');

    res.json({
      token,
      user: safeUser,
    });
  } catch (error) {
    console.log('=================================');
    console.log('❌ LOGIN ERROR - EXCEPTION CAUGHT');
    console.log('=================================');
    console.log(`Error name: ${error.name}`);
    console.log(`Error message: ${error.message}`);
    console.log(`Error stack: ${error.stack}`);
    console.log('=================================');
    
    res.status(500).json({ error: 'Internal server error' });
  }
};

const forgotPassword = async (req, res) => {
  const { email, clientUrl } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const { data: user, error } = await supabase.safeQuery(() =>
      supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .single()
    );

    if (error || !user) {
      return res.status(200).json({ message: 'If the email exists, a reset link has been sent' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated. Contact your administrator.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiryDate = new Date();
    expiryDate.setMinutes(expiryDate.getMinutes() + 30);

    const { error: updateError } = await supabase.safeQuery(() =>
      supabase
        .from('users')
        .update({
          reset_password_token: token,
          reset_password_expires: expiryDate.toISOString()
        })
        .eq('id', user.id)
    );

    if (updateError) {
      console.error('Error updating reset token:', updateError);
      return res.status(500).json({ error: 'Failed to process request' });
    }

    const resetLink = `${clientUrl || 'http://localhost:5173'}/auth/reset-password?token=${token}`;
    const templatePath = path.join(__dirname, '..', 'emails', 'Reset-email.html');
    let emailHtml = fs.readFileSync(templatePath, 'utf8');
    emailHtml = emailHtml.replace(/{{RESET_LINK}}/g, resetLink);

    await sendEmail(
      user.email,
      'Reset Your Florante School Password',
      emailHtml
    );

    res.json({ message: 'Reset link sent successfully' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const { data: user, error } = await supabase.safeQuery(() =>
      supabase
        .from('users')
        .select('*')
        .eq('reset_password_token', token)
        .single()
    );

    if (error || !user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const now = new Date();
    const expiry = new Date(user.reset_password_expires);
    if (now > expiry) {     
      return res.status(400).json({ error: 'Reset token has expired' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    const { error: updateError } = await supabase.safeQuery(() =>
      supabase
        .from('users')
        .update({
          password_hash: passwordHash,
          reset_password_token: null,
          reset_password_expires: null
        })
        .eq('id', user.id)
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      return res.status(500).json({ error: 'Failed to reset password' });
    }

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new passwords are required' });
  }

  try {
    const { data: user, error } = await supabase.safeQuery(() =>
      supabase
        .from('users')
        .select('password_hash')
        .eq('id', userId)
        .single()
    );

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid current password' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    const { error: updateError } = await supabase.safeQuery(() =>
      supabase
        .from('users')
        .update({ password_hash: passwordHash })
        .eq('id', userId)
    );

    if (updateError) throw updateError;

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const sendOtp = async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  try {
    // 1. Check if ANY student has this phone number as parent_contact
    const { data: students, error: studentError } = await supabase.safeQuery(() =>
      supabase
        .from('users')
        .select('id, school_id')
        .eq('role', 'student')
        .eq('parent_contact', phone)
    );

    if (studentError) throw studentError;

    // 2. Or check if a parent already exists with this phone
    const { data: existingParent, error: parentError } = await supabase.safeQuery(() =>
      supabase
        .from('users')
        .select('id')
        .eq('role', 'parent')
        .eq('phone', phone)
        .single()
    );

    if (!students?.length && (!existingParent && parentError?.code === 'PGRST116')) {
        return res.status(404).json({ error: 'No student found linked to this phone number' });
    }

    // Generate a secure 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    otpStore.set(phone, { otp, expiresAt });

    const messageContent = `Your verification code for Florante School is ${otp}. It expires in 5 minutes.`;

    await sendSMS(phone, messageContent);

    console.log(`✅ Brevo SMS OTP request dispatched for ${phone}`);
    res.json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const verifyOtp = async (req, res) => {
  const { phone, otp } = req.body;
  
  if (!phone || !otp) {
    return res.status(400).json({ error: 'Phone and OTP are required' });
  }

  try {
    // Verify local OTP
    const storedOtpData = otpStore.get(phone);
    if (!storedOtpData) {
      return res.status(400).json({ error: 'No active OTP session found for this number' });
    }

    if (Date.now() > storedOtpData.expiresAt) {
      otpStore.delete(phone);
      return res.status(400).json({ error: 'OTP has expired' });
    }

    if (storedOtpData.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    // Clear the OTP once validated
    otpStore.delete(phone);

    // 1. Check if parent user exists in our custom 'users' table
    let { data: parentUser, error: parentError } = await supabase.safeQuery(() =>
      supabase
        .from('users')
        .select('*, schools(*)')
        .eq('role', 'parent')
        .eq('phone', phone)
        .single()
    );

    if (!parentUser && parentError.code === 'PGRST116') {
      // 2. Parent doesn't exist, create them!
      const { data: students, error: studentError } = await supabase.safeQuery(() =>
        supabase
          .from('users')
          .select('id, school_id, parent_name')
          .eq('role', 'student')
          .eq('parent_contact', phone)
      );
      
      if (studentError) throw studentError;

      if (!students || students.length === 0) {
        return res.status(400).json({ error: 'Cannot create parent: no linked student found' });
      }

      const school_id = students[0].school_id;
      const parentName = students[0].parent_name || 'Parent';

      // Generate ID manually since we bypass Supabase Auth
      const newUserId = crypto.randomUUID(); 
      // Generate a random high-entropy dummy password hash
      const dummyPassword = crypto.randomBytes(32).toString('hex');
      const dummyPasswordHash = await bcrypt.hash(dummyPassword, 10);

      const { data: newUser, error: createError } = await supabase.safeQuery(() =>
        supabase
          .from('users')
          .insert([{
            id: newUserId,
            school_id,
            role: 'parent',
            name: parentName,
            phone: phone,
            password_hash: dummyPasswordHash,
            is_active: true
          }])
          .select('*, schools(*)')
          .single()
      );

      if (createError) {
          throw createError;
      } else {
          parentUser = newUser;
      }
      // Note: We no longer insert into 'parents' table here as student matching is dynamic
    } else if (parentError && parentError.code !== 'PGRST116') {
      throw parentError;
    }

    if (!parentUser.is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    const token = jwt.sign(
      { id: parentUser.id, role: parentUser.role, school_id: parentUser.school_id },
      JWT_SECRET,
      { expiresIn: '365d' }
    );

    const { password_hash, ...safeUser } = parentUser;

    res.json({
      token,
      user: safeUser,
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { login, forgotPassword, resetPassword, changePassword, sendOtp, verifyOtp };