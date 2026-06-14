const supabase = require('../config/database');
const supabaseAdmin = supabase.admin;

/**
 * Create a new job category
 * POST /job-categories
 * @body {string} name - Category name (required)
 * @body {string} job_industry_id - Parent industry ID (required)
 * @body {string} description - Category description (optional)
 * @body {boolean} is_active - Active status (default: true)
 * @body {boolean} license_required - License required (default: false)
 */
exports.createJobCategory = async (req, res) => {
  try {
    const { name, job_industry_id, description, is_active = true, license_required = false } = req.body;

    // Validation
    if (!name || name.trim() === '') {
      return res.status(400).json({ 
        error: 'Category name is required' 
      });
    }

    if (!job_industry_id) {
      return res.status(400).json({ 
        error: 'Job industry ID is required' 
      });
    }

    // Check if industry exists
    const { data: industry, error: industryError } = await supabaseAdmin
      .from('job_industries')
      .select('id')
      .eq('id', job_industry_id)
      .single();

    if (industryError || !industry) {
      return res.status(400).json({ 
        error: 'Invalid job industry ID' 
      });
    }

    // Check if category name already exists for this industry (case-insensitive)
    const { data: existingCategory } = await supabaseAdmin
      .from('job_categories')
      .select('id')
      .eq('job_industry_id', job_industry_id)
      .ilike('name', name)
      .single();

    if (existingCategory) {
      return res.status(400).json({ 
        error: 'Category name already exists for this industry' 
      });
    }

    // Insert new job category
    const { data: newCategory, error: insertError } = await supabaseAdmin
      .from('job_categories')
      .insert([{
        name: name.trim(),
        job_industry_id,
        description: description?.trim() || null,
        is_active,
        license_required
      }])
      .select();

    if (insertError) {
      console.error('Error creating job category:', insertError);
      return res.status(500).json({ 
        error: 'Failed to create job category',
        details: insertError.message 
      });
    }

    res.status(201).json({
      message: 'Job category created successfully',
      data: newCategory[0]
    });
  } catch (error) {
    console.error('Error creating job category:', error);
    res.status(500).json({ 
      error: 'Failed to create job category',
      details: error.message 
    });
  }
};

/**
 * Get all job categories
 * GET /job-categories
 * @query {string} search - Filter by name or description
 * @query {string} industry_id - Filter by industry
 * @query {boolean} active_only - Show only active categories
 */
exports.getAllJobCategories = async (req, res) => {
  try {
    const { search, industry_id, active_only } = req.query;

    let query = supabaseAdmin
      .from('job_categories')
      .select(`
        *,
        job_industry:job_industries(id, name)
      `)
      .order('created_at', { ascending: false });

    // Filter by industry if provided
    if (industry_id) {
      query = query.eq('job_industry_id', industry_id);
    }

    // Filter by active status if requested
    if (active_only === 'true') {
      query = query.eq('is_active', true);
    }

    const { data: categories, error } = await query;

    if (error) {
      console.error('Error retrieving job categories:', error);
      return res.status(500).json({ 
        error: 'Failed to retrieve job categories',
        details: error.message 
      });
    }

    // Filter by search term if provided
    let filteredCategories = categories;
    if (search && search.trim() !== '') {
      const searchLower = search.toLowerCase();
      filteredCategories = categories.filter(cat => 
        cat.name.toLowerCase().includes(searchLower) ||
        (cat.description && cat.description.toLowerCase().includes(searchLower))
      );
    }

    res.status(200).json({
      message: 'Job categories retrieved successfully',
      count: filteredCategories.length,
      data: filteredCategories
    });
  } catch (error) {
    console.error('Error retrieving job categories:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve job categories',
      details: error.message 
    });
  }
};

/**
 * Get job category by ID
 * GET /job-categories/:id
 */
exports.getJobCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ 
        error: 'Category ID is required' 
      });
    }

    const { data: category, error } = await supabaseAdmin
      .from('job_categories')
      .select(`
        *,
        job_industry:job_industries(id, name)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ 
          error: 'Job category not found' 
        });
      }
      console.error('Error retrieving job category:', error);
      return res.status(500).json({ 
        error: 'Failed to retrieve job category',
        details: error.message 
      });
    }

    res.status(200).json({
      message: 'Job category retrieved successfully',
      data: category
    });
  } catch (error) {
    console.error('Error retrieving job category:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve job category',
      details: error.message 
    });
  }
};

/**
 * Get categories by industry ID
 * GET /job-categories/industry/:industryId
 */
exports.getCategoriesByIndustryId = async (req, res) => {
  try {
    const { industryId } = req.params;

    if (!industryId) {
      return res.status(400).json({ 
        error: 'Industry ID is required' 
      });
    }

    // Verify industry exists
    const { data: industry, error: industryError } = await supabaseAdmin
      .from('job_industries')
      .select('id')
      .eq('id', industryId)
      .single();

    if (industryError || !industry) {
      return res.status(404).json({ 
        error: 'Job industry not found' 
      });
    }

    const { data: categories, error } = await supabaseAdmin
      .from('job_categories')
      .select(`
        *,
        job_industry:job_industries(id, name)
      `)
      .eq('job_industry_id', industryId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error retrieving job categories:', error);
      return res.status(500).json({ 
        error: 'Failed to retrieve job categories',
        details: error.message 
      });
    }

    res.status(200).json({
      message: 'Job categories retrieved successfully',
      count: categories.length,
      data: categories
    });
  } catch (error) {
    console.error('Error retrieving job categories:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve job categories',
      details: error.message 
    });
  }
};

/**
 * Update job category
 * PATCH /job-categories/:id
 */
exports.updateJobCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, job_industry_id, description, is_active, license_required } = req.body;

    if (!id) {
      return res.status(400).json({ 
        error: 'Category ID is required' 
      });
    }

    // Validation - at least one field must be provided
    if (name === undefined && job_industry_id === undefined && description === undefined && is_active === undefined && license_required === undefined) {
      return res.status(400).json({ 
        error: 'At least one field must be provided for update' 
      });
    }

    // Check if category exists
    const { data: existingCategory, error: checkError } = await supabaseAdmin
      .from('job_categories')
      .select('*')
      .eq('id', id)
      .single();

    if (checkError || !existingCategory) {
      return res.status(404).json({ 
        error: 'Job category not found' 
      });
    }

    // If job_industry_id is provided, verify it exists
    if (job_industry_id) {
      const { data: industry, error: industryError } = await supabaseAdmin
        .from('job_industries')
        .select('id')
        .eq('id', job_industry_id)
        .single();

      if (industryError || !industry) {
        return res.status(400).json({ 
          error: 'Invalid job industry ID' 
        });
      }
    }

    // Check if new category name already exists for another category in same industry
    if (name) {
      const { data: duplicateCategory } = await supabaseAdmin
        .from('job_categories')
        .select('id')
        .eq('job_industry_id', job_industry_id || existingCategory.job_industry_id)
        .ilike('name', name)
        .neq('id', id)
        .single();

      if (duplicateCategory) {
        return res.status(400).json({ 
          error: 'Category name already exists for this industry' 
        });
      }
    }

    // Build update object
    const updateObj = {};
    if (name !== undefined) updateObj.name = name.trim();
    if (job_industry_id !== undefined) updateObj.job_industry_id = job_industry_id;
    if (description !== undefined) updateObj.description = description?.trim() || null;
    if (is_active !== undefined) updateObj.is_active = is_active;
    if (license_required !== undefined) updateObj.license_required = license_required;

    // Update the job category
    const { data: updatedCategory, error: updateError } = await supabaseAdmin
      .from('job_categories')
      .update(updateObj)
      .eq('id', id)
      .select(`
        *,
        job_industry:job_industries(id, name)
      `);

    if (updateError) {
      console.error('Error updating job category:', updateError);
      return res.status(500).json({ 
        error: 'Failed to update job category',
        details: updateError.message 
      });
    }

    res.status(200).json({
      message: 'Job category updated successfully',
      data: updatedCategory[0]
    });
  } catch (error) {
    console.error('Error updating job category:', error);
    res.status(500).json({ 
      error: 'Failed to update job category',
      details: error.message 
    });
  }
};

/**
 * Delete job category
 * DELETE /job-categories/:id
 */
exports.deleteJobCategory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ 
        error: 'Category ID is required' 
      });
    }

    // Check if category exists
    const { data: existingCategory, error: checkError } = await supabaseAdmin
      .from('job_categories')
      .select('*')
      .eq('id', id)
      .single();

    if (checkError || !existingCategory) {
      return res.status(404).json({ 
        error: 'Job category not found' 
      });
    }

    // Delete the job category
    const { error: deleteError } = await supabaseAdmin
      .from('job_categories')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting job category:', deleteError);
      return res.status(500).json({ 
        error: 'Failed to delete job category',
        details: deleteError.message 
      });
    }

    res.status(200).json({
      message: 'Job category deleted successfully',
      data: {
        id: existingCategory.id,
        name: existingCategory.name
      }
    });
  } catch (error) {
    console.error('Error deleting job category:', error);
    res.status(500).json({ 
      error: 'Failed to delete job category',
      details: error.message 
    });
  }
};
