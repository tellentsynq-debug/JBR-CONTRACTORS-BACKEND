const supabase = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Create Admin (only Super Admin can do this)
exports.createAdmin = async (req, res) => {
  try {
    const { email, password, first_name, last_name } = req.body;
    const superAdminId = req.userId; // From JWT token

    // Validation
    if (!email || !password || !first_name || !last_name) {
      return res.status(400).json({ 
        error: 'Email, password, first name, and last name are required' 
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

    // Check if requesting user is admin
    const { data: adminUser, error: adminError } = await supabase.admin
      .from('profiles')
      .select('role')
      .eq('id', superAdminId)
      .single();

    if (adminError || adminUser?.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can create other admins' });
    }

    const connection = await pool.getConnection();

    try {
      // Check if email already exists in admins table
      const [existingAdmin] = await connection.query(
        'SELECT id FROM admins WHERE email = ?',
        [email]
      );

      if (existingAdmin.length > 0) {
        return res.status(400).json({ error: 'Email already registered' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert new admin
      const [result] = await connection.query(
        'INSERT INTO admins (email, password, first_name, last_name, created_by, status) VALUES (?, ?, ?, ?, ?, ?)',
        [email, hashedPassword, first_name, last_name, superAdminId, 'active']
      );

      res.status(201).json({
        message: 'Admin created successfully',
        admin: {
          id: result.insertId,
          email,
          first_name,
          last_name,
          role: 'admin',
          status: 'active'
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error creating admin:', error);
    res.status(500).json({ error: 'Failed to create admin' });
  }
};

// Get all admins (only Super Admin can view)
exports.getAllAdmins = async (req, res) => {
  try {
    const connection = await pool.getConnection();

    try {
      const [admins] = await connection.query(
        'SELECT id, email, first_name, last_name, status, created_at FROM admins ORDER BY created_at DESC'
      );

      res.status(200).json({
        message: 'Admins retrieved successfully',
        data: admins
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error retrieving admins:', error);
    res.status(500).json({ error: 'Failed to retrieve admins' });
  }
};

// Get admin by ID
exports.getAdminById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid admin ID' });
    }

    const connection = await pool.getConnection();

    try {
      const [admin] = await connection.query(
        'SELECT id, email, first_name, last_name, status, created_at FROM admins WHERE id = ?',
        [id]
      );

      if (admin.length === 0) {
        return res.status(404).json({ error: 'Admin not found' });
      }

      res.status(200).json({
        message: 'Admin retrieved successfully',
        data: admin[0]
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error retrieving admin:', error);
    res.status(500).json({ error: 'Failed to retrieve admin' });
  }
};

// Update Admin (only Super Admin can update)
exports.updateAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, status } = req.body;
    const superAdminId = req.userId;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid admin ID' });
    }

    // At least one field must be provided
    if (!first_name && !last_name && !status) {
      return res.status(400).json({ 
        error: 'At least one field must be provided for update' 
      });
    }

    if (status && !['active', 'inactive'].includes(status)) {
      return res.status(400).json({ 
        error: 'Status must be "active" or "inactive"' 
      });
    }

    const connection = await pool.getConnection();

    try {
      // Verify Super Admin is active
      const [superAdmin] = await connection.query(
        'SELECT id FROM super_admins WHERE id = ? AND status = "active"',
        [superAdminId]
      );

      if (superAdmin.length === 0) {
        return res.status(403).json({ error: 'Only active super admins can update admins' });
      }

      // Check if admin exists
      const [existingAdmin] = await connection.query(
        'SELECT id FROM admins WHERE id = ?',
        [id]
      );

      if (existingAdmin.length === 0) {
        return res.status(404).json({ error: 'Admin not found' });
      }

      // Build update query dynamically
      const updates = [];
      const values = [];

      if (first_name) {
        updates.push('first_name = ?');
        values.push(first_name);
      }
      if (last_name) {
        updates.push('last_name = ?');
        values.push(last_name);
      }
      if (status) {
        updates.push('status = ?');
        values.push(status);
      }

      values.push(id);

      const query = `UPDATE admins SET ${updates.join(', ')} WHERE id = ?`;
      await connection.query(query, values);

      res.status(200).json({
        message: 'Admin updated successfully',
        id,
        first_name,
        last_name,
        status
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error updating admin:', error);
    res.status(500).json({ error: 'Failed to update admin' });
  }
};

// Delete Admin (only Super Admin can delete)
exports.deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const superAdminId = req.userId;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid admin ID' });
    }

    const connection = await pool.getConnection();

    try {
      // Verify Super Admin is active
      const [superAdmin] = await connection.query(
        'SELECT id FROM super_admins WHERE id = ? AND status = "active"',
        [superAdminId]
      );

      if (superAdmin.length === 0) {
        return res.status(403).json({ error: 'Only active super admins can delete admins' });
      }

      // Check if admin exists
      const [existingAdmin] = await connection.query(
        'SELECT id, first_name, last_name FROM admins WHERE id = ?',
        [id]
      );

      if (existingAdmin.length === 0) {
        return res.status(404).json({ error: 'Admin not found' });
      }

      // Delete the admin
      await connection.query(
        'DELETE FROM admins WHERE id = ?',
        [id]
      );

      res.status(200).json({
        message: 'Admin deleted successfully',
        id,
        first_name: existingAdmin[0].first_name,
        last_name: existingAdmin[0].last_name
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error deleting admin:', error);
    res.status(500).json({ error: 'Failed to delete admin' });
  }
};

// Admin Login
exports.adminLogin = async (req, res) => {
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
      // Check if admin exists
      const [admin] = await connection.query(
        'SELECT id, email, password, first_name, last_name, status FROM admins WHERE email = ?',
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
        { id: admin[0].id, email: admin[0].email, role: 'admin' },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      res.status(200).json({
        message: 'Admin login successful',
        token,
        admin: {
          id: admin[0].id,
          email: admin[0].email,
          first_name: admin[0].first_name,
          last_name: admin[0].last_name,
          role: 'admin'
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error in admin login:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
};
