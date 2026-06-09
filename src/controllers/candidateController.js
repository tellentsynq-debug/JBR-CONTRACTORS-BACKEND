const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const supabaseModule = require('../config/database');
const supabase = supabaseModule;
const supabaseAdmin = supabaseModule.admin;
const { sendOTPEmail, sendVerificationConfirmationEmail } = require('../services/emailService');
const securityMiddleware = require('../middleware/securityMiddleware');

// Generate JWT token
const generateJWT = (email, verificationId) => {
  const payload = {
    email: email,
    verificationId: verificationId,
    type: 'email_verified',
    iat: Math.floor(Date.now() / 1000)
  };
  
  const token = jwt.sign(
    payload,
    process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    { expiresIn: '24h' }
  );
  
  return token;
};

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Get client IP (handles proxy)
const getClientIP = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
         req.headers['x-client-ip'] ||
         req.socket.remoteAddress ||
         req.ip;
};

/**
 * Send OTP to candidate email
 * Route: POST /api/candidates/send-otp
 * Body: { email, campaign_id? }
 * Security: Rate limiting, Origin check, Campaign validation
 */
exports.sendOTP = async (req, res) => {
  try {
    const { email, campaign_id } = req.body;
    const clientIP = getClientIP(req);

    // Validation
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
        code: 'MISSING_EMAIL'
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
        code: 'INVALID_EMAIL'
      });
    }

    // SECURITY: Rate limit check - max 3 OTP requests per hour per email
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: recentRequests, error: queryError } = await supabaseAdmin
      .from('otp_request_logs')
      .select('*')
      .eq('email', email)
      .gte('created_at', oneHourAgo);

    if (queryError) {
      console.error('Rate limit check error:', queryError);
      return res.status(500).json({
        success: false,
        error: 'Verification service error',
        code: 'SERVICE_ERROR'
      });
    }

    if (recentRequests && recentRequests.length >= 3) {
      // Log failed attempt
      await securityMiddleware.logRegistrationAttempt(supabaseAdmin, clientIP, email, 'send_otp', false);
      
      return res.status(429).json({
        success: false,
        error: 'Too many OTP requests. Please try again after 1 hour.',
        code: 'RATE_LIMITED',
        retryAfter: 3600
      });
    }

    // SECURITY: IP-based rate limiting
    const notRateLimited = await securityMiddleware.rateLimitByIP(supabaseAdmin, clientIP, 'send_otp');
    if (!notRateLimited) {
      await securityMiddleware.logRegistrationAttempt(supabaseAdmin, clientIP, email, 'send_otp', false);
      return res.status(429).json({
        success: false,
        error: 'Too many requests from your location',
        code: 'IP_RATE_LIMITED'
      });
    }

    // SECURITY: Validate campaign window if campaign_id provided
    if (campaign_id) {
      const campaignValidation = await securityMiddleware.validateCampaignWindow(supabaseAdmin, campaign_id);
      if (!campaignValidation.valid) {
        await securityMiddleware.logRegistrationAttempt(supabaseAdmin, clientIP, email, 'send_otp', false);
        return res.status(400).json({
          success: false,
          error: campaignValidation.reason,
          code: 'INVALID_CAMPAIGN'
        });
      }
    }

    // Generate 6-digit OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes expiry

    // Check if email already has pending verification
    const { data: existingVerification } = await supabaseAdmin
      .from('email_verifications')
      .select('*')
      .eq('email', email)
      .eq('verified', false)
      .single();

    let verificationId = existingVerification?.id;

    if (existingVerification) {
      // Update existing unverified record
      const { error: updateError } = await supabaseAdmin
        .from('email_verifications')
        .update({
          otp: otp,
          expires_at: expiresAt,
          attempts: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', verificationId);

      if (updateError) {
        console.error('OTP update error:', updateError);
        await securityMiddleware.logRegistrationAttempt(supabaseAdmin, clientIP, email, 'send_otp', false);
        return res.status(500).json({
          success: false,
          error: 'Failed to update OTP',
          code: 'OTP_UPDATE_FAILED'
        });
      }
    } else {
      // Create new verification record
      verificationId = uuidv4();
      const { error: insertError } = await supabaseAdmin
        .from('email_verifications')
        .insert([
          {
            id: verificationId,
            email: email,
            otp: otp,
            expires_at: expiresAt,
            verified: false,
            attempts: 0,
            campaign_id: campaign_id || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]);

      if (insertError) {
        console.error('OTP insert error:', insertError);
        await securityMiddleware.logRegistrationAttempt(supabaseAdmin, clientIP, email, 'send_otp', false);
        return res.status(500).json({
          success: false,
          error: 'Failed to generate OTP',
          code: 'OTP_GENERATION_FAILED'
        });
      }
    }

    // Log OTP request for rate limiting
    const { error: logError } = await supabaseAdmin
      .from('otp_request_logs')
      .insert([
        {
          email: email,
          ip_address: clientIP,
          created_at: new Date().toISOString()
        }
      ]);

    if (logError) {
      console.error('Rate limit log error:', logError);
      // Don't fail the request if logging fails
    }

    // Send OTP via email
    const emailSent = await sendOTPEmail(email, otp);

    if (!emailSent && process.env.NODE_ENV === 'production') {
      await securityMiddleware.logRegistrationAttempt(supabaseAdmin, clientIP, email, 'send_otp', false);
      return res.status(500).json({
        success: false,
        error: 'Failed to send OTP email. Please try again.',
        code: 'EMAIL_SEND_FAILED'
      });
    }

    // Log successful OTP request
    await securityMiddleware.logRegistrationAttempt(supabaseAdmin, clientIP, email, 'send_otp', true);

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully to your email',
      email: email,
      expiresIn: 600 // 10 minutes in seconds
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

/**
 * Verify OTP
 * Route: POST /api/candidates/verify-otp
 * Body: { email, otp }
 * Security: OTP validation, attempt limiting, campaign window
 */
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const clientIP = getClientIP(req);

    // Validation
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        error: 'Email and OTP are required',
        code: 'MISSING_FIELDS'
      });
    }

    // Fetch verification record
    const { data: verification, error: queryError } = await supabaseAdmin
      .from('email_verifications')
      .select('*')
      .eq('email', email)
      .single();

    if (queryError || !verification) {
      await securityMiddleware.logRegistrationAttempt(supabaseAdmin, clientIP, email, 'verify_otp', false);
      return res.status(400).json({
        success: false,
        error: 'No OTP found for this email. Please request a new OTP.',
        code: 'NO_OTP_RECORD'
      });
    }

    // Check if already verified
    if (verification.verified) {
      return res.status(400).json({
        success: false,
        error: 'This email is already verified',
        code: 'ALREADY_VERIFIED'
      });
    }

    // Check if OTP expired
    const now = new Date();
    const expiresAt = new Date(verification.expires_at);

    if (now > expiresAt) {
      await securityMiddleware.logRegistrationAttempt(supabaseAdmin, clientIP, email, 'verify_otp', false);
      return res.status(400).json({
        success: false,
        error: 'OTP has expired. Please request a new OTP.',
        code: 'OTP_EXPIRED'
      });
    }

    // Check attempts (max 5 attempts)
    if (verification.attempts >= 5) {
      await securityMiddleware.logRegistrationAttempt(supabaseAdmin, clientIP, email, 'verify_otp', false);
      return res.status(400).json({
        success: false,
        error: 'Maximum OTP attempts exceeded. Please request a new OTP.',
        code: 'MAX_ATTEMPTS_EXCEEDED'
      });
    }

    // Verify OTP
    if (verification.otp !== otp) {
      // Increment attempts
      const { error: updateError } = await supabaseAdmin
        .from('email_verifications')
        .update({
          attempts: verification.attempts + 1
        })
        .eq('id', verification.id);

      await securityMiddleware.logRegistrationAttempt(supabaseAdmin, clientIP, email, 'verify_otp', false);

      return res.status(400).json({
        success: false,
        error: 'Invalid OTP. Please try again.',
        code: 'INVALID_OTP',
        attemptsRemaining: 5 - (verification.attempts + 1)
      });
    }

    // OTP is correct - mark as verified
    const { error: verifyError } = await supabaseAdmin
      .from('email_verifications')
      .update({
        verified: true,
        verified_at: new Date().toISOString()
      })
      .eq('id', verification.id);

    if (verifyError) {
      console.error('OTP verification error:', verifyError);
      await securityMiddleware.logRegistrationAttempt(supabaseAdmin, clientIP, email, 'verify_otp', false);
      return res.status(500).json({
        success: false,
        error: 'Failed to verify OTP',
        code: 'VERIFICATION_FAILED'
      });
    }

    // Send confirmation email
    await sendVerificationConfirmationEmail(email);

    // Generate JWT token for authenticated registration
    const jwtToken = generateJWT(email, verification.id);

    // Log successful verification
    await securityMiddleware.logRegistrationAttempt(supabaseAdmin, clientIP, email, 'verify_otp', true);

    res.status(200).json({
      success: true,
      message: 'Email verified successfully',
      email: email,
      verified: true,
      redirectUrl: '/candidate/register',
      jwtToken: jwtToken,
      expiresIn: 86400, // 24 hours in seconds
      tokenType: 'Bearer'
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

/**
 * Register candidate (after OTP verification)
 * Route: POST /api/candidates/register
 * Body: { email, phone, first_name, last_name, resume_url, campaign_id }
 * Security: OTP gating, duplicate phone check, campaign window
 */
exports.registerCandidate = async (req, res) => {
  try {
    const { email, phone, first_name, last_name, resume_url, campaign_id } = req.body;
    const clientIP = getClientIP(req);

    // Validation
    if (!email || !phone || !first_name || !last_name) {
      return res.status(400).json({
        success: false,
        error: 'Email, phone, first_name, and last_name are required',
        code: 'MISSING_FIELDS'
      });
    }

    // SECURITY: OTP gating - verify email was verified via OTP
    const otpGating = await securityMiddleware.validateOTPGating(supabaseAdmin, email);
    if (!otpGating.valid) {
      await securityMiddleware.logRegistrationAttempt(supabaseAdmin, clientIP, email, 'register', false);
      return res.status(403).json({
        success: false,
        error: 'Email must be verified via OTP before registration',
        code: 'OTP_REQUIRED'
      });
    }

    // SECURITY: Check for duplicate phone registration
    const isDuplicatePhone = await securityMiddleware.checkDuplicatePhone(supabaseAdmin, phone);
    if (isDuplicatePhone) {
      await securityMiddleware.logRegistrationAttempt(supabaseAdmin, clientIP, email, 'register', false);
      return res.status(400).json({
        success: false,
        error: 'This phone number is already registered',
        code: 'DUPLICATE_PHONE'
      });
    }

    // SECURITY: Validate campaign window
    if (campaign_id) {
      const campaignValidation = await securityMiddleware.validateCampaignWindow(supabaseAdmin, campaign_id);
      if (!campaignValidation.valid) {
        await securityMiddleware.logRegistrationAttempt(supabaseAdmin, clientIP, email, 'register', false);
        return res.status(400).json({
          success: false,
          error: campaignValidation.reason,
          code: 'INVALID_CAMPAIGN'
        });
      }
    }

    // Create candidate registration
    const candidateId = uuidv4();
    const { error: registerError } = await supabaseAdmin
      .from('candidate_registrations')
      .insert([
        {
          id: candidateId,
          email: email,
          phone: phone,
          first_name: first_name,
          last_name: last_name,
          resume_url: resume_url || null,
          campaign_id: campaign_id || null,
          status: 'completed',
          email_verified: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);

    if (registerError) {
      console.error('Candidate registration error:', registerError);
      await securityMiddleware.logRegistrationAttempt(supabaseAdmin, clientIP, email, 'register', false);
      return res.status(500).json({
        success: false,
        error: 'Failed to register candidate',
        code: 'REGISTRATION_FAILED'
      });
    }

    // Log successful registration
    await securityMiddleware.logRegistrationAttempt(supabaseAdmin, clientIP, email, 'register', true);

    res.status(201).json({
      success: true,
      message: 'Candidate registered successfully',
      candidate_id: candidateId,
      email: email
    });

  } catch (error) {
    console.error('Register candidate error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

/**
 * Get OTP verification status
 * Route: GET /api/candidates/verification-status/:email
 */
exports.getVerificationStatus = async (req, res) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const { data: verification, error } = await supabaseAdmin
      .from('email_verifications')
      .select('email, verified, verified_at')
      .eq('email', email)
      .single();

    if (error || !verification) {
      return res.status(404).json({
        success: false,
        error: 'No verification record found'
      });
    }

    res.status(200).json({
      success: true,
      email: verification.email,
      verified: verification.verified,
      verifiedAt: verification.verified_at
    });

  } catch (error) {
    console.error('Get verification status error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get verification status'
    });
  }
};
