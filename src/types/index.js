/**
 * @typedef {Object} SignupRequest
 * @property {string} email - User email address
 * @property {string} password - User password (minimum 6 characters)
 * @property {string} firstName - User's first name
 * @property {string} lastName - User's last name
 */

/**
 * @typedef {Object} LoginRequest
 * @property {string} email - User email address
 * @property {string} password - User password
 */

/**
 * @typedef {Object} User
 * @property {string} id - User ID (UUID)
 * @property {string} email - User email
 * @property {string} first_name - User's first name
 * @property {string} last_name - User's last name
 * @property {string} status - User status (active/inactive)
 * @property {string} created_at - Creation timestamp
 */

/**
 * @typedef {Object} AuthResponse
 * @property {string} message - Response message
 * @property {User} user - User object
 * @property {string} token - JWT token
 */

module.exports = {};
