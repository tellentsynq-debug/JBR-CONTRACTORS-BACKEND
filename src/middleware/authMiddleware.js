const jwt = require('jsonwebtoken');

// Verify JWT token middleware
exports.verifyToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]; // Get token from "Bearer <token>"

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Support both Supabase JWT (with id) and OTP verification JWT (with email)
    req.userId = decoded.id || null;
    req.userEmail = decoded.email || null;
    req.tokenType = decoded.type || 'standard'; // 'email_verified' or 'standard'
    req.verificationId = decoded.verificationId || null;
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
