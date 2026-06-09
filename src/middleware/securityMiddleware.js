/**
 * Security Middleware for Candidate Registration
 * Implements multiple security layers for OTP verification
 */

// Allowed origins for candidate registration (deployed sites + localhost for dev)
const ALLOWED_ORIGINS = [
  'https://jbrstaffingsolutions.com',
  'https://campaigns.jbrstaffingsolutions.com',
  'https://lovable.dev', // For development
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173', // Vite default
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173'
];

/**
 * Origin allowlist middleware
 * Ensures requests come from authorized domains only
 */
const checkOrigin = (req, res, next) => {
  const origin = req.headers.origin || req.headers.referer;
  
  // Extract base URL from referer if origin header missing
  let baseUrl = origin;
  if (req.headers.referer) {
    baseUrl = new URL(req.headers.referer).origin;
  }

  // Allow requests with no origin header (testing, server-to-server)
  if (!baseUrl) {
    return next();
  }

  // Check if origin is in allowlist
  const isAllowed = ALLOWED_ORIGINS.some(allowed => 
    baseUrl.toLowerCase() === allowed.toLowerCase() ||
    baseUrl.toLowerCase().endsWith(allowed.toLowerCase())
  );

  if (!isAllowed && process.env.NODE_ENV === 'production') {
    console.warn(`⚠️  Unauthorized origin: ${baseUrl}`);
    return res.status(403).json({
      success: false,
      error: 'Unauthorized origin',
      code: 'INVALID_ORIGIN'
    });
  }

  next();
};

/**
 * Validate OTP gating - checks if OTP exists and is valid before allowing registration
 */
const validateOTPGating = async (supabaseAdmin, email) => {
  try {
    const { data: verification, error } = await supabaseAdmin
      .from('email_verifications')
      .select('verified, expires_at')
      .eq('email', email)
      .single();

    if (error || !verification) {
      return {
        valid: false,
        reason: 'No verification record found'
      };
    }

    if (!verification.verified) {
      return {
        valid: false,
        reason: 'Email not verified via OTP'
      };
    }

    // Check if verification expired (shouldn't happen, but safety check)
    if (new Date(verification.expires_at) < new Date()) {
      return {
        valid: false,
        reason: 'Verification expired'
      };
    }

    return { valid: true };
  } catch (error) {
    console.error('OTP gating validation error:', error);
    return {
      valid: false,
      reason: 'Verification check failed'
    };
  }
};

/**
 * Check for duplicate phone number registration
 */
const checkDuplicatePhone = async (supabaseAdmin, phoneNumber) => {
  try {
    const { data: existing, error } = await supabaseAdmin
      .from('candidate_registrations')
      .select('id')
      .eq('phone', phoneNumber)
      .eq('status', 'completed');

    if (error) {
      console.error('Duplicate phone check error:', error);
      return false; // Allow if check fails (don't block)
    }

    return existing && existing.length > 0; // true if duplicate exists
  } catch (error) {
    console.error('Duplicate phone check error:', error);
    return false;
  }
};

/**
 * Validate campaign window - ensures campaign is still open
 */
const validateCampaignWindow = async (supabaseAdmin, campaignId) => {
  if (!campaignId) return { valid: true }; // Optional campaign

  try {
    const { data: campaign, error } = await supabaseAdmin
      .from('campaigns')
      .select('id, status, end_date')
      .eq('id', campaignId)
      .single();

    if (error || !campaign) {
      return {
        valid: false,
        reason: 'Campaign not found'
      };
    }

    // Check if campaign is active
    if (campaign.status !== 'active') {
      return {
        valid: false,
        reason: `Campaign is ${campaign.status}`
      };
    }

    // Check if campaign has ended
    if (campaign.end_date && new Date(campaign.end_date) < new Date()) {
      return {
        valid: false,
        reason: 'Campaign has ended'
      };
    }

    return { valid: true };
  } catch (error) {
    console.error('Campaign validation error:', error);
    return {
      valid: false,
      reason: 'Campaign validation failed'
    };
  }
};

/**
 * Rate limiting middleware - prevent abuse
 */
const rateLimitByIP = async (supabaseAdmin, ip, action = 'registration') => {
  try {
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: requests, error } = await supabaseAdmin
      .from('registration_attempt_logs')
      .select('*')
      .eq('ip_address', ip)
      .eq('action', action)
      .gte('created_at', fiveMinsAgo);

    if (error) return false; // Allow if check fails

    // Max 5 registration attempts per IP per 5 minutes
    if (requests && requests.length >= 5) {
      return false; // Rate limited
    }

    return true; // Not rate limited
  } catch (error) {
    console.error('Rate limit check error:', error);
    return true; // Allow if check fails
  }
};

/**
 * Log registration attempt for security audit
 */
const logRegistrationAttempt = async (supabaseAdmin, ip, email, action, success) => {
  try {
    await supabaseAdmin
      .from('registration_attempt_logs')
      .insert([{
        ip_address: ip,
        email: email,
        action: action,
        success: success,
        created_at: new Date().toISOString()
      }]);
  } catch (error) {
    console.error('Failed to log registration attempt:', error);
    // Don't fail request if logging fails
  }
};

module.exports = {
  checkOrigin,
  validateOTPGating,
  checkDuplicatePhone,
  validateCampaignWindow,
  rateLimitByIP,
  logRegistrationAttempt,
  ALLOWED_ORIGINS
};
