const supabaseModule = require('../config/database');
const supabase = supabaseModule; // Public client
const supabaseAdmin = supabaseModule.admin; // Admin client

// Sign In (Login)
exports.signIn = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Step 1: Sign in with Supabase auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Supabase auth error:', error);
      return res.status(401).json({
        error: error.message || 'Invalid credentials'
      });
    }

    const { user, session } = data;

    // Step 2: Get user role from profiles table or RPC
    let userRole = 'viewer'; // Default role
    
    // Check if user is marked as admin in auth metadata
    const isAuthAdmin = user?.user_metadata?.is_admin === true;
    
    try {
      // Try to get role from profiles table directly
      const { data: profileData, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profileError && profileData?.role) {
        userRole = profileData.role;
      } else if (profileError?.code !== 'PGRST116') {
        // Log unexpected errors (PGRST116 is "not found")
        console.warn('Profile fetch warning:', profileError?.message);
      }
    } catch (err) {
      console.warn('Error fetching role:', err.message);
      // Continue with default role
    }

    // Override role if user is marked as admin in auth metadata
    if (isAuthAdmin) {
      userRole = 'admin';
      console.log(`[INFO] User ${user.id} has admin flag in auth metadata, setting role to admin`);
    }

    // Alternative: Try RPC as fallback if needed
    // const { data: roleData, error: roleError } = await supabaseAdmin.rpc(
    //   'get_current_user_role',
    //   { user_id: user.id }
    // );
    // if (!roleError && roleData) userRole = roleData;

    // Step 3: Return user data with session token
    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: userRole,
        user_metadata: user.user_metadata || {}
      },
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
        token_type: session.token_type
      },
      message: 'Sign in successful'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Sign Up (New Account)
exports.signUp = async (req, res) => {
  try {
    const { email, password, first_name, last_name } = req.body;

    // Validation
    if (!email || !password || !first_name || !last_name) {
      return res.status(400).json({
        error: 'Email, password, first_name, and last_name are required'
      });
    }

    // Step 1: Domain validation - must be @jbrstaffingsolutions.com
    const ALLOWED_DOMAIN = process.env.COMPANY_EMAIL_DOMAIN || '@jbrstaffingsolutions.com';
    if (!email.endsWith(ALLOWED_DOMAIN)) {
      return res.status(400).json({
        error: `Only ${ALLOWED_DOMAIN} email addresses are allowed`
      });
    }

    // Step 2: Check if user already exists
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingUser?.users?.some(u => u.email === email);

    if (userExists) {
      // User exists but might be unverified
      console.log(`User ${email} already exists`);
      
      // Generate a new confirmation link
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'signup',
        email: email
      });

      if (linkError) {
        console.error('Link generation error:', linkError);
        return res.status(400).json({
          error: 'User already registered. Failed to resend confirmation link.'
        });
      }

      // In production, send this link via email
      // For now, return it in response (NOT for production!)
      console.log(`Confirmation link: ${linkData.properties.confirmation_url}`);

      return res.status(200).json({
        message: 'Account already exists. Confirmation link generated.',
        email: email,
        status: 'pending_confirmation',
        // In production, remove this and send via email instead
        confirmationLink: process.env.NODE_ENV === 'development' ? linkData.properties.confirmation_url : undefined
      });
    }

    // Step 3: Create new user with email_confirm: false
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // User must confirm email
      user_metadata: {
        first_name,
        last_name
      }
    });

    if (createError) {
      console.error('User creation error:', createError);
      return res.status(400).json({
        error: createError.message || 'Failed to create user'
      });
    }

    // Step 3.5: Auto-confirm email (for development/MVP)
    // In production, remove this and use email verification flow
    const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(
      newUser.user.id,
      { email_confirm: true }
    );

    if (confirmError) {
      console.warn('⚠️ Warning: Could not auto-confirm email:', confirmError.message);
      // Continue anyway - user can still verify manually
    } else {
      console.log(`✓ Email auto-confirmed for ${email}`);
    }

    // Step 4: Create profile entry in profiles table (may already exist from Supabase trigger)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert([
        {
          id: newUser.user.id,
          email: email,
          first_name: first_name,
          last_name: last_name,
          role: 'viewer', // Default role for new users
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);

    // Handle duplicate profile error (profile might be created by Supabase trigger)
    if (profileError) {
      if (profileError.code === '23505') {
        // Duplicate key - profile already exists, this is fine
        console.log(`✓ Profile already exists for ${email}`);
      } else if (profileError.code === 'PGRST204') {
        // Column doesn't exist - skip this, profiles might auto-create via trigger
        console.log(`ℹ️ Profile insert skipped: ${profileError.message}`);
      } else {
        // Other errors - log but don't fail
        console.warn(`⚠️ Profile creation warning: ${profileError.message}`);
      }
    }

    // Step 5: Generate confirmation link
    let confirmationLink = null;
    try {
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'signup',
        email: email,
        skipEmailVerification: false // Ensure email verification is required
      });

      if (linkError) {
        console.warn('⚠️ Confirmation link generation warning:', linkError.message);
      } else {
        // Check if linkData has properties or if it's directly the link
        confirmationLink = linkData?.properties?.confirmation_url || linkData?.confirmation_url;
        console.log(`✓ Confirmation link generated for ${email}`);
        if (confirmationLink) {
          console.log(`  Link: ${confirmationLink.substring(0, 80)}...`);
        }
      }
    } catch (err) {
      console.warn('⚠️ Could not generate confirmation link:', err.message);
    }

    // Step 6: Return success response
    res.status(201).json({
      success: true,
      user: {
        id: newUser.user.id,
        email: newUser.user.email,
        role: 'viewer'
      },
      message: 'Sign up successful. Your email has been confirmed. You can now login.',
      status: 'email_confirmed',
      ready_to_login: true
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Verify Email (Confirm signup)
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.query; // token from email link

    if (!token) {
      return res.status(400).json({
        error: 'Verification token is required'
      });
    }

    // Note: In modern Supabase implementations, email verification happens automatically
    // when the user clicks the link in the email and gets redirected to the app.
    // This endpoint is for manual verification of the token.

    // Method 1: Verify using the token from Supabase
    // The token in the email link can be used to authenticate the user
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'email'
      });

      if (error) {
        console.error('OTP verification error:', error);
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired verification token',
          details: error.message
        });
      }

      const { user, session } = data;

      // Mark email as verified in profiles table (if not already)
      await supabaseAdmin
        .from('profiles')
        .update({ email_verified: true })
        .eq('id', user.id);

      // Get user role
      const { data: roleData } = await supabaseAdmin.rpc(
        'get_current_user_role',
        { user_id: user.id }
      );

      res.status(200).json({
        success: true,
        message: 'Email verified successfully',
        user: {
          id: user.id,
          email: user.email,
          role: roleData || 'viewer'
        },
        session: {
          access_token: session?.access_token,
          refresh_token: session?.refresh_token
        }
      });
    } catch (err) {
      console.error('Verification error:', err);
      return res.status(400).json({
        success: false,
        error: 'Email verification failed'
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Get Current User
exports.getCurrentUser = async (req, res) => {
  try {
    // User ID comes from authMiddleware - can be Supabase ID or OTP email
    const userId = req.userId;
    const userEmail = req.userEmail;
    const tokenType = req.tokenType;
    const verificationId = req.verificationId;

    // Handle OTP verification token (email_verified type)
    if (tokenType === 'email_verified' && userEmail && !userId) {
      // Token already proves email verification
      
      // Fetch full candidate registration data from candidates table
      const { data: candidateData, error: candidateError } = await supabaseAdmin
        .from('candidates')
        .select('*')
        .eq('email', userEmail);

      const registrationData = candidateData && candidateData.length > 0 ? candidateData[0] : null;

      // Log for debugging
      if (candidateError) {
        console.error('Candidate fetch error:', candidateError);
      }
      if (!registrationData) {
        console.log('No candidate data found for email:', userEmail);
      }

      // Try to fetch bank_account and sin documents for this candidate (if any)
      let bankDoc = null;
      let sinDoc = null;
      if (registrationData) {
        try {
          const { data: bankData, error: bankErr } = await supabaseAdmin
            .from('user_documents')
            .select('*')
            .eq('user_id', registrationData.id)
            .eq('doc_type', 'bank_account')
            .order('created_at', { ascending: false })
            .limit(1);
          if (!bankErr && Array.isArray(bankData) && bankData.length > 0) bankDoc = bankData[0];

          const { data: sinData, error: sinErr } = await supabaseAdmin
            .from('user_documents')
            .select('*')
            .eq('user_id', registrationData.id)
            .eq('doc_type', 'sin')
            .order('created_at', { ascending: false })
            .limit(1);
          if (!sinErr && Array.isArray(sinData) && sinData.length > 0) sinDoc = sinData[0];
        } catch (err) {
          console.warn('Could not fetch documents for OTP profile:', err && err.message ? err.message : err);
        }
      }

      res.status(200).json({
        success: true,
        user: {
          type: 'otp_verified',
          email: userEmail,
          verificationId: verificationId,
          status: 'email_verified',
          message: 'User authenticated via OTP verification - email confirmed',
          ...(registrationData && {
            profile: {
              id: registrationData.id,
              first_name: registrationData.first_name,
              last_name: registrationData.last_name,
              phone: registrationData.phone_number || registrationData.phone,
              gender: registrationData.gender,
              date_of_birth: registrationData.date_of_birth,
              city: registrationData.city,
              province: registrationData.province,
              postal_code: registrationData.postal_code,
              resume_url: registrationData.resume_url,
              campaign_id: registrationData.campaign_id,
              status: registrationData.status || registrationData.verification_status,
              email_verified: registrationData.email_verified || true,
              available_from: registrationData.available_from,
              permit_status: registrationData.permit_status,
              shift_preference: registrationData.shift_preference,
              license_required: registrationData.license_required,
              license_expiry_month: registrationData.license_expiry_month,
              license_expiry_year: registrationData.license_expiry_year,
              job_category_id: registrationData.job_category_id,
              job_industry_id: registrationData.job_industry_id,
              created_at: registrationData.created_at,
              updated_at: registrationData.updated_at,
              bank_account: bankDoc && {
                account_number: bankDoc.account_number || null,
                document_url: bankDoc.document_url || null,
                storage_path: bankDoc.storage_path || null,
                created_at: bankDoc.created_at || null
              },
              sin: sinDoc && {
                sin_number: sinDoc.sin_number || null,
                document_url: sinDoc.document_url || null,
                storage_path: sinDoc.storage_path || null,
                created_at: sinDoc.created_at || null
              }
            }
          })
        }
      });
      return;
    }

    // Handle Supabase JWT token (standard type)
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'No authenticated user found',
        tokenType: tokenType
      });
    }

    // Step 1: Get user from profiles table (don't need auth check, JWT proves identity)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      return res.status(404).json({
        success: false,
        error: 'User profile not found'
      });
    }

    // Step 2: Get role - already in profile
    let userRole = profile?.role || 'viewer';

    // Check if user is marked as admin in JWT/auth
    // JWT token contains user_metadata, check for is_admin flag
    const tokenData = req.user || {}; // From middleware
    if (tokenData?.user_metadata?.is_admin === true) {
      userRole = 'admin';
      console.log(`[INFO] User ${userId} has admin flag, setting role to admin`);
    }

    // Step 3: Return user data
    // Fetch latest bank_account and sin documents for this user (if any)
    let bankDoc = null;
    let sinDoc = null;
    try {
      const { data: bankData, error: bankErr } = await supabaseAdmin
        .from('user_documents')
        .select('*')
        .eq('user_id', profile.id)
        .eq('doc_type', 'bank_account')
        .order('created_at', { ascending: false })
        .limit(1);

      if (!bankErr && Array.isArray(bankData) && bankData.length > 0) bankDoc = bankData[0];

      const { data: sinData, error: sinErr } = await supabaseAdmin
        .from('user_documents')
        .select('*')
        .eq('user_id', profile.id)
        .eq('doc_type', 'sin')
        .order('created_at', { ascending: false })
        .limit(1);

      if (!sinErr && Array.isArray(sinData) && sinData.length > 0) sinDoc = sinData[0];
    } catch (err) {
      console.warn('Could not fetch user documents for /me:', err && err.message ? err.message : err);
    }

    res.status(200).json({
      success: true,
      user: {
        id: profile.id,
        email: profile.email,
        role: userRole,
        first_name: profile.first_name,
        last_name: profile.last_name,
        phone_number: profile.phone_number,
        is_active: profile.is_active,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        bank_account: bankDoc && {
          account_number: bankDoc.account_number || null,
          document_url: bankDoc.document_url || null,
          storage_path: bankDoc.storage_path || null,
          created_at: bankDoc.created_at || null
        },
        sin: sinDoc && {
          sin_number: sinDoc.sin_number || null,
          document_url: sinDoc.document_url || null,
          storage_path: sinDoc.storage_path || null,
          created_at: sinDoc.created_at || null
        }
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Refresh Token
exports.refreshToken = async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        error: 'Refresh token is required'
      });
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token
    });

    if (error) {
      console.error('Token refresh error:', error);
      return res.status(401).json({
        error: 'Failed to refresh token'
      });
    }

    const { session } = data;

    res.status(200).json({
      success: true,
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Sign Out
exports.signOut = async (req, res) => {
  try {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('Session fetch error:', sessionError);
    }

    // Sign out
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Sign out error:', error);
      return res.status(400).json({
        error: error.message
      });
    }

    res.status(200).json({
      success: true,
      message: 'Signed out successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Get Token Details (JWT Verification and Decoding)
exports.getTokenDetails = async (req, res) => {
  try {
    const jwt = require('jsonwebtoken');
    
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authorization header missing or invalid',
        code: 'NO_TOKEN'
      });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Verify and decode token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      { algorithms: ['HS256'] }
    );

    // Calculate expiry time remaining
    const expiresAt = new Date(decoded.exp * 1000);
    const expiresIn = Math.floor((decoded.exp * 1000 - Date.now()) / 1000); // seconds
    const issuedAt = new Date(decoded.iat * 1000);

    res.status(200).json({
      success: true,
      token: {
        // Payload data
        email: decoded.email,
        verificationId: decoded.verificationId,
        type: decoded.type,
        
        // Token metadata
        issuedAt: issuedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        expiresIn: expiresIn, // seconds remaining
        isExpired: expiresIn <= 0,
        
        // Raw timestamps
        iat: decoded.iat,
        exp: decoded.exp,
        
        // Full decoded token
        decoded: decoded
      },
      message: expiresIn > 0 ? 'Token is valid' : 'Token has expired'
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token has expired',
        code: 'TOKEN_EXPIRED',
        expiredAt: error.expiredAt
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token signature or format',
        code: 'INVALID_TOKEN'
      });
    }

    console.error('Token verification error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'TOKEN_ERROR'
    });
  }
};

// Password Reset Request
exports.resetPasswordRequest = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email is required'
      });
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password`
    });

    if (error) {
      console.error('Password reset error:', error);
      return res.status(400).json({
        error: error.message
      });
    }

    res.status(200).json({
      success: true,
      message: 'Password reset link sent to email'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Update Password
exports.updatePassword = async (req, res) => {
  try {
    const { new_password } = req.body;
    const userId = req.userId;

    if (!new_password) {
      return res.status(400).json({
        error: 'New password is required'
      });
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: new_password
    });

    if (error) {
      console.error('Password update error:', error);
      return res.status(400).json({
        error: error.message
      });
    }

    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// ⚠️ DEVELOPMENT ONLY: Confirm Email (For testing - remove in production)
exports.confirmEmailDev = async (req, res) => {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'This endpoint is only available in development'
      });
    }

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email is required'
      });
    }

    // Get user by email
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      return res.status(400).json({
        error: 'Failed to find user'
      });
    }

    const user = users?.users?.find(u => u.email === email);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Confirm email by updating user
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      email_confirm: true // Mark email as confirmed
    });

    if (updateError) {
      console.error('Error confirming email:', updateError);
      return res.status(400).json({
        error: 'Failed to confirm email'
      });
    }

    // Note: Don't update profiles table - email_verified column doesn't exist
    // Email confirmation is handled at auth level only

    res.status(200).json({
      success: true,
      message: 'Email confirmed successfully (development only)',
      user: {
        id: user.id,
        email: user.email,
        email_confirmed_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Admin Sign Up
exports.adminSignUp = async (req, res) => {
  try {
    const { email, password, first_name, last_name, admin_key } = req.body;

    // Validation
    if (!email || !password || !first_name || !last_name) {
      return res.status(400).json({
        error: 'Email, password, first name, and last name are required'
      });
    }

    // Validate admin secret key (from .env)
    const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'admin123';
    if (admin_key !== ADMIN_SECRET_KEY) {
      return res.status(403).json({
        error: 'Invalid admin secret key. Admin registration failed.'
      });
    }

    // Validate email domain
    if (!email.endsWith('@jbrstaffingsolutions.com')) {
      return res.status(400).json({
        error: 'Admin email must be from @jbrstaffingsolutions.com domain'
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters'
      });
    }

    // Check if email already exists
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({
        error: 'Email already exists'
      });
    }

    // Create user in auth with email confirmation
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name,
        last_name,
        is_admin: true
      }
    });

    if (authError) {
      console.error('Auth creation error:', authError);
      return res.status(500).json({
        error: 'Failed to create admin account',
        details: authError.message
      });
    }

    const userId = authUser?.user?.id;
    if (!userId) {
      return res.status(500).json({
        error: 'Failed to create admin - invalid user ID'
      });
    }

    // Check if profile already exists
    const { data: existingProfile, error: checkError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    let profileData;
    let profileError;

    if (existingProfile) {
      // Profile auto-created by trigger, just return success
      console.log(`[INFO] Profile already exists for admin ${userId}`);
      profileData = [existingProfile];
      profileError = null;
    } else {
      // Create new profile with default role
      console.log(`[INFO] Creating new profile for admin ${userId}...`);
      const { data: insertData, error: insertError } = await supabaseAdmin
        .from('profiles')
        .insert([{
          id: userId,
          email,
          first_name,
          last_name,
          role: 'viewer',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select();
      
      profileData = insertData;
      profileError = insertError;
    }

    if (profileError && profileError.code !== '23505') {
      console.error('Profile error:', profileError);
      // Delete auth user if profile creation fails
      try {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      } catch (deleteError) {
        console.error('Failed to rollback admin user:', deleteError);
      }
      return res.status(500).json({
        error: 'Failed to create admin profile',
        details: profileError.message
      });
    }

    res.status(201).json({
      success: true,
      message: 'Admin account created successfully',
      admin: {
        id: userId,
        email,
        first_name,
        last_name,
        role: 'admin',
        is_active: true,
        created_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Promote User to Admin
exports.promoteToAdmin = async (req, res) => {
  try {
    const { userId, admin_key } = req.body;

    if (!userId || !admin_key) {
      return res.status(400).json({
        error: 'User ID and admin secret key are required'
      });
    }

    // Validate admin secret key
    const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'admin123';
    if (admin_key !== ADMIN_SECRET_KEY) {
      return res.status(403).json({
        error: 'Invalid admin secret key'
      });
    }

    // Get the user from profiles
    const { data: user, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Update role to admin
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', userId)
      .select();

    if (updateError) {
      console.error('Promotion error:', updateError);
      return res.status(500).json({
        error: 'Failed to promote user to admin',
        details: updateError.message
      });
    }

    res.status(200).json({
      success: true,
      message: 'User promoted to admin successfully',
      user: updated?.[0] || updated
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};
