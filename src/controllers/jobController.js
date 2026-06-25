const supabase = require('../config/database');
const supabaseAdmin = supabase.admin;

/**
 * Create a new job
 * POST /jobs
 */
exports.createJob = async (req, res) => {
  try {
    const {
      campaign_name,
      role_title,
      company_or_warehouse,
      hourly_rate,
      start_at,
      end_at,
      full_address,
      is_active = true
    } = req.body;

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

    const { data, error } = await supabaseAdmin
      .from('jobs')
      .insert([insertObj])
      .select();

    if (error) {
      console.error('Error creating job:', error);
      return res.status(500).json({ error: 'Failed to create job', details: error.message });
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
