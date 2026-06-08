const supabase = require('../config/database');

// Create a new job industry
exports.createJobIndustry = async (req, res) => {
  try {
    const { name, description, status } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({ 
        error: 'Job industry name is required' 
      });
    }

    if (!status || !['active', 'inactive'].includes(status)) {
      return res.status(400).json({ 
        error: 'Status must be "active" or "inactive"' 
      });
    }

    const connection = await pool.getConnection();

    try {
      // Check if industry name already exists
      const [existingIndustry] = await connection.query(
        'SELECT id FROM job_industries WHERE name = ?',
        [name]
      );

      if (existingIndustry.length > 0) {
        return res.status(400).json({ error: 'Job industry name already exists' });
      }

      // Insert new job industry
      const [result] = await connection.query(
        'INSERT INTO job_industries (name, description, status) VALUES (?, ?, ?)',
        [name, description || null, status]
      );

      res.status(201).json({
        message: 'Job industry created successfully',
        id: result.insertId,
        name,
        description,
        status
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error creating job industry:', error);
    res.status(500).json({ error: 'Failed to create job industry' });
  }
};

// Get all job industries
exports.getAllJobIndustries = async (req, res) => {
  try {
    const connection = await pool.getConnection();

    try {
      const [industries] = await connection.query(
        'SELECT id, name, description, status, created_at FROM job_industries ORDER BY created_at DESC'
      );

      res.status(200).json({
        message: 'Job industries retrieved successfully',
        data: industries
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error retrieving job industries:', error);
    res.status(500).json({ error: 'Failed to retrieve job industries' });
  }
};

// Get job industry by ID
exports.getJobIndustryById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid industry ID' });
    }

    const connection = await pool.getConnection();

    try {
      const [industry] = await connection.query(
        'SELECT id, name, description, status, created_at FROM job_industries WHERE id = ?',
        [id]
      );

      if (industry.length === 0) {
        return res.status(404).json({ error: 'Job industry not found' });
      }

      res.status(200).json({
        message: 'Job industry retrieved successfully',
        data: industry[0]
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error retrieving job industry:', error);
    res.status(500).json({ error: 'Failed to retrieve job industry' });
  }
};

// Update job industry (PATCH)
exports.updateJobIndustry = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid industry ID' });
    }

    // Validation - at least one field must be provided
    if (!name && !description && !status) {
      return res.status(400).json({ 
        error: 'At least one field (name, description, or status) must be provided' 
      });
    }

    if (status && !['active', 'inactive'].includes(status)) {
      return res.status(400).json({ 
        error: 'Status must be "active" or "inactive"' 
      });
    }

    const connection = await pool.getConnection();

    try {
      // Check if industry exists
      const [existingIndustry] = await connection.query(
        'SELECT id FROM job_industries WHERE id = ?',
        [id]
      );

      if (existingIndustry.length === 0) {
        return res.status(404).json({ error: 'Job industry not found' });
      }

      // Check if new name already exists (if name is being updated)
      if (name) {
        const [duplicateName] = await connection.query(
          'SELECT id FROM job_industries WHERE name = ? AND id != ?',
          [name, id]
        );

        if (duplicateName.length > 0) {
          return res.status(400).json({ error: 'Job industry name already exists' });
        }
      }

      // Build update query dynamically
      const updates = [];
      const values = [];

      if (name) {
        updates.push('name = ?');
        values.push(name);
      }
      if (description !== undefined) {
        updates.push('description = ?');
        values.push(description);
      }
      if (status) {
        updates.push('status = ?');
        values.push(status);
      }

      values.push(id);

      const query = `UPDATE job_industries SET ${updates.join(', ')} WHERE id = ?`;
      await connection.query(query, values);

      res.status(200).json({
        message: 'Job industry updated successfully',
        id,
        name,
        description,
        status
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error updating job industry:', error);
    res.status(500).json({ error: 'Failed to update job industry' });
  }
};

// Delete job industry
exports.deleteJobIndustry = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid industry ID' });
    }

    const connection = await pool.getConnection();

    try {
      // Check if industry exists
      const [existingIndustry] = await connection.query(
        'SELECT id, name FROM job_industries WHERE id = ?',
        [id]
      );

      if (existingIndustry.length === 0) {
        return res.status(404).json({ error: 'Job industry not found' });
      }

      // Delete the job industry
      await connection.query(
        'DELETE FROM job_industries WHERE id = ?',
        [id]
      );

      res.status(200).json({
        message: 'Job industry deleted successfully',
        id,
        name: existingIndustry[0].name
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error deleting job industry:', error);
    res.status(500).json({ error: 'Failed to delete job industry' });
  }
};
