const supabase = require('../config/database');
const supabaseAdmin = supabase.admin;
const util = require('util');

/**
 * Create a new job
 * POST /jobs
 */
exports.createJob = async (req, res) => {
  try {
    // Accept a few common alias field names from clients (snake_case / camelCase / alternate names)
    const body = req.body || {};
    const campaign_name = body.campaign_name || body.campaignName || body.campaign || '';
    const role_title = body.role_title || body.roleTitle || body.role || '';
    const company_or_warehouse = (
      body.company_or_warehouse || body.company_or_warehouse === '' ? body.company_or_warehouse :
      body.company_warehouse || body.companyWarehouse || body.company || null
    );
    const hourly_rate = body.hourly_rate !== undefined ? body.hourly_rate : body.hourlyRate;
    const start_at = body.start_at || body.startAt || body.start_date_time || body.start_date || body.startDateTime || body.start_date_time;
    const end_at = body.end_at || body.endAt || body.end_date_time || body.end_date || body.endDateTime || body.end_date_time;
    const full_address = body.full_address || body.fullAddress || body.address || null;
    const is_active = body.is_active !== undefined ? body.is_active : (body.isActive !== undefined ? body.isActive : true);

    if (!campaign_name || campaign_name.trim() === '') {
      return res.status(400).json({ error: 'Campaign / Job name is required' });
    }

    if (!role_title || role_title.trim() === '') {
      return res.status(400).json({ error: 'Role title is required' });
    }

    // Basic hourly_rate validation if provided
    if (hourly_rate !== undefined && hourly_rate !== null) {
      const num = Number(hourly_rate);
      if (Number.isNaN(num) || num < 0) {
        return res.status(400).json({ error: 'Invalid hourly rate' });
      }
    }

    // Validate start_at and end_at if provided
    if (start_at) {
      const t = Date.parse(start_at);
      if (Number.isNaN(t)) {
        return res.status(400).json({ error: 'Invalid start_at date' });
      }
    }
    if (end_at) {
      const t = Date.parse(end_at);
      if (Number.isNaN(t)) {
        return res.status(400).json({ error: 'Invalid end_at date' });
      }
    }

    const insertObj = {
      campaign_name: campaign_name.trim(),
      role_title: role_title.trim(),
      company_or_warehouse: company_or_warehouse ? String(company_or_warehouse).trim() : null,
      hourly_rate: hourly_rate !== undefined ? Number(hourly_rate) : null,
      start_at: start_at ? new Date(start_at).toISOString() : null,
      end_at: end_at ? new Date(end_at).toISOString() : null,
      full_address: full_address ? String(full_address).trim() : null,
      is_active
    };

    // Log the final insert object to help diagnose remote failures (best-effort readable)
    console.log('Job insert payload:', util.inspect(insertObj, { depth: null }));

    const { data, error } = await supabaseAdmin
      .from('jobs')
      .insert([insertObj])
      .select();

    if (error) {
      console.error('Error creating job:', error);
      // Some Supabase error objects have non-enumerable properties which JSON.stringify hides.
      // Use util.inspect to get a readable representation (best-effort) to return to caller and logs.
      const details = (error && error.message) ? error.message : util.inspect(error, { depth: null });
      return res.status(500).json({ error: 'Failed to create job', details });
    }

    res.status(201).json({ message: 'Job created successfully', data: data[0] });
  } catch (err) {
    console.error('Error in createJob:', err);
    res.status(500).json({ error: 'Failed to create job', details: err.message });
  }
};

/**
 * Get all jobs
 * GET /jobs
 */
exports.getAllJobs = async (req, res) => {
  try {
    const { search, active_only } = req.query;

    let query = supabaseAdmin
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (active_only === 'true') {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching jobs:', error);
      return res.status(500).json({ error: 'Failed to retrieve jobs', details: error.message });
    }

    let filtered = data;
    if (search && search.trim() !== '') {
      const s = search.trim().toLowerCase();
      filtered = data.filter(j =>
        (j.campaign_name && j.campaign_name.toLowerCase().includes(s)) ||
        (j.role_title && j.role_title.toLowerCase().includes(s)) ||
        (j.company_or_warehouse && j.company_or_warehouse.toLowerCase().includes(s)) ||
        (j.full_address && j.full_address.toLowerCase().includes(s))
      );
    }

    res.status(200).json({ message: 'Jobs retrieved successfully', count: filtered.length, data: filtered });
  } catch (err) {
    console.error('Error in getAllJobs:', err);
    res.status(500).json({ error: 'Failed to retrieve jobs', details: err.message });
  }
};

/**
 * Get job by ID
 * GET /jobs/:id
 */
exports.getJobById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Job ID is required' });
    }

    const { data, error } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Job not found' });
      }
      console.error('Error fetching job:', error);
      return res.status(500).json({ error: 'Failed to retrieve job', details: error.message });
    }

    res.status(200).json({ message: 'Job retrieved successfully', data });
  } catch (err) {
    console.error('Error in getJobById:', err);
    res.status(500).json({ error: 'Failed to retrieve job', details: err.message });
  }
};

/**
 * Update job
 * PATCH /jobs/:id
 */
exports.updateJob = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      campaign_name,
      role_title,
      company_or_warehouse,
      hourly_rate,
      start_at,
      end_at,
      full_address,
      is_active
    } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Job ID is required' });
    }

    // Check if job exists
    const { data: existingJob, error: checkError } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (checkError || !existingJob) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // At least one field must be provided
    if (
      campaign_name === undefined &&
      role_title === undefined &&
      company_or_warehouse === undefined &&
      hourly_rate === undefined &&
      start_at === undefined &&
      end_at === undefined &&
      full_address === undefined &&
      is_active === undefined
    ) {
      return res.status(400).json({ error: 'At least one field must be provided to update' });
    }

    const updateObj = {};
    if (campaign_name !== undefined) updateObj.campaign_name = campaign_name.trim();
    if (role_title !== undefined) updateObj.role_title = role_title.trim();
    if (company_or_warehouse !== undefined) updateObj.company_or_warehouse = company_or_warehouse ? String(company_or_warehouse).trim() : null;
    if (hourly_rate !== undefined) {
      const num = Number(hourly_rate);
      if (!Number.isNaN(num) && num >= 0) {
        updateObj.hourly_rate = num;
      } else {
        return res.status(400).json({ error: 'Invalid hourly rate' });
      }
    }
    if (start_at !== undefined) updateObj.start_at = start_at ? new Date(start_at).toISOString() : null;
    if (end_at !== undefined) updateObj.end_at = end_at ? new Date(end_at).toISOString() : null;
    if (full_address !== undefined) updateObj.full_address = full_address ? String(full_address).trim() : null;
    if (is_active !== undefined) updateObj.is_active = is_active;

    updateObj.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('jobs')
      .update(updateObj)
      .eq('id', id)
      .select();

    if (error) {
      console.error('Error updating job:', error);
      return res.status(500).json({ error: 'Failed to update job', details: error.message });
    }

    res.status(200).json({ message: 'Job updated successfully', data: data[0] });
  } catch (err) {
    console.error('Error in updateJob:', err);
    res.status(500).json({ error: 'Failed to update job', details: err.message });
  }
};

/**
 * Delete job
 * DELETE /jobs/:id
 */
exports.deleteJob = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Job ID is required' });
    }

    const { data: existingJob, error: checkError } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (checkError || !existingJob) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const { error } = await supabaseAdmin
      .from('jobs')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting job:', error);
      return res.status(500).json({ error: 'Failed to delete job', details: error.message });
    }

    res.status(200).json({ message: 'Job deleted successfully', data: { id } });
  } catch (err) {
    console.error('Error in deleteJob:', err);
    res.status(500).json({ error: 'Failed to delete job', details: err.message });
  }
};
