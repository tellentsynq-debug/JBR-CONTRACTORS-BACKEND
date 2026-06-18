const supabaseModule = require('../config/database');
const supabaseAdmin = supabaseModule.admin;
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Generate 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Register employee mobile number for chat
exports.registerMobileNumber = async (req, res) => {
  try {
    const { employee_id, candidate_id, mobile_number, job_category_id, job_industry_id } = req.body;

    // Validation
    if (!employee_id || !mobile_number) {
      return res.status(400).json({ error: 'Employee ID and mobile number are required' });
    }

    // Check if mobile already exists for this employee
    const { data: existingMapping } = await supabaseAdmin
      .from('employee_job_mobile_mapping')
      .select('id')
      .eq('employee_id', employee_id)
      .eq('mobile_number', mobile_number)
      .is('deleted_at', null)
      .single();

    if (existingMapping) {
      return res.status(409).json({ error: 'This mobile number is already registered for this employee' });
    }

    // Create mapping record
    const { data, error } = await supabaseAdmin
      .from('employee_job_mobile_mapping')
      .insert([{
        employee_id,
        candidate_id,
        job_category_id,
        job_industry_id,
        mobile_number,
        mobile_verified: false
      }])
      .select();

    if (error) {
      console.error('Error creating mobile mapping:', error);
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({
      message: 'Mobile number registered successfully',
      data: data[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Send OTP for mobile verification
exports.sendOTP = async (req, res) => {
  try {
    const { employee_id, mobile_number } = req.body;

    if (!employee_id || !mobile_number) {
      return res.status(400).json({ error: 'Employee ID and mobile number are required' });
    }

    // Get the mapping
    const { data: mapping, error: mappingError } = await supabaseAdmin
      .from('employee_job_mobile_mapping')
      .select('*')
      .eq('employee_id', employee_id)
      .eq('mobile_number', mobile_number)
      .is('deleted_at', null)
      .single();

    if (mappingError || !mapping) {
      return res.status(404).json({ error: 'Mobile mapping not found' });
    }

    // Check OTP attempts
    if (mapping.otp_attempts >= 3) {
      return res.status(429).json({ error: 'Too many OTP attempts. Please try again later.' });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Update mapping with OTP
    const { error: updateError } = await supabaseAdmin
      .from('employee_job_mobile_mapping')
      .update({
        otp,
        otp_expires_at: expiresAt,
        otp_attempts: mapping.otp_attempts + 1
      })
      .eq('id', mapping.id);

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    // TODO: Send OTP via SMS (integrate with your SMS service)
    console.log(`OTP for ${mobile_number}: ${otp}`); // Remove in production

    res.json({
      message: 'OTP sent successfully',
      otp: process.env.NODE_ENV === 'development' ? otp : undefined, // Remove in production
      expires_in: 600 // seconds
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Verify OTP and enable chat
exports.verifyOTP = async (req, res) => {
  try {
    const { employee_id, mobile_number, otp } = req.body;

    if (!employee_id || !mobile_number || !otp) {
      return res.status(400).json({ error: 'Employee ID, mobile number, and OTP are required' });
    }

    // Get the mapping
    const { data: mapping, error: mappingError } = await supabaseAdmin
      .from('employee_job_mobile_mapping')
      .select('*')
      .eq('employee_id', employee_id)
      .eq('mobile_number', mobile_number)
      .is('deleted_at', null)
      .single();

    if (mappingError || !mapping) {
      return res.status(404).json({ error: 'Mobile mapping not found' });
    }

    // Check OTP expiry
    if (new Date(mapping.otp_expires_at) < new Date()) {
      return res.status(400).json({ error: 'OTP has expired' });
    }

    // Verify OTP
    if (mapping.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    // Update mapping - OTP verified and chat enabled
    const { data: updatedData, error: updateError } = await supabaseAdmin
      .from('employee_job_mobile_mapping')
      .update({
        mobile_verified: true,
        mobile_verified_at: new Date(),
        otp: null,
        otp_attempts: 0,
        chat_enabled: true,
        chat_verified_at: new Date()
      })
      .eq('id', mapping.id)
      .select();

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    res.json({
      message: 'Mobile number verified successfully',
      data: updatedData[0],
      chat_enabled: true
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Get employee mobile mappings
exports.getEmployeeMappings = async (req, res) => {
  try {
    const { employee_id } = req.params;
    const { limit = 10, offset = 0 } = req.query;

    const { data, error, count } = await supabaseAdmin
      .from('employee_job_mobile_mapping')
      .select(
        `id, employee_id, candidate_id, mobile_number, 
         mobile_verified, chat_enabled, job_category_id, 
         job_industry_id, device_type, last_active_at, 
         is_active, created_at,
         job_categories:job_category_id(id, name),
         job_industries:job_industry_id(id, name)`,
        { count: 'exact' }
      )
      .eq('employee_id', employee_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching mappings:', error);
      return res.status(400).json({ error: error.message });
    }

    res.json({
      data,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: count
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Get all active employees for chat by job category
exports.getActiveEmployeesByJobCategory = async (req, res) => {
  try {
    const { job_category_id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const { data, error, count } = await supabaseAdmin
      .from('employee_job_mobile_mapping')
      .select(
        `id, employee_id, mobile_number, mobile_verified, 
         chat_enabled, last_active_at, device_type, 
         job_category_id, job_industry_id,
         job_categories:job_category_id(id, name),
         job_industries:job_industry_id(id, name)`,
        { count: 'exact' }
      )
      .eq('job_category_id', job_category_id)
      .eq('chat_enabled', true)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('last_active_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      data,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: count
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Register device token for push notifications
exports.registerDeviceToken = async (req, res) => {
  try {
    const { employee_id, mobile_number, device_token, device_type } = req.body;

    if (!employee_id || !mobile_number || !device_token) {
      return res.status(400).json({ error: 'Employee ID, mobile number, and device token are required' });
    }

    // Update mapping with device token
    const { data, error } = await supabaseAdmin
      .from('employee_job_mobile_mapping')
      .update({
        device_token,
        device_type,
        last_active_at: new Date()
      })
      .eq('employee_id', employee_id)
      .eq('mobile_number', mobile_number)
      .is('deleted_at', null)
      .select();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: 'Device token registered successfully',
      data: data[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Update last active time
exports.updateLastActive = async (req, res) => {
  try {
    const { employee_id, mobile_number } = req.body;

    if (!employee_id || !mobile_number) {
      return res.status(400).json({ error: 'Employee ID and mobile number are required' });
    }

    const { data, error } = await supabaseAdmin
      .from('employee_job_mobile_mapping')
      .update({
        last_active_at: new Date(),
        is_active: true
      })
      .eq('employee_id', employee_id)
      .eq('mobile_number', mobile_number)
      .is('deleted_at', null)
      .select();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: 'Last active time updated',
      data: data[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Delete/Deactivate mobile mapping
exports.deactivateMobileMapping = async (req, res) => {
  try {
    const { employee_id, mobile_number } = req.params;

    if (!employee_id || !mobile_number) {
      return res.status(400).json({ error: 'Employee ID and mobile number are required' });
    }

    const { data, error } = await supabaseAdmin
      .from('employee_job_mobile_mapping')
      .update({
        is_active: false,
        deleted_at: new Date()
      })
      .eq('employee_id', employee_id)
      .eq('mobile_number', mobile_number)
      .select();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: 'Mobile mapping deactivated successfully',
      data: data[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Get chat statistics for admin
exports.getChatStatistics = async (req, res) => {
  try {
    const { job_category_id, campaign_id } = req.query;

    let query = supabaseAdmin
      .from('employee_job_mobile_mapping')
      .select('*')
      .is('deleted_at', null);

    if (job_category_id) {
      query = query.eq('job_category_id', job_category_id);
    }

    const { data: employees } = await query;

    const stats = {
      total_employees: employees?.length || 0,
      chat_enabled: employees?.filter(e => e.chat_enabled).length || 0,
      mobile_verified: employees?.filter(e => e.mobile_verified).length || 0,
      active_now: employees?.filter(e => e.is_active).length || 0,
      inactive: employees?.filter(e => !e.is_active).length || 0,
      device_breakdown: {
        android: employees?.filter(e => e.device_type === 'android').length || 0,
        ios: employees?.filter(e => e.device_type === 'ios').length || 0,
        web: employees?.filter(e => e.device_type === 'web').length || 0
      }
    };

    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};
