const supabaseModule = require('../config/database');
const supabaseAdmin = supabaseModule.admin;
const {
  formatEmployeeWithRegistration,
  formatEmployeesWithRegistrationAndDocuments,
  formatEmployeeWithRegistrationAndDocuments
} = require('../utils/registrationUtils');

// Get all employees/candidates with filters
exports.getAllEmployees = async (req, res) => {
  try {
    const { 
      id,
      employee_id,
      employeeId,
      campaign_id, 
      job_category_id, 
      job_industry_id, 
      verification_status,
      search,
      limit = 10,
      offset = 0 
    } = req.query;

    const parsedLimit = parseInt(limit, 10) || 10;
    const parsedOffset = parseInt(offset, 10) || 0;
    const requestedId = id || employee_id || employeeId;

    let query = supabaseAdmin
      .from('candidates')
      .select(
        `id, first_name, last_name, email, phone_number, registration_number,
         gender, date_of_birth, city, province, postal_code,
         job_category_id, job_industry_id, campaign_id,
         verification_status, available_from, permit_status,
         shift_preference, license_required, license_expiry_month,
         license_expiry_year, resume_url, created_at, updated_at,
         job_categories:job_category_id(id, name),
         job_industries:job_industry_id(id, name),
         campaigns:campaign_id(id, name)`,
        { count: 'exact' }
      )
      .is('deleted_at', null); // Exclude soft-deleted records

    // Apply filters
    if (requestedId) {
      query = query.eq('id', requestedId);
    }
    if (campaign_id) {
      query = query.eq('campaign_id', campaign_id);
    }
    if (job_category_id) {
      query = query.eq('job_category_id', job_category_id);
    }
    if (job_industry_id) {
      query = query.eq('job_industry_id', job_industry_id);
    }
    if (verification_status) {
      query = query.eq('verification_status', verification_status);
    }

    // Search by name or email
    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    // Pagination and sorting
    query = query
      .order('created_at', { ascending: false })
      .range(parsedOffset, parsedOffset + parsedLimit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Supabase fetch error:', error);
      return res.status(400).json({ error: error.message });
    }

    // Ensure registration_number is present for all employees and attach documents
    const formattedData = await formatEmployeesWithRegistrationAndDocuments(data);

    res.json({
      data: formattedData,
      pagination: {
        limit: parsedLimit,
        offset: parsedOffset,
        total: count
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Get employee by ID
exports.getEmployeeById = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id || typeof id !== 'string' || id.trim() === '') {
      return res.status(400).json({ error: 'Invalid employee ID format' });
    }

    const { data, error } = await supabaseAdmin
      .from('candidates')
      .select(
        `id, first_name, last_name, email, phone_number, registration_number,
         gender, date_of_birth, city, province, postal_code,
         job_category_id, job_industry_id, campaign_id,
         verification_status, available_from, permit_status,
         shift_preference, license_required, license_expiry_month,
         license_expiry_year, resume_url, created_at, updated_at,
         job_categories:job_category_id(id, name),
         job_industries:job_industry_id(id, name),
         campaigns:campaign_id(id, name)`
      )
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Employee not found' });
      }
      console.error('Supabase fetch error:', error);
      return res.status(400).json({ error: error.message });
    }

    // Ensure registration_number is present and attach documents
    const formattedData = await formatEmployeeWithRegistrationAndDocuments(data);
    
    res.json(formattedData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Create employee
exports.createEmployee = async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      email: bodyEmail,
      phone_number,
      gender,
      date_of_birth,
      city,
      province,
      postal_code,
      job_category_id,
      job_industry_id,
      campaign_id,
      available_from,
      permit_status,
      shift_preference,
      license_required,
      license_expiry_month,
      license_expiry_year,
      resume_url
    } = req.body;

    // Use email from OTP token if available (for OTP verified users), otherwise use body email
    const email = req.userEmail || bodyEmail;
    const tokenType = req.tokenType || 'standard';

    // Validation
    if (!first_name || !last_name || !email || !phone_number) {
      return res.status(400).json({
        error: 'first_name, last_name, email, and phone_number are required'
      });
    }

    // Additional validation for OTP-verified users
    if (tokenType === 'email_verified' && email !== req.userEmail) {
      return res.status(400).json({
        error: 'Email in request must match your verified email',
        verified_email: req.userEmail
      });
    }

    const { data, error } = await supabaseAdmin
      .from('candidates')
      .insert([
        {
          first_name,
          last_name,
          email,
          phone_number,
          gender,
          date_of_birth,
          city,
          province,
          postal_code,
          job_category_id,
          job_industry_id,
          campaign_id,
          verification_status: tokenType === 'email_verified' ? 'verified' : 'pending',
          available_from,
          permit_status: permit_status || 'not_checked',
          shift_preference,
          license_required,
          license_expiry_month,
          license_expiry_year,
          resume_url,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select();

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(400).json({ error: error.message });
    }

    // Ensure registration_number is present
    const employee = formatEmployeeWithRegistration(data[0]);

    res.status(201).json({
      success: true,
      ...employee,
      message: 'Employee created successfully',
      email_verified: tokenType === 'email_verified'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Update employee
exports.updateEmployee = async (req, res) => {
  try {
    const id = req.params.id;
    
    // Validate ID format - allow 'self' or UUID (36 chars with dashes)
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid employee ID format' });
    }
    
    // Allow 'self' or UUID-like strings (at least 4 chars)
    if (id !== 'self' && id.length < 10) {
      return res.status(400).json({ error: 'Invalid employee ID format' });
    }

    // Support OTP token users updating their own profile
    const tokenType = req.tokenType;
    const userEmail = req.userEmail;
    
    // If OTP token user and ID is 'self', use email instead
    let updateFilter = { field: 'id', value: id };
    if (tokenType === 'email_verified' && userEmail && id === 'self') {
      updateFilter = { field: 'email', value: userEmail };
    }

    const {
      first_name,
      last_name,
      email,
      phone_number,
      gender,
      date_of_birth,
      city,
      province,
      postal_code,
      job_category_id,
      job_industry_id,
      campaign_id,
      verification_status,
      available_from,
      permit_status,
      shift_preference,
      license_required,
      license_expiry_month,
      license_expiry_year,
      resume_url
    } = req.body;

    const updateData = {};
    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (email !== undefined) updateData.email = email;
    if (phone_number !== undefined) updateData.phone_number = phone_number;
    if (gender !== undefined) updateData.gender = gender;
    if (date_of_birth !== undefined) updateData.date_of_birth = date_of_birth;
    if (city !== undefined) updateData.city = city;
    if (province !== undefined) updateData.province = province;
    if (postal_code !== undefined) updateData.postal_code = postal_code;
    if (job_category_id !== undefined) updateData.job_category_id = job_category_id;
    if (job_industry_id !== undefined) updateData.job_industry_id = job_industry_id;
    if (campaign_id !== undefined) updateData.campaign_id = campaign_id;
    if (verification_status !== undefined) updateData.verification_status = verification_status;
    if (available_from !== undefined) updateData.available_from = available_from;
    if (permit_status !== undefined) updateData.permit_status = permit_status;
    if (shift_preference !== undefined) updateData.shift_preference = shift_preference;
    if (license_required !== undefined) updateData.license_required = license_required;
    if (license_expiry_month !== undefined) updateData.license_expiry_month = license_expiry_month;
    if (license_expiry_year !== undefined) updateData.license_expiry_year = license_expiry_year;
    if (resume_url !== undefined) updateData.resume_url = resume_url;
    updateData.updated_at = new Date().toISOString();

    // Build query with proper filter
    let query = supabaseAdmin
      .from('candidates')
      .update(updateData)
      .eq(updateFilter.field, updateFilter.value)
      .is('deleted_at', null)
      .select();

    const { data, error } = await query;

    if (error) {
      console.error('Supabase update error:', error);
      return res.status(400).json({ error: error.message });
    }

    if (data.length === 0) {
      return res.status(404).json({ error: 'Employee not found or already deleted' });
    }

    // Ensure registration_number is present
    const employee = formatEmployeeWithRegistration(data[0]);

    res.json({
      success: true,
      ...employee,
      message: 'Employee updated successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Delete employee (soft delete)
exports.deleteEmployee = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id || typeof id !== 'string' || id.trim() === '') {
      return res.status(400).json({ error: 'Invalid employee ID format' });
    }

    const { error } = await supabaseAdmin
      .from('candidates')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Supabase delete error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Verify employee
exports.verifyEmployee = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id || typeof id !== 'string' || id.trim() === '') {
      return res.status(400).json({ error: 'Invalid employee ID format' });
    }

    const { data, error } = await supabaseAdmin
      .from('candidates')
      .update({
        verification_status: 'verified',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .is('deleted_at', null)
      .select();

    if (error) {
      console.error('Supabase update error:', error);
      return res.status(400).json({ error: error.message });
    }

    if (data.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Ensure registration_number is present
    const employee = formatEmployeeWithRegistration(data[0]);

    res.json({
      id: employee.id,
      registration_number: employee.registration_number,
      verification_status: 'verified',
      message: 'Employee verified successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Reject employee
exports.rejectEmployee = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id || typeof id !== 'string' || id.trim() === '') {
      return res.status(400).json({ error: 'Invalid employee ID format' });
    }

    const { data, error } = await supabaseAdmin
      .from('candidates')
      .update({
        verification_status: 'rejected',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .is('deleted_at', null)
      .select();

    if (error) {
      console.error('Supabase update error:', error);
      return res.status(400).json({ error: error.message });
    }

    if (data.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Ensure registration_number is present
    const employee = formatEmployeeWithRegistration(data[0]);

    res.json({
      id: employee.id,
      registration_number: employee.registration_number,
      verification_status: 'rejected',
      message: 'Employee rejected successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Get employees by campaign
exports.getEmployeesByCampaign = async (req, res) => {
  try {
    const campaign_id = parseInt(req.params.campaign_id);
    if (isNaN(campaign_id)) {
      return res.status(400).json({ error: 'Invalid campaign ID format' });
    }

    const { data, error } = await supabaseAdmin
      .from('candidates')
      .select(
        `id, first_name, last_name, email, phone_number, registration_number,
         verification_status, created_at,
         job_categories:job_category_id(name),
         job_industries:job_industry_id(name)`,
        { count: 'exact' }
      )
      .eq('campaign_id', campaign_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase fetch error:', error);
      return res.status(400).json({ error: error.message });
    }

    // Ensure registration_number is present for all employees
    const formattedData = formatEmployeesWithRegistration(data);

    res.json({ data: formattedData, total: formattedData.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Get verification stats
exports.getVerificationStats = async (req, res) => {
  try {
    const { campaign_id } = req.query;

    let query = supabaseAdmin
      .from('candidates')
      .select('verification_status', { count: 'exact' });

    if (campaign_id) {
      query = query.eq('campaign_id', campaign_id);
    }

    query = query.is('deleted_at', null);

    // Get pending count
    const { count: pendingCount } = await query
      .eq('verification_status', 'pending');

    // Get verified count
    const { count: verifiedCount } = await supabaseAdmin
      .from('candidates')
      .select('id', { count: 'exact' })
      .eq('verification_status', 'verified')
      .is('deleted_at', null);

    // Get rejected count
    const { count: rejectedCount } = await supabaseAdmin
      .from('candidates')
      .select('id', { count: 'exact' })
      .eq('verification_status', 'rejected')
      .is('deleted_at', null);

    res.json({
      pending: pendingCount || 0,
      verified: verifiedCount || 0,
      rejected: rejectedCount || 0,
      total: (pendingCount || 0) + (verifiedCount || 0) + (rejectedCount || 0)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};
