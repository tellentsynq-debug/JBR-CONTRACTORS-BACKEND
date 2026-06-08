const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/database');

// Generate unique link token
const generateLinkToken = () => uuidv4();

// Create campaign
exports.createCampaign = async (req, res) => {
  try {
    const { name, start_date, end_date, is_active } = req.body;
    const created_by = req.userId; // From authMiddleware

    // Validation: Required fields
    if (!name || !start_date || !end_date) {
      return res.status(400).json({
        error: 'Campaign name, start date, and end date are required'
      });
    }

    // Validation: End date must be greater than start date
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    if (endDate <= startDate) {
      return res.status(400).json({
        error: 'End date must be after start date'
      });
    }

    // Generate unique link token for registration link
    const link_token = generateLinkToken();

    const { data, error } = await supabase
      .from('campaigns')
      .insert([
        {
          name,
          start_date,
          end_date,
          is_active: is_active !== undefined ? is_active : true,
          link_token,
          created_by,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select();

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(400).json({ error: error.message });
    }

    const campaign = data[0];
    res.status(201).json({
      id: campaign.id,
      name: campaign.name,
      start_date: campaign.start_date,
      end_date: campaign.end_date,
      is_active: campaign.is_active,
      link_token: campaign.link_token,
      created_by: campaign.created_by,
      created_at: campaign.created_at,
      message: 'Campaign created successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Get all campaigns
exports.getAllCampaigns = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase fetch error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Get campaign by ID
exports.getCampaignById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Campaign not found' });
      }
      console.error('Supabase fetch error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Update campaign
exports.updateCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, start_date, end_date, is_active } = req.body;

    // Validate that end_date > start_date if both are provided
    if (start_date && end_date) {
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);
      if (endDate <= startDate) {
        return res.status(400).json({
          error: 'End date must be after start date'
        });
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (start_date !== undefined) updateData.start_date = start_date;
    if (end_date !== undefined) updateData.end_date = end_date;
    if (is_active !== undefined) updateData.is_active = is_active;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('campaigns')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) {
      console.error('Supabase update error:', error);
      return res.status(400).json({ error: error.message });
    }

    if (data.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const campaign = data[0];
    res.json({
      id: campaign.id,
      name: campaign.name,
      start_date: campaign.start_date,
      end_date: campaign.end_date,
      is_active: campaign.is_active,
      updated_at: campaign.updated_at,
      message: 'Campaign updated successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Delete campaign
exports.deleteCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase delete error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Campaign deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Activate campaign
exports.activateCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('campaigns')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select();

    if (error) {
      console.error('Supabase update error:', error);
      return res.status(400).json({ error: error.message });
    }

    if (data.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json({
      id: data[0].id,
      is_active: true,
      message: 'Campaign activated successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Deactivate campaign
exports.deactivateCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('campaigns')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select();

    if (error) {
      console.error('Supabase update error:', error);
      return res.status(400).json({ error: error.message });
    }

    if (data.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json({
      id: data[0].id,
      is_active: false,
      message: 'Campaign deactivated successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Get campaign registration link (for employees to register)
exports.getCampaignLink = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('campaigns')
      .select('id, name, link_token, is_active')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Campaign not found' });
      }
      console.error('Supabase fetch error:', error);
      return res.status(400).json({ error: error.message });
    }

    if (!data.is_active) {
      return res.status(400).json({ error: 'Campaign is not active' });
    }

    // Construct the registration link
    const origin = process.env.FRONTEND_URL || 'http://localhost:3000';
    const registrationLink = `${origin}/employee_register?token=${data.link_token}`;

    res.json({
      campaign_id: data.id,
      campaign_name: data.name,
      registration_link: registrationLink,
      token: data.link_token
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};
