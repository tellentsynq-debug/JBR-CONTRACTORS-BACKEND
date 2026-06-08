const supabase = require('../config/database');

// Create a new job category
exports.createJobCategory = async (req, res) => {
  try {
    const { category_name, job_industry_id, description, status, license_required } = req.body;

    // Validation
    if (!category_name) {
      return res.status(400).json({ 
        error: 'Category name is required' 
      });
    }

    if (!job_industry_id) {
      return res.status(400).json({ 
        error: 'Job industry ID is required' 
      });
    }

    if (!status || !['active', 'inactive'].includes(status)) {
      return res.status(400).json({ 
        error: 'Status must be "active" or "inactive"' 
      });
    }

    const connection = await pool.getConnection();

    try {
      // Check if industry exists
      const [industry] = await connection.query(
        'SELECT id FROM job_industries WHERE id = ?',
        [job_industry_id]
      );

      if (industry.length === 0) {
        return res.status(400).json({ error: 'Invalid job industry ID' });
      }

      // Check if category name already exists for this industry
      const [existingCategory] = await connection.query(
        'SELECT id FROM job_categories WHERE category_name = ? AND job_industry_id = ?',
        [category_name, job_industry_id]
      );

      if (existingCategory.length > 0) {
        return res.status(400).json({ error: 'Category name already exists for this industry' });
      }

      // Insert new job category
      const [result] = await connection.query(
        'INSERT INTO job_categories (category_name, job_industry_id, description, status, license_required) VALUES (?, ?, ?, ?, ?)',
        [category_name, job_industry_id, description || null, status, license_required ? 1 : 0]
      );

      res.status(201).json({
        message: 'Job category created successfully',
        id: result.insertId,
        category_name,
        job_industry_id,
        description,
        status,
        license_required
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error creating job category:', error);
    res.status(500).json({ error: 'Failed to create job category' });
  }
};

// Get all job categories
exports.getAllJobCategories = async (req, res) => {
  try {
    const connection = await pool.getConnection();

    try {
      const [categories] = await connection.query(
        `SELECT 
          jc.id, 
          jc.category_name, 
          jc.job_industry_id, 
          ji.name as industry_name,
          jc.description, 
          jc.status, 
          jc.license_required,
          jc.created_at 
        FROM job_categories jc
        LEFT JOIN job_industries ji ON jc.job_industry_id = ji.id
        ORDER BY jc.created_at DESC`
      );

      res.status(200).json({
        message: 'Job categories retrieved successfully',
        data: categories
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error retrieving job categories:', error);
    res.status(500).json({ error: 'Failed to retrieve job categories' });
  }
};

// Get job category by ID
exports.getJobCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid category ID' });
    }

    const connection = await pool.getConnection();

    try {
      const [category] = await connection.query(
        `SELECT 
          jc.id, 
          jc.category_name, 
          jc.job_industry_id, 
          ji.name as industry_name,
          jc.description, 
          jc.status, 
          jc.license_required,
          jc.created_at 
        FROM job_categories jc
        LEFT JOIN job_industries ji ON jc.job_industry_id = ji.id
        WHERE jc.id = ?`,
        [id]
      );

      if (category.length === 0) {
        return res.status(404).json({ error: 'Job category not found' });
      }

      res.status(200).json({
        message: 'Job category retrieved successfully',
        data: category[0]
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error retrieving job category:', error);
    res.status(500).json({ error: 'Failed to retrieve job category' });
  }
};

// Get categories by industry ID
exports.getCategoriesByIndustryId = async (req, res) => {
  try {
    const { industryId } = req.params;

    if (!industryId || isNaN(industryId)) {
      return res.status(400).json({ error: 'Invalid industry ID' });
    }

    const connection = await pool.getConnection();

    try {
      const [categories] = await connection.query(
        `SELECT 
          jc.id, 
          jc.category_name, 
          jc.job_industry_id, 
          ji.name as industry_name,
          jc.description, 
          jc.status, 
          jc.license_required,
          jc.created_at 
        FROM job_categories jc
        LEFT JOIN job_industries ji ON jc.job_industry_id = ji.id
        WHERE jc.job_industry_id = ?
        ORDER BY jc.created_at DESC`,
        [industryId]
      );

      res.status(200).json({
        message: 'Job categories retrieved successfully',
        data: categories
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error retrieving job categories:', error);
    res.status(500).json({ error: 'Failed to retrieve job categories' });
  }
};

// Update job category (PATCH)
exports.updateJobCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { category_name, job_industry_id, description, status, license_required } = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid category ID' });
    }

    // Validation - at least one field must be provided
    if (!category_name && !job_industry_id && !description && !status && license_required === undefined) {
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
      // Check if category exists
      const [existingCategory] = await connection.query(
        'SELECT id FROM job_categories WHERE id = ?',
        [id]
      );

      if (existingCategory.length === 0) {
        return res.status(404).json({ error: 'Job category not found' });
      }

      // If job_industry_id is provided, verify it exists
      if (job_industry_id) {
        const [industry] = await connection.query(
          'SELECT id FROM job_industries WHERE id = ?',
          [job_industry_id]
        );

        if (industry.length === 0) {
          return res.status(400).json({ error: 'Invalid job industry ID' });
        }
      }

      // Check if new category name already exists for another category in same industry
      if (category_name) {
        const [duplicateCategory] = await connection.query(
          'SELECT id FROM job_categories WHERE category_name = ? AND id != ? AND job_industry_id = ?',
          [category_name, id, job_industry_id || existingCategory[0].job_industry_id]
        );

        if (duplicateCategory.length > 0) {
          return res.status(400).json({ error: 'Category name already exists for this industry' });
        }
      }

      // Build update query dynamically
      const updates = [];
      const values = [];

      if (category_name) {
        updates.push('category_name = ?');
        values.push(category_name);
      }
      if (job_industry_id) {
        updates.push('job_industry_id = ?');
        values.push(job_industry_id);
      }
      if (description !== undefined) {
        updates.push('description = ?');
        values.push(description);
      }
      if (status) {
        updates.push('status = ?');
        values.push(status);
      }
      if (license_required !== undefined) {
        updates.push('license_required = ?');
        values.push(license_required ? 1 : 0);
      }

      values.push(id);

      const query = `UPDATE job_categories SET ${updates.join(', ')} WHERE id = ?`;
      await connection.query(query, values);

      res.status(200).json({
        message: 'Job category updated successfully',
        id,
        category_name,
        job_industry_id,
        description,
        status,
        license_required
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error updating job category:', error);
    res.status(500).json({ error: 'Failed to update job category' });
  }
};

// Delete job category
exports.deleteJobCategory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid category ID' });
    }

    const connection = await pool.getConnection();

    try {
      // Check if category exists
      const [existingCategory] = await connection.query(
        'SELECT id, category_name FROM job_categories WHERE id = ?',
        [id]
      );

      if (existingCategory.length === 0) {
        return res.status(404).json({ error: 'Job category not found' });
      }

      // Delete the job category
      await connection.query(
        'DELETE FROM job_categories WHERE id = ?',
        [id]
      );

      res.status(200).json({
        message: 'Job category deleted successfully',
        id,
        category_name: existingCategory[0].category_name
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error deleting job category:', error);
    res.status(500).json({ error: 'Failed to delete job category' });
  }
};
