const supabase = require('../config/database');
const supabaseAdmin = supabase.admin;

/**
 * Create a new job industry
 * POST /job-industries
 * @body {string} name - Industry name (required)
 * @body {string} description - Industry description (optional)
 * @body {boolean} is_active - Active status (default: true)
 */
exports.createJobIndustry = async (req, res) => {
  try {
    const { name, description, is_active = true } = req.body;

    // Validation
    if (!name || name.trim() === '') {
      return res.status(400).json({ 
        error: 'Job industry name is required' 
      });
    }

    // Check if industry name already exists
    const { data: existingIndustry, error: checkError } = await supabaseAdmin
      .from('job_industries')
      .select('id')
      .ilike('name', name)
      .single();

    if (existingIndustry) {
      return res.status(400).json({ 
        error: 'Job industry name already exists' 
      });
    }

    // Insert new job industry
    const { data: newIndustry, error: insertError } = await supabaseAdmin
      .from('job_industries')
      .insert([{
        name: name.trim(),
        description: description?.trim() || null,
        is_active
      }])
      .select();

    if (insertError) {
      console.error('Error creating job industry:', insertError);
      return res.status(500).json({ 
        error: 'Failed to create job industry',
        details: insertError.message 
      });
    }

    res.status(201).json({
      message: 'Job industry created successfully',
      data: newIndustry[0]
    });
  } catch (error) {
    console.error('Error creating job industry:', error);
    res.status(500).json({ 
      error: 'Failed to create job industry',
      details: error.message 
    });
  }
};

/**
 * Get all job industries
 * GET /job-industries
 * @query {string} search - Optional search by name or description
 * @query {boolean} active_only - Show only active industries (default: false)
 */
exports.getAllJobIndustries = async (req, res) => {
  try {
    const { search, active_only } = req.query;

    let query = supabaseAdmin
      .from('job_industries')
      .select('*')
      .order('created_at', { ascending: false });

    // Filter by active status if requested
    if (active_only === 'true') {
      query = query.eq('is_active', true);
    }

    const { data: industries, error } = await query;

    if (error) {
      console.error('Error retrieving job industries:', error);
      return res.status(500).json({ 
        error: 'Failed to retrieve job industries',
        details: error.message 
      });
    }

    // Filter by search term if provided
    let filteredIndustries = industries;
    if (search && search.trim() !== '') {
      const searchLower = search.toLowerCase();
      filteredIndustries = industries.filter(ind => 
        ind.name.toLowerCase().includes(searchLower) ||
        (ind.description && ind.description.toLowerCase().includes(searchLower))
      );
    }

    res.status(200).json({
      message: 'Job industries retrieved successfully',
      count: filteredIndustries.length,
      data: filteredIndustries
    });
  } catch (error) {
    console.error('Error retrieving job industries:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve job industries',
      details: error.message 
    });
  }
};

/**
 * Get job industry by ID
 * GET /job-industries/:id
 */
exports.getJobIndustryById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ 
        error: 'Industry ID is required' 
      });
    }

    const { data: industry, error } = await supabaseAdmin
      .from('job_industries')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ 
          error: 'Job industry not found' 
        });
      }
      console.error('Error retrieving job industry:', error);
      return res.status(500).json({ 
        error: 'Failed to retrieve job industry',
        details: error.message 
      });
    }

    res.status(200).json({
      message: 'Job industry retrieved successfully',
      data: industry
    });
  } catch (error) {
    console.error('Error retrieving job industry:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve job industry',
      details: error.message 
    });
  }
};

/**
 * Update job industry
 * PATCH /job-industries/:id
 */
exports.updateJobIndustry = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, is_active } = req.body;

    if (!id) {
      return res.status(400).json({ 
        error: 'Industry ID is required' 
      });
    }

    // Validation - at least one field must be provided
    if (name === undefined && description === undefined && is_active === undefined) {
      return res.status(400).json({ 
        error: 'At least one field (name, description, or is_active) must be provided' 
      });
    }

    // Check if industry exists
    const { data: existingIndustry, error: checkError } = await supabaseAdmin
      .from('job_industries')
      .select('id')
      .eq('id', id)
      .single();

    if (checkError || !existingIndustry) {
      return res.status(404).json({ 
        error: 'Job industry not found' 
      });
    }

    // Check if new name already exists (if name is being updated)
    if (name) {
      const { data: duplicateName, error: dupError } = await supabaseAdmin
        .from('job_industries')
        .select('id')
        .ilike('name', name)
        .neq('id', id)
        .single();

      if (duplicateName) {
        return res.status(400).json({ 
          error: 'Job industry name already exists' 
        });
      }
    }

    // Build update object
    const updateObj = {};
    if (name !== undefined) updateObj.name = name.trim();
    if (description !== undefined) updateObj.description = description?.trim() || null;
    if (is_active !== undefined) updateObj.is_active = is_active;

    // Update the job industry
    const { data: updatedIndustry, error: updateError } = await supabaseAdmin
      .from('job_industries')
      .update(updateObj)
      .eq('id', id)
      .select();

    if (updateError) {
      console.error('Error updating job industry:', updateError);
      return res.status(500).json({ 
        error: 'Failed to update job industry',
        details: updateError.message 
      });
    }

    res.status(200).json({
      message: 'Job industry updated successfully',
      data: updatedIndustry[0]
    });
  } catch (error) {
    console.error('Error updating job industry:', error);
    res.status(500).json({ 
      error: 'Failed to update job industry',
      details: error.message 
    });
  }
};

/**
 * Delete job industry
 * DELETE /job-industries/:id
 */
exports.deleteJobIndustry = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ 
        error: 'Industry ID is required' 
      });
    }

    // Check if industry exists
    const { data: existingIndustry, error: checkError } = await supabaseAdmin
      .from('job_industries')
      .select('*')
      .eq('id', id)
      .single();

    if (checkError || !existingIndustry) {
      return res.status(404).json({ 
        error: 'Job industry not found' 
      });
    }

    // Delete the job industry
    const { error: deleteError } = await supabaseAdmin
      .from('job_industries')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting job industry:', deleteError);
      return res.status(500).json({ 
        error: 'Failed to delete job industry',
        details: deleteError.message 
      });
    }

    res.status(200).json({
      message: 'Job industry deleted successfully',
      data: {
        id: existingIndustry.id,
        name: existingIndustry.name
      }
    });
  } catch (error) {
    console.error('Error deleting job industry:', error);
    res.status(500).json({ 
      error: 'Failed to delete job industry',
      details: error.message 
    });
  }
};
