const supabase = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
};

// Send OTP to mobile using MSG91
const sendOTPToMobile = async (mobile, otp) => {
  try {
    if (!mobile || !otp) {
      throw new Error('Mobile number and OTP are required');
    }

    // MSG91 API endpoint
    const msg91Url = 'https://control.msg91.com/api/sendotp.php';
    
    // Prepare request parameters
    const params = {
      authkey: process.env.MSG91_AUTH_KEY,
      mobile: mobile.replace(/\D/g, ''), // Remove non-digit characters
      otp: otp,
      template_id: process.env.MSG91_TEMPLATE_ID,
      sender: process.env.MSG91_SENDER_ID,
      DLT_TE_ID: '1207163720624345892' // DLT Template ID (update if needed)
    };

    // Send OTP via MSG91
    const response = await axios.get(msg91Url, { params });

    if (response.data && response.data.type === 'success') {
      console.log(`OTP sent successfully to ${mobile}. Request ID: ${response.data.request_id}`);
      return true;
    } else {
      console.error('MSG91 API Error:', response.data);
      throw new Error(response.data.message || 'Failed to send OTP');
    }
  } catch (error) {
    console.error('Error sending OTP via MSG91:', error.message);
    throw error;
  }
};

// Super Admin Signup - Request OTP
exports.superAdminSignupRequest = async (req, res) => {
  try {
    const { email, password } = req.body;
    const mobile_number = process.env.SUPER_ADMIN_MOBILE || '+919876543210'; // From .env file

    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }

    // Check if email is from company domain
    if (!email.endsWith('@jbrstaffingsolutions.com')) {
      return res.status(400).json({ 
        error: 'Only @jbrstaffingsolutions.com email addresses are allowed' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        error: 'Password must be at least 6 characters long' 
      });
    }

    const connection = await pool.getConnection();

    try {
      // Check if email already exists in super_admins
      const [existingAdmin] = await connection.query(
        'SELECT id FROM super_admins WHERE email = ?',
        [email]
      );

      if (existingAdmin.length > 0) {
        return res.status(400).json({ error: 'Email already registered as super admin' });
      }

      // Generate OTP
      const otp = generateOTP();
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // OTP valid for 10 minutes

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Store OTP verification request
      const [result] = await connection.query(
        'INSERT INTO otp_verifications (email, otp, expires_at, type) VALUES (?, ?, ?, ?)',
        [email, otp, otpExpiresAt, 'super_admin_signup']
      );

      // Send OTP to mobile
      const otpSent = await sendOTPToMobile(mobile_number, otp);
      
      if (!otpSent) {
        return res.status(500).json({ 
          error: 'Failed to send OTP. Please try again.' 
        });
      }

      // Store temporary super admin data for later verification
      const tempDataExpiry = new Date(Date.now() + 10 * 60 * 1000); // Temp data valid for 10 minutes
      await connection.query(
        'INSERT INTO temp_super_admin_data (email, password_hash, mobile_number, expires_at) VALUES (?, ?, ?, ?)',
        [email, hashedPassword, mobile_number, tempDataExpiry]
      );

      res.status(200).json({
        message: 'OTP sent to your mobile number',
        email,
        mobile_number: mobile_number.slice(-4), // Show only last 4 digits for privacy
        otp_expires_in_minutes: 10
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error in super admin signup request:', error);
    res.status(500).json({ error: 'Failed to process signup request' });
  }
};

// Super Admin Verify OTP and Create Account
exports.superAdminVerifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Validation
    if (!email || !otp) {
      return res.status(400).json({ 
        error: 'Email and OTP are required' 
      });
    }

    const connection = await pool.getConnection();

    try {
      // Verify OTP
      const [otpRecord] = await connection.query(
        'SELECT id, expires_at FROM otp_verifications WHERE email = ? AND otp = ? AND type = ? AND used = 0',
        [email, otp, 'super_admin_signup']
      );

      if (otpRecord.length === 0) {
        return res.status(400).json({ error: 'Invalid OTP' });
      }

      // Check if OTP is expired
      if (new Date() > new Date(otpRecord[0].expires_at)) {
        return res.status(400).json({ error: 'OTP has expired' });
      }

      // Get temporary super admin data
      const [tempData] = await connection.query(
        'SELECT password_hash, mobile_number, expires_at FROM temp_super_admin_data WHERE email = ?',
        [email]
      );

      if (tempData.length === 0) {
        return res.status(400).json({ error: 'Signup session expired. Please try again.' });
      }

      // Check if temp data expired
      if (new Date() > new Date(tempData[0].expires_at)) {
        return res.status(400).json({ error: 'Signup session expired. Please try again.' });
      }

      // Create super admin account
      const [result] = await connection.query(
        'INSERT INTO super_admins (email, password, mobile_number, status) VALUES (?, ?, ?, ?)',
        [email, tempData[0].password_hash, tempData[0].mobile_number, 'active']
      );

      // Mark OTP as used
      await connection.query(
        'UPDATE otp_verifications SET used = 1 WHERE id = ?',
        [otpRecord[0].id]
      );

      // Delete temporary data
      await connection.query(
        'DELETE FROM temp_super_admin_data WHERE email = ?',
        [email]
      );

      // Generate JWT token
      const token = jwt.sign(
        { id: result.insertId, email, role: 'super_admin' },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      res.status(201).json({
        message: 'Super admin account created successfully',
        token,
        admin: {
          id: result.insertId,
          email,
          mobile_number: tempData[0].mobile_number,
          role: 'super_admin'
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
};

// Super Admin Login
exports.superAdminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }

    const connection = await pool.getConnection();

    try {
      // Check if super admin exists
      const [admin] = await connection.query(
        'SELECT id, email, password, mobile_number, status FROM super_admins WHERE email = ?',
        [email]
      );

      if (admin.length === 0) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      if (admin[0].status !== 'active') {
        return res.status(401).json({ error: 'Admin account is inactive' });
      }

      // Compare password
      const isPasswordValid = await bcrypt.compare(password, admin[0].password);

      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: admin[0].id, email: admin[0].email, role: 'super_admin' },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      res.status(200).json({
        message: 'Super admin login successful',
        token,
        admin: {
          id: admin[0].id,
          email: admin[0].email,
          mobile_number: admin[0].mobile_number,
          role: 'super_admin'
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error in super admin login:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
};

// Get all super admins (only for super admin)
exports.getAllSuperAdmins = async (req, res) => {
  try {
    const connection = await pool.getConnection();

    try {
      const [admins] = await connection.query(
        'SELECT id, email, mobile_number, status, created_at FROM super_admins ORDER BY created_at DESC'
      );

      res.status(200).json({
        message: 'Super admins retrieved successfully',
        data: admins
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error retrieving super admins:', error);
    res.status(500).json({ error: 'Failed to retrieve super admins' });
  }
};

// Get super admin by ID
exports.getSuperAdminById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid admin ID' });
    }

    const connection = await pool.getConnection();

    try {
      const [admin] = await connection.query(
        'SELECT id, email, mobile_number, status, created_at FROM super_admins WHERE id = ?',
        [id]
      );

      if (admin.length === 0) {
        return res.status(404).json({ error: 'Super admin not found' });
      }

      res.status(200).json({
        message: 'Super admin retrieved successfully',
        data: admin[0]
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error retrieving super admin:', error);
    res.status(500).json({ error: 'Failed to retrieve super admin' });
  }
};

// Update super admin status (activate/deactivate)
exports.updateSuperAdminStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid admin ID' });
    }

    if (!status || !['active', 'inactive'].includes(status)) {
      return res.status(400).json({ 
        error: 'Status must be "active" or "inactive"' 
      });
    }

    const connection = await pool.getConnection();

    try {
      // Check if admin exists
      const [admin] = await connection.query(
        'SELECT id FROM super_admins WHERE id = ?',
        [id]
      );

      if (admin.length === 0) {
        return res.status(404).json({ error: 'Super admin not found' });
      }

      // Update status
      await connection.query(
        'UPDATE super_admins SET status = ? WHERE id = ?',
        [status, id]
      );

      res.status(200).json({
        message: 'Super admin status updated successfully',
        id,
        status
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error updating super admin status:', error);
    res.status(500).json({ error: 'Failed to update super admin status' });
  }
};
