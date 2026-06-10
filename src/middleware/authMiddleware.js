const jwt = require('jsonwebtoken');
const supabase = require('../config/database');

/**
 * Decode JWT without verification (for extracting user ID)
 */
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64').toString('utf8')
    );

    return payload;
  } catch (error) {
    return null;
  }
}

/**
 * Verify Supabase JWT token from Authorization header
 * Extracts user ID from token payload without verification
 * (Supabase handles token security, we just need the user ID)
 */
exports.verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]; // Get token from "Bearer <token>"

    if (!token) {
      return res.status(401).json({ 
        success: false,
        error: 'No token provided' 
      });
    }

    // Try to decode as Supabase JWT first
    const decoded = decodeJWT(token);
    
    if (decoded && decoded.sub) {
      // Valid Supabase JWT token - use 'sub' (subject) as user ID
      req.userId = decoded.sub;
      req.userEmail = decoded.email || null;
      req.tokenType = 'supabase';
      req.user = decoded;
      return next();
    }

    // Fallback: Try to verify as local JWT (for OTP tokens)
    try {
      const localDecoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      
      // Support both Supabase JWT (with id) and OTP verification JWT (with email)
      req.userId = localDecoded.id || null;
      req.userEmail = localDecoded.email || null;
      req.tokenType = localDecoded.type || 'standard'; // 'email_verified' or 'standard'
      req.verificationId = localDecoded.verificationId || null;
      req.user = localDecoded;
      
      return next();
    } catch (jwtError) {
      return res.status(401).json({ 
        success: false,
        error: 'Invalid or expired token' 
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ 
      success: false,
      error: 'Authentication failed' 
    });
  }
};
