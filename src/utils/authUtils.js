const supabase = require('../config/database');

/**
 * Check if user has required role
 * @param {string} userRole - Current user role
 * @param {string|string[]} requiredRoles - Required role(s)
 * @returns {boolean}
 */
exports.hasRole = (userRole, requiredRoles) => {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  return roles.includes(userRole);
};

/**
 * Check if user is admin (admin or super_admin)
 * @param {string} userRole - Current user role
 * @returns {boolean}
 */
exports.isAdmin = (userRole) => {
  return ['admin', 'super_admin'].includes(userRole);
};

/**
 * Check if user is super admin
 * @param {string} userRole - Current user role
 * @returns {boolean}
 */
exports.isSuperAdmin = (userRole) => {
  return userRole === 'super_admin';
};

/**
 * Fetch user role from database
 * @param {string} userId - User ID
 * @returns {Promise<string|null>}
 */
exports.getUserRole = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user role:', error);
      return null;
    }

    return data?.role || 'viewer';
  } catch (error) {
    console.error('Error in getUserRole:', error);
    return null;
  }
};

/**
 * Validate email domain
 * @param {string} email - Email to validate
 * @param {string} allowedDomain - Allowed domain (e.g., '@company.com')
 * @returns {boolean}
 */
exports.isValidEmailDomain = (email, allowedDomain) => {
  return email.toLowerCase().endsWith(allowedDomain.toLowerCase());
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {{valid: boolean, errors: string[]}}
 */
exports.validatePassword = (password) => {
  const errors = [];

  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[!@#$%^&*]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*)');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Middleware factory for role-based access control
 * @param {...string} allowedRoles - Roles that can access the endpoint
 * @returns {Function}
 */
exports.requireRole = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      // Get user role from database
      const userRole = await exports.getUserRole(userId);

      if (!userRole || !exports.hasRole(userRole, allowedRoles)) {
        return res.status(403).json({
          success: false,
          error: `Access denied. Required roles: ${allowedRoles.join(', ')}`
        });
      }

      req.userRole = userRole;
      next();
    } catch (error) {
      console.error('Error in requireRole middleware:', error);
      res.status(500).json({
        success: false,
        error: 'Authorization check failed'
      });
    }
  };
};

/**
 * Middleware for admin-only access
 */
exports.requireAdmin = exports.requireRole('admin', 'super_admin');

/**
 * Middleware for super admin-only access
 */
exports.requireSuperAdmin = exports.requireRole('super_admin');

/**
 * Format user response (sanitize sensitive data)
 * @param {Object} user - User object from database
 * @returns {Object}
 */
exports.formatUserResponse = (user) => {
  const { password, ...safeUser } = user;
  return safeUser;
};

/**
 * Generate OTP (6-digit)
 * @returns {string}
 */
exports.generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Check if OTP is expired
 * @param {Date} createdAt - When OTP was created
 * @param {number} expiryMinutes - OTP expiry in minutes (default: 10)
 * @returns {boolean}
 */
exports.isOTPExpired = (createdAt, expiryMinutes = 10) => {
  const now = new Date();
  const createdTime = new Date(createdAt);
  const diffInMinutes = (now - createdTime) / (1000 * 60);
  return diffInMinutes > expiryMinutes;
};

/**
 * Extract JWT payload without verification (for debugging)
 * @param {string} token - JWT token
 * @returns {Object|null}
 */
exports.decodeJWT = (token) => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64').toString('utf8')
    );

    return payload;
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
};
