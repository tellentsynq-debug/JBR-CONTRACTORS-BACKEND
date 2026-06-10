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
            // Validate UUID format
            if (isValidUUID(authUser.id)) {
              userId = authUser.id; // Use the real user ID from auth
              console.log(`✓ User created in auth.users with ID: ${userId}`);
            } else {
              console.warn(`Invalid UUID returned from auth: ${authUser.id}, using generated UUID`);
              // Continue with generated UUID
            }
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
      // Validate UUID format
      if (isValidUUID(signUpData.user.id)) {
        userId = signUpData.user.id;
        console.log(`✓ Auth signup successful, user ID: ${userId}`);
      } else {
        console.warn(`Invalid UUID returned from signup: ${signUpData.user.id}, using generated UUID`);
        userId = uuidv4();
      }
    } else {
      console.error('Unexpected signup response - no user ID:', signUpData);
      console.log('Generating new UUID for user');
      userId = uuidv4();
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
    console.log('Fetching all users from profiles table');
    
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, role, is_active, last_login, created_at');

    if (error) {
      console.error('Database query error:', error);
      throw error;
    }
    
    console.log(`Retrieved ${users?.length || 0} users`);
    
    // Format response
    const formattedUsers = (users || []).map(u => {
      // Validate UUID before returning
      if (!isValidUUID(u.id)) {
        console.warn(`Invalid UUID found in profiles table: ${u.id}`);
      }
      return {
        id: u.id,
        first_name: u.first_name,
        last_name: u.last_name,
        email: u.email,
        role: u.role || 'user',
        is_active: u.is_active,
        last_login: u.last_login,
        created_at: u.created_at
      };
    });
    
    res.json(formattedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to fetch users',
      details: error.hint || error.details || null
    });
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
    
    console.log(`Fetching user by ID: ${id}`);
    
    const { data: user, error } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, role, is_active, last_login, created_at')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Database query error:', error);
      throw error;
    }
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log(`✓ User found: ${user.email}`);
    
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
    res.status(500).json({ 
      error: error.message || 'Failed to fetch user',
      details: error.hint || error.details || null
    });
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
    
    // Fetch requesting user's role for permission checking
    const { data: requestingUserProfile, error: requestingUserError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', requestingUserId)
      .single();
    
    if (requestingUserError || !requestingUserProfile) {
      return res.status(401).json({
        error: 'Could not verify your permissions'
      });
    }
    
    // If a non-default role is requested, check if requesting user is admin
    if (role && role !== 'user') {
      // Check if requesting user is admin or super_admin
      if (!['admin', 'super_admin'].includes(requestingUserProfile.role)) {
        return res.status(403).json({
          success: false,
          error: 'Failed to update user profile',
          details: 'Only admins can change roles'
        });
      }
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
    
    console.log(`[DEBUG] Creating auth user for email: ${email}`);
    console.log(`[DEBUG] Request body:`, { firstName, lastName, email, role, isActive });
    
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
    
    console.log(`[DEBUG] Auth response:`, { authUser, authError });
    
    if (authError) {
      console.error('Auth creation error:', authError);
      console.error('Auth error details:', JSON.stringify(authError, null, 2));
      return res.status(500).json({ 
        error: 'Failed to create user in auth',
        details: authError.message 
      });
    }
    
    // Validate that userId is a valid UUID
    // Try different paths to get the user ID
    let userId = null;
    
    if (authUser?.id && isValidUUID(authUser.id)) {
      userId = authUser.id;
      console.log(`✓ Got userId from authUser.id: ${userId}`);
    } else if (authUser?.user?.id && isValidUUID(authUser.user.id)) {
      userId = authUser.user.id;
      console.log(`✓ Got userId from authUser.user.id: ${userId}`);
    } else {
      console.error('[ERROR] Invalid auth response structure:', {
        authUser,
        authUserKeys: authUser ? Object.keys(authUser) : null,
        authUserId: authUser?.id,
        authUserUserId: authUser?.user?.id,
        isValidId: authUser?.id ? isValidUUID(authUser.id) : false,
        isValidUserId: authUser?.user?.id ? isValidUUID(authUser.user.id) : false
      });
      return res.status(500).json({ 
        error: 'Failed to create user - invalid response from auth service',
        details: 'User ID is not a valid UUID',
        received: {
          hasId: !!authUser?.id,
          id: authUser?.id,
          type: typeof authUser?.id,
          authUserKeys: authUser ? Object.keys(authUser) : null
        }
      });
    }
    
    console.log(`[DEBUG] Using userId: ${userId}`);
    
    console.log(`✓ Auth user created with ID: ${userId}`);
    
    // Check if profile already exists (in case of trigger auto-creation)
    console.log(`[DEBUG] Checking if profile already exists for ID: ${userId}`);
    const { data: existingProfile, error: checkError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 = no rows found (which is expected for new users)
      console.warn(`Unexpected error checking for existing profile:`, checkError);
    }
    
    if (existingProfile) {
      console.log(`[INFO] Profile already exists for ${userId}, updating instead of creating`);
      
      // Build update object - exclude role unless user is admin and requesting a role change
      const updateObj = {
        first_name: firstName,
        last_name: lastName,
        phone_number: phoneNumber || null,
        is_active: isActive
      };
      
      // Only include role if requesting user is admin AND role is being set to something other than default
      if (['admin', 'super_admin'].includes(requestingUserProfile?.role) && role !== 'user') {
        updateObj.role = role;
      }
      
      // Update existing profile with provided data
      const { data: updatedProfile, error: updateError } = await supabaseAdmin
        .from('profiles')
        .update(updateObj)
        .eq('id', userId)
        .select();
      
      if (updateError) {
        console.error('Profile update error:', updateError);
        return res.status(500).json({ 
          error: 'Failed to update user profile',
          details: updateError.message 
        });
      }
      
      console.log(`✓ Profile updated for user: ${userId}`);
      
      return res.status(201).json({ 
        message: 'User created successfully',
        note: 'Profile was auto-created by system, updated with provided data',
        user: {
          id: userId,
          first_name: firstName,
          last_name: lastName,
          email,
          phone_number: phoneNumber,
          role,
          is_active: isActive,
          temp_password: tempPassword,
          note_password: 'Share temporary password with user - they should change it on first login'
        }
      });
    }
    
    // Profile doesn't exist, create it
    console.log(`[DEBUG] Creating new profile for user ID: ${userId}`);
    
    // Build insert object - exclude role unless user is admin and requesting a role change
    const insertObj = {
      id: userId,
      email,
      first_name: firstName,
      last_name: lastName,
      phone_number: phoneNumber || null,
      is_active: isActive,
      created_at: new Date().toISOString()
    };
    
    // Only include role if requesting user is admin AND role is being set to something other than default
    if (['admin', 'super_admin'].includes(requestingUserProfile?.role) && role !== 'user') {
      insertObj.role = role;
    }
    
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert([insertObj])
      .select();
    
    if (profileError) {
      console.error('Profile creation error:', profileError);
      console.error('Profile error details:', {
        code: profileError.code,
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint
      });
      
      // Check if it's a duplicate key error
      if (profileError.code === '23505') {
        console.log(`[INFO] Profile already exists (duplicate key). Fetching existing profile...`);
        
        // Try to fetch and return existing profile
        const { data: existing } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        
        if (existing) {
          return res.status(201).json({ 
            message: 'User created successfully',
            note: 'Profile already existed in system',
            user: existing
          });
        }
      }
      
      // Delete the auth user if profile creation fails
      if (isValidUUID(userId)) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(userId);
          console.log(`✓ Rolled back auth user creation for ID: ${userId}`);
        } catch (deleteError) {
          console.error('Failed to rollback auth user creation:', deleteError);
        }
      }
      return res.status(500).json({ 
        error: 'Failed to create user profile',
        details: profileError.message,
        code: profileError.code
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
    
    console.log(`[DEBUG] Update request:`, { id, firstName, lastName, email, phoneNumber, role, isActive, requestingUserId });
    
    // Validate UUID format
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid user ID format - must be a valid UUID' });
    }
    
    // Check if user exists
    console.log(`[DEBUG] Fetching user: ${id}`);
    const { data: existingUser, error: checkError } = await supabase
      .from('profiles')
      .select('id, role, first_name, last_name, email, is_active')
      .eq('id', id)
      .single();
    
    if (checkError || !existingUser) {
      console.warn(`User not found: ${id}`, checkError);
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log(`[DEBUG] Existing user:`, existingUser);
    
    // Build update object
    const updates = {};
    if (firstName !== undefined) updates.first_name = firstName;
    if (lastName !== undefined) updates.last_name = lastName;
    if (phoneNumber !== undefined) updates.phone_number = phoneNumber;
    if (isActive !== undefined) updates.is_active = isActive;
    
    // Handle role change - check permissions
    if (role !== undefined && role !== existingUser.role) {
      console.log(`[DEBUG] Role change requested: ${existingUser.role} → ${role}`);
      
      // Fetch requesting user's role
      console.log(`[DEBUG] Fetching requesting user role: ${requestingUserId}`);
      const { data: requestingUser, error: reqUserError } = await supabase
        .from('profiles')
        .select('role, first_name, last_name')
        .eq('id', requestingUserId)
        .single();
      
      if (reqUserError) {
        console.error(`[ERROR] Failed to fetch requesting user:`, reqUserError);
        return res.status(400).json({ 
          error: 'Invalid requesting user',
          details: 'Could not verify your admin role' 
        });
      }
      
      console.log(`[DEBUG] Requesting user role: ${requestingUser?.role}`);
      
      // Check permission based on target role
      const isTargetAdminRole = role === 'admin' || role === 'super_admin';
      const isRequesterSuperAdmin = requestingUser?.role === 'super_admin';
      const isRequesterAdmin = requestingUser?.role === 'admin';
      
      console.log(`[DEBUG] Permission check:`, {
        isTargetAdminRole,
        isRequesterSuperAdmin,
        isRequesterAdmin,
        currentUserRole: requestingUser?.role
      });
      
      // Only super_admin can grant/revoke admin roles
      if (isTargetAdminRole && !isRequesterSuperAdmin) {
        console.warn(`[WARN] Admin role change denied - requesting user is ${requestingUser?.role}, not super_admin`);
        return res.status(403).json({ 
          error: 'Unauthorized: Only super admins can change admin roles',
          requiredRole: 'super_admin',
          yourRole: requestingUser?.role
        });
      }
      
      // Regular admins can change regular user roles
      if (!isTargetAdminRole && !isRequesterAdmin && !isRequesterSuperAdmin) {
        console.warn(`[WARN] User role change denied - requesting user is ${requestingUser?.role}`);
        return res.status(403).json({ 
          error: 'Unauthorized: Only admins or higher can change user roles',
          requiredRole: 'admin',
          yourRole: requestingUser?.role
        });
      }
      
      updates.role = role;
      console.log(`[DEBUG] Role change approved, updating to: ${role}`);
    }
    
    // If no updates, return current user
    if (Object.keys(updates).length === 0) {
      console.log(`[DEBUG] No updates to apply`);
      return res.json({
        message: 'User unchanged - no fields provided to update',
        user: existingUser
      });
    }
    
    console.log(`[DEBUG] Applying updates:`, updates);
    console.log(`[DEBUG] Update attempt - has role change: ${updates.role ? 'yes' : 'no'}`);
    
    // Separate role updates from other updates
    // This helps us handle trigger restrictions more gracefully
    const roleUpdate = updates.role ? { role: updates.role } : null;
    const otherUpdates = { ...updates };
    delete otherUpdates.role;
    
    let updateResult = null;
    let roleUpdateSuccess = false;
    let roleUpdateError = null;
    
    // First, try to apply non-role updates
    if (Object.keys(otherUpdates).length > 0) {
      console.log(`[DEBUG] Applying non-role updates:`, otherUpdates);
      const { error: nonRoleError, data: nonRoleData } = await supabaseAdmin
        .from('profiles')
        .update(otherUpdates)
        .eq('id', id)
        .select();
      
      if (nonRoleError) {
        console.error('Non-role update error:', nonRoleError);
        return res.status(500).json({ 
          error: 'Failed to update user profile fields',
          details: nonRoleError.message,
          code: nonRoleError.code
        });
      }
      updateResult = nonRoleData;
      console.log(`✓ Non-role fields updated`);
    }
    
    // Then, try to apply role update if needed
    if (roleUpdate) {
      console.log(`[DEBUG] Attempting role update to: ${roleUpdate.role}`);
      const { error: roleError, data: roleData } = await supabaseAdmin
        .from('profiles')
        .update(roleUpdate)
        .eq('id', id)
        .select();
      
      if (roleError) {
        console.error('Role update error:', roleError);
        console.error('Role update error details:', {
          code: roleError.code,
          message: roleError.message,
          details: roleError.details,
          hint: roleError.hint
        });
        roleUpdateError = roleError;
        
        // Check if it's the "Only admins can change roles" trigger error
        if (roleError.message?.includes('admin') || roleError.message?.includes('role')) {
          console.warn(`[WARN] Database trigger rejected role change`);
          console.warn(`[WARN] Trigger message: ${roleError.message}`);
          console.warn(`[INFO] This is likely a database trigger enforcing role restrictions`);
          
          // If other updates succeeded, return partial success
          if (Object.keys(otherUpdates).length > 0) {
            console.log(`[INFO] Other user fields were updated successfully`);
            return res.status(207).json({ 
              message: 'User partially updated - role change was rejected by database',
              partialSuccess: true,
              failed: 'role',
              error: roleError.message,
              hint: 'Check database trigger: prevent_unauthorized_role_change',
              user: updateResult?.[0] || existingUser
            });
          }
          
          // If only role update was requested
          return res.status(403).json({ 
            error: 'Failed to update user role',
            details: roleError.message,
            hint: 'Database trigger "prevent_unauthorized_role_change" is preventing this operation',
            requiredRole: 'super_admin',
            yourRole: requestingUser?.role,
            code: roleError.code
          });
        }
        
        return res.status(500).json({ 
          error: 'Failed to update user role',
          details: roleError.message,
          code: roleError.code
        });
      }
      
      updateResult = roleData;
      roleUpdateSuccess = true;
      console.log(`✓ Role updated to: ${roleUpdate.role}`);
    }
    
    // Fetch final updated user
    console.log(`[DEBUG] Fetching final user data`);
    const { data: updatedUser, error: fetchError } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, role, is_active, last_login, created_at')
      .eq('id', id)
      .single();
    
    if (fetchError) {
      console.error('Failed to fetch updated user:', fetchError);
      throw fetchError;
    }
    
    console.log(`✓ User updated successfully:`, updatedUser);
    
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
    res.status(500).json({ 
      error: error.message || 'Failed to update user',
      details: error.details || null
    });
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
    try {
      console.log(`Attempting to delete auth user: ${id}`);
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(id);
      
      if (deleteAuthError) {
        console.error('Auth deletion error:', deleteAuthError);
        return res.status(500).json({ 
          error: 'Failed to delete user from auth',
          details: deleteAuthError.message 
        });
      }
      console.log(`✓ Auth user deleted: ${id}`);
    } catch (deleteError) {
      console.error('Exception while deleting auth user:', deleteError);
      return res.status(500).json({ 
        error: 'Failed to delete user from auth',
        details: deleteError.message 
      });
    }
    
    // Also delete from profiles in case cascade didn't work
    try {
      await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', id);
      console.log(`✓ Profile deleted: ${id}`);
    } catch (profileDeleteError) {
      console.error('Error deleting profile:', profileDeleteError);
      // Don't fail the request if profile deletion fails
    }
    
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
