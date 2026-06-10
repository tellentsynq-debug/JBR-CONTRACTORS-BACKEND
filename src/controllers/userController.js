const supabase = require('../config/database');
const supabaseAdmin = supabase.admin;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { v4: uuidv4, validate: validateUUID } = require('uuid');

// UUID validation utility
const isValidUUID = (uuid) => {
  return validateUUID(uuid);
};

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
    if (password.length < 8) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters' 
      });
    }

    // Validate password strength (must have uppercase, lowercase, and number)
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ 
        error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
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
      
      // Handle weak password errors
      if (authError.code === 'weak_password') {
        console.warn('Weak password rejected:', authError.message);
        return res.status(422).json({ 
          error: 'Weak password',
          message: 'Password is too weak or has been found in previous data breaches. Please choose a stronger, unique password.',
          code: 'weak_password'
        });
      }
      
      // If error is about email confirmation, create user anyway
      if (authError.message?.includes('sending confirmation') || authError.message?.includes('email')) {
        console.warn('Email confirmation failed, but proceeding with user creation:', authError.message);
        
        // Generate a proper UUID for the user
        userId = uuidv4();
        console.log(`Generated UUID for user: ${userId}`);
        
        // Create the user in auth.users using admin API
        try {
          console.log(`Creating user in auth.users with ID: ${userId}`);
          const { data: authUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirm email so they can login immediately
            user_metadata: {
              email_verified: true,
              first_name: firstName,
              last_name: lastName
            }
          });
          
          if (createAuthError) {
            console.error('Failed to create user in auth:', createAuthError);
            // Fall back to using the UUID we generated
            console.log('Falling back to UUID-based user creation');
          } else if (authUser?.id) {
            userId = authUser.id; // Use the real user ID from auth
            console.log(`✓ User created in auth.users with ID: ${userId}`);
          }
        } catch (err) {
          console.warn('Error creating user in auth (will use UUID fallback):', err.message);
          // Continue with UUID fallback
        }
      } else {
        console.error('Supabase Auth Error:', authError);
        return res.status(authError.status || 500).json({ 
          error: 'Failed to create user',
          message: authError.message || 'Unknown error',
          code: authError.code || 'UNKNOWN',
          hint: 'Please configure email provider in Supabase dashboard'
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

    // Auto-confirm email for users created via normal signup (when authData exists but email not confirmed yet)
    // Note: Users created via admin API fallback are already confirmed during creation
    if (userId && authData && !authData.user?.email_confirmed_at) {
      console.log(`Auto-confirming email for user: ${email}`);
      try {
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


// Get all users (Admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, role, is_active, last_login, created_at');

    if (error) throw error;
    
    // Format response
    const formattedUsers = users.map(u => ({
      id: u.id,
      first_name: u.first_name,
      last_name: u.last_name,
      email: u.email,
      role: u.role || 'user',
      is_active: u.is_active,
      last_login: u.last_login,
      created_at: u.created_at
    }));
    
    res.json(formattedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate UUID format
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid user ID format - must be a valid UUID' });
    }
    
    const { data: user, error } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, role, is_active, last_login, created_at')
      .eq('id', id)
      .single();

    if (error) throw error;
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role: user.role || 'user',
      is_active: user.is_active,
      last_login: user.last_login,
      created_at: user.created_at
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: error.message });
  }
};

// Create user (Admin only - creates auth user + profile)
exports.createUser = async (req, res) => {
  try {
    const { firstName, lastName, email, phoneNumber, role = 'user', isActive = true } = req.body;
    const requestingUserId = req.userId; // From JWT middleware
    
    // Validation
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ 
        error: 'First name, last name, and email are required' 
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // Check if email already exists
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();
    
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    // Generate a temporary password for the user
    const tempPassword = Math.random().toString(36).slice(-8) + 'Temp!123';
    
    // Create user in auth.users using service role
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        created_by: requestingUserId
      }
    });
    
    if (authError) {
      console.error('Auth creation error:', authError);
      return res.status(500).json({ 
        error: 'Failed to create user in auth',
        details: authError.message 
      });
    }
    
    const userId = authUser.id;
    
    // Create profile record
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert([{
        id: userId,
        email,
        first_name: firstName,
        last_name: lastName,
        phone_number: phoneNumber || null,
        role: role,
        is_active: isActive,
        created_at: new Date().toISOString()
      }])
      .select();
    
    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Delete the auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return res.status(500).json({ 
        error: 'Failed to create user profile',
        details: profileError.message 
      });
    }
    
    res.status(201).json({ 
      message: 'User created successfully',
      user: {
        id: userId,
        first_name: firstName,
        last_name: lastName,
        email,
        phone_number: phoneNumber,
        role,
        is_active: isActive,
        temp_password: tempPassword,
        note: 'Share temporary password with user - they should change it on first login'
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, phoneNumber, role, isActive } = req.body;
    const requestingUserId = req.userId;
    
    // Validate UUID format
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid user ID format - must be a valid UUID' });
    }
    
    // Check if user exists
    const { data: existingUser, error: checkError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', id)
      .single();
    
    if (checkError || !existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Build update object
    const updates = {};
    if (firstName) updates.first_name = firstName;
    if (lastName) updates.last_name = lastName;
    if (phoneNumber !== undefined) updates.phone_number = phoneNumber;
    if (isActive !== undefined) updates.is_active = isActive;
    
    // Handle role change - only super_admin can change roles
    if (role && role !== existingUser.role) {
      if (role === 'admin' || role === 'super_admin') {
        // Only super_admin can promote to admin/super_admin
        const { data: requestingUser } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', requestingUserId)
          .single();
        
        if (requestingUser?.role !== 'super_admin') {
          return res.status(403).json({ 
            error: 'Unauthorized: Only super admins can grant admin roles' 
          });
        }
      }
      updates.role = role;
    }
    
    // Update profile
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', id);
    
    if (updateError) throw updateError;
    
    // Fetch updated user
    const { data: updatedUser, error: fetchError } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, role, is_active, last_login, created_at')
      .eq('id', id)
      .single();
    
    if (fetchError) throw fetchError;
    
    res.json({
      message: 'User updated successfully',
      user: {
        id: updatedUser.id,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        email: updatedUser.email,
        role: updatedUser.role,
        is_active: updatedUser.is_active,
        last_login: updatedUser.last_login,
        created_at: updatedUser.created_at
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Delete user (Admin only - deletes from auth.users + profiles via cascade)
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const requestingUserId = req.userId;
    
    // Validate UUID format
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid user ID format - must be a valid UUID' });
    }
    
    // Check if user exists
    const { data: userToDelete, error: checkError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('id', id)
      .single();
    
    if (checkError || !userToDelete) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Prevent self-deletion
    if (id === requestingUserId) {
      return res.status(403).json({ error: 'Cannot delete your own account' });
    }
    
    // Delete from auth.users using service role (cascades to profiles via FK)
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(id);
    
    if (deleteAuthError) {
      console.error('Auth deletion error:', deleteAuthError);
      return res.status(500).json({ 
        error: 'Failed to delete user from auth',
        details: deleteAuthError.message 
      });
    }
    
    // Also delete from profiles in case cascade didn't work
    await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', id);
    
    res.json({ 
      message: 'User deleted successfully',
      deletedUser: {
        id,
        email: userToDelete.email
      }
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: error.message });
  }
};
