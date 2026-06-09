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

    // Step 2: Get user role from profiles table via RPC
    const { data: roleData, error: roleError } = await supabaseAdmin.rpc(
      'get_current_user_role',
      { user_id: user.id }
    );

    if (roleError) {
      console.error('Role fetch error:', roleError);
      return res.status(400).json({
        error: 'Failed to fetch user role'
      });
    }

    const userRole = roleData || 'viewer'; // Default to viewer

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
      // User exists but might be unverified - resend confirmation email
      console.log(`User ${email} already exists, resending confirmation email`);
      
      const { error: resendError } = await supabase.auth.resendEnrollmentEmail(email);
      
      if (resendError) {
        return res.status(400).json({
          error: 'User already registered. Failed to resend confirmation email.'
        });
      }

      return res.status(200).json({
        message: 'Account already exists. Confirmation email resent.',
        email: email,
        status: 'pending_confirmation'
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

    // Step 4: Create profile entry in profiles table
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert([
        {
          id: newUser.user.id,
          email: email,
          first_name: first_name,
          last_name: last_name,
          role: 'viewer', // Default role for new users
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Don't fail - profile might already exist
    }

    // Step 5: Send confirmation email via Supabase
    const { error: emailError } = await supabase.auth.resendEnrollmentEmail(email);

    if (emailError) {
      console.error('Email send error:', emailError);
      return res.status(400).json({
        error: 'User created but failed to send confirmation email'
      });
    }

    // Step 6: Return success response
    res.status(201).json({
      success: true,
      user: {
        id: newUser.user.id,
        email: newUser.user.email,
        role: 'viewer'
      },
      message: 'Sign up successful. Please check your email to confirm your account.',
      status: 'pending_confirmation'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Verify Email (Confirm signup)
exports.verifyEmail = async (req, res) => {
  try {
    const { token, type } = req.query; // token from email link, type = 'signup'

    if (!token) {
      return res.status(400).json({
        error: 'Verification token is required'
      });
    }

    // Verify token with Supabase
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: type || 'signup'
    });

    if (error) {
      console.error('Token verification error:', error);
      return res.status(400).json({
        error: 'Invalid or expired verification token'
      });
    }

    const { user, session } = data;

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
        access_token: session.access_token,
        refresh_token: session.refresh_token
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Get Current User
exports.getCurrentUser = async (req, res) => {
  try {
    // User ID comes from authMiddleware
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'No authenticated user found'
      });
    }

    // Step 1: Get user from auth
    const { data: { user }, error: authError } = await supabase.auth.admin.getUserById(userId);

    if (authError || !user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Step 2: Get role from profiles table via RPC
    const { data: roleData, error: roleError } = await supabaseAdmin.rpc(
      'get_current_user_role',
      { user_id: userId }
    );

    // Step 3: Get full profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Profile fetch error:', profileError);
    }

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        role: roleData || 'viewer',
        first_name: profile?.first_name,
        last_name: profile?.last_name,
        user_metadata: user.user_metadata || {}
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
