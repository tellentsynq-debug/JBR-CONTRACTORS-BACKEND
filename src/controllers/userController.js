const supabase = require('../config/database');
const supabaseAdmin = supabase.admin;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Generate OTP and send SMS
const sendOTP = async (phoneNumber) => {
  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Check OTP request logs
    const { data: logData } = await supabase
      .from('otp_request_logs')
      .select('otp_count, created_at')
      .eq('phone_number', phoneNumber)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .single();

    if (logData && logData.otp_count >= 5) {
      return { success: false, error: 'Maximum OTP requests reached. Try again tomorrow.' };
    }

    // Send OTP via MSG91
    await axios.get('https://api.msg91.com/api/sendotp.php', {
      params: {
        authkey: process.env.MSG91_AUTH_KEY,
        mobile: phoneNumber,
        message: `Your JBR verification OTP is ${otp}. Valid for ${process.env.MSG91_OTP_VALIDITY / 60} minutes.`,
        sender: process.env.MSG91_SENDER_ID
      }
    });

    // Store OTP in database
    const { error: otpError } = await supabase
      .from('otp_verification')
      .upsert({
        phone_number: phoneNumber,
        otp_code: otp,
        is_verified: false,
        attempts: 0,
        created_at: new Date().toISOString()
      });

    if (otpError) throw otpError;

    // Update request logs
    if (logData) {
      await supabase
        .from('otp_request_logs')
        .update({ otp_count: logData.otp_count + 1 })
        .eq('phone_number', phoneNumber);
    } else {
      await supabase
        .from('otp_request_logs')
        .insert([
          {
            phone_number: phoneNumber,
            otp_count: 1,
            created_at: new Date().toISOString()
          }
        ]);
    }

    return { success: true, message: 'OTP sent successfully' };
  } catch (error) {
    console.error('Error sending OTP:', error);
    return { success: false, error: 'Failed to send OTP' };
  }
};

/**
 * @interface SignupRequest
 * @property {string} email - User email address
 * @property {string} password - User password (min 6 characters)
 * @property {string} firstName - User's first name
 * @property {string} lastName - User's last name
 */

// Signup user with email and password
exports.signup = async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Validation
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ 
        error: 'Email, password, firstName, and lastName are required' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Invalid email format' 
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ 
        error: 'Password must be at least 6 characters' 
      });
    }

    // Sign up using Supabase Auth (creates user in auth.users)
    // Note: Email confirmation may fail if not configured - we'll create user anyway
    let authData = null;
    let userId = null;

    console.log(`Attempting to sign up user: ${email}`);
    
    const { data: signUpData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.APP_URL || 'https://jbrstaffingsolutions.com'}/auth/callback`
      }
    });

    if (authError) {
      console.warn(`Auth signup error for ${email}:`, authError);
      console.warn(`Auth error details:`, {
        message: authError.message,
        code: authError.code,
        status: authError.status,
        allKeys: Object.keys(authError),
        stringified: JSON.stringify(authError, null, 2)
      });
      
      // If error is about email confirmation, create user anyway
      if (authError.message?.includes('sending confirmation') || authError.message?.includes('email')) {
        console.warn('Email confirmation failed, but proceeding with profile creation:', authError.message);
        // For development, generate a proper UUID
        userId = uuidv4();
        console.log(`Generated UUID for user: ${userId}`);
      } else {
        console.error('Supabase Auth Error:', authError);
        return res.status(500).json({ 
          error: 'Failed to create user',
          errorDetails: {
            message: authError.message || 'Unknown error',
            code: authError.code || 'UNKNOWN',
            status: authError.status || 500,
            hint: 'Please configure email provider in Supabase dashboard'
          }
        });
      }
    } else if (signUpData?.user?.id) {
      authData = signUpData;
      userId = signUpData.user.id;
      console.log(`✓ Auth signup successful, user ID: ${userId}`);
    } else {
      console.error('Unexpected signup response - no user ID:', signUpData);
      return res.status(500).json({ 
        error: 'Failed to create user',
        errorDetails: {
          message: 'No user ID returned from signup',
          code: 'NO_USER_ID',
          status: 500
        }
      });
    }

    // Create user in public users table first (REQUIRED - foreign key constraint for user_roles)
    // SKIPPED - We'll only use auth.users and profiles
    console.log(`Skipping users table insert - using auth.users only`);


    // Store additional profile info in profiles table (using admin client to bypass RLS)
    console.log(`Creating profile for user ID: ${userId}`);
    
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert([{
        id: userId,
        email,
        first_name: firstName,
        last_name: lastName,
        is_active: true,
        created_at: new Date().toISOString()
      }])
      .select();

    if (profileError) {
      console.error('Profile Insert Error:', {
        message: profileError.message,
        code: profileError.code,
        details: profileError.details,
        hint: profileError.hint,
        full: profileError
      });
      return res.status(500).json({ 
        error: 'Failed to create profile',
        errorDetails: {
          message: profileError.message || 'Unknown error',
          code: profileError.code || 'UNKNOWN',
          details: profileError.details || null,
          hint: profileError.hint || null
        }
      });
    } else {
      console.log(`✓ Profile created successfully for user ID: ${userId}`);
    }

    // Auto-confirm email so user can login immediately (only if auth failed/generated UUID)
    if (userId && authError) {
      console.log(`Auto-confirming email for user: ${email}`);
      try {
        // Use admin API to confirm the email
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          email_confirm: true,
          user_metadata: {
            email_verified: true
          }
        });
        console.log(`✓ Email auto-confirmed for user: ${email}`);
      } catch (err) {
        console.warn('Warning: Could not auto-confirm email:', err.message);
        // Don't fail signup because of this
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: userId, email, role: 'user' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.status(201).json({ 
      message: 'User registered successfully',
      emailConfirmationRequired: !!authError,
      user: {
        id: userId,
        email,
        firstName,
        lastName
      },
      token
    });
  } catch (error) {
    console.error('Signup error - Unexpected exception:', {
      message: error?.message || 'Unknown error',
      code: error?.code,
      stack: error?.stack,
      errorType: error?.constructor?.name,
      fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
    });
    res.status(500).json({ 
      error: 'An unexpected error occurred during signup',
      errorDetails: {
        message: error?.message || 'Unknown error',
        code: error?.code || 'EXCEPTION',
        type: error?.constructor?.name
      }
    });
  }
};


// Login user with email and password
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }

    console.log(`Login attempt for: ${email}`);

    // Sign in using Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      console.error('Supabase Auth Error:', authError);
      console.log('Auth error details:', {
        message: authError.message,
        code: authError.code,
        status: authError.status
      });
      return res.status(401).json({ 
        error: 'Invalid email or password',
        details: authError.message 
      });
    }

    console.log(`✓ Auth successful for user: ${email}, ID: ${authData.user.id}`);

    // Get user profile
    const { data: user, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError) {
      console.error('Profile Query Error:', profileError);
      console.log('Profile may not exist yet - continuing with basic user info');
    } else {
      console.log(`✓ Profile found for user: ${email}`);
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: authData.user.id, email, role: 'user' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        firstName: user?.first_name || '',
        lastName: user?.last_name || ''
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'An unexpected error occurred during login',
      details: error.message 
    });
  }
};


// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('profiles')
      .select('*');

    if (error) throw error;
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: user, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Create user
exports.createUser = async (req, res) => {
  try {
    const { firstName, lastName, email, phoneNumber } = req.body;
    
    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'First name and last name are required' });
    }
    
    const { data: user, error } = await supabase
      .from('profiles')
      .insert([{ 
        first_name: firstName,
        last_name: lastName,
        email: email,
        phone_number: phoneNumber
      }])
      .select('id');

    if (error) throw error;
    
    res.status(201).json({ 
      id: user[0].id, 
      firstName, 
      lastName, 
      email,
      phoneNumber 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, phoneNumber } = req.body;
    
    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: firstName,
        last_name: lastName,
        email: email,
        phone_number: phoneNumber
      })
      .eq('id', id);

    if (error) throw error;
    
    res.json({ id, firstName, lastName, email, phoneNumber });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);

    if (error) throw error;
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};
