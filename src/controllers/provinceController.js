const supabase = require('../config/database');
const supabaseAdmin = supabase.admin;

/**
 * Create a new province
 * POST /provinces
 * @body {string} name - Province name (required)
 * @body {string} code - Province code/short code (required, max 3 chars, uppercase)
 * @body {boolean} is_active - Active status (default: true)
 */
exports.createProvince = async (req, res) => {
  try {
    const { name, code, is_active = true } = req.body;

    // Validation
    if (!name || name.trim() === '') {
      return res.status(400).json({ 
        error: 'Province name is required' 
      });
    }

    if (!code || code.trim() === '') {
      return res.status(400).json({ 
        error: 'Province code is required' 
      });
    }

    if (code.length > 3) {
      return res.status(400).json({ 
        error: 'Province code must be max 3 characters' 
      });
    }

    // Check if province name already exists (case-insensitive)
    const { data: existingProvince } = await supabaseAdmin
      .from('provinces')
      .select('id')
      .ilike('name', name)
      .single();

    if (existingProvince) {
      return res.status(400).json({ 
        error: 'Province name already exists' 
      });
    }

    // Check if province code already exists
    const { data: existingCode } = await supabaseAdmin
      .from('provinces')
      .select('id')
      .eq('code', code.toUpperCase())
      .single();

    if (existingCode) {
      return res.status(400).json({ 
        error: 'Province code already exists' 
      });
    }

    // Create new province
    const { data: newProvince, error: insertError } = await supabaseAdmin
      .from('provinces')
      .insert([{
        name: name.trim(),
        code: code.toUpperCase(),
        is_active
      }])
      .select();

    if (insertError) {
      console.error('Error creating province:', insertError);
      return res.status(500).json({ 
        error: 'Failed to create province',
        details: insertError.message 
      });
    }

    res.status(201).json({
      message: 'Province created successfully',
      data: newProvince[0]
    });
  } catch (error) {
    console.error('Error creating province:', error);
    res.status(500).json({ 
      error: 'Failed to create province',
      details: error.message 
    });
  }
};

/**
 * Get all provinces
 * GET /provinces
 * @query {string} search - Filter by name or code
 * @query {boolean} active_only - Show only active provinces
 */
exports.getAllProvinces = async (req, res) => {
  try {
    const { search, active_only } = req.query;

    let query = supabaseAdmin
      .from('provinces')
      .select(`
        id,
        name,
        code,
        is_active,
        created_at,
        cities(count)
      `)
      .order('name', { ascending: true });

    // Filter by active status if requested
    if (active_only === 'true') {
      query = query.eq('is_active', true);
    }

    const { data: provinces, error } = await query;

    if (error) {
      console.error('Error retrieving provinces:', error);
      return res.status(500).json({ 
        error: 'Failed to retrieve provinces',
        details: error.message 
      });
    }

    // Filter by search term if provided
    let filteredProvinces = provinces;
    if (search && search.trim() !== '') {
      const searchLower = search.toLowerCase();
      filteredProvinces = provinces.filter(prov => 
        prov.name.toLowerCase().includes(searchLower) ||
        prov.code.toLowerCase().includes(searchLower)
      );
    }

    // Map city counts
    const provincesWithCounts = filteredProvinces.map(prov => ({
      ...prov,
      city_count: prov.cities?.[0]?.count || 0
    }));

    res.status(200).json({
      message: 'Provinces retrieved successfully',
      count: provincesWithCounts.length,
      data: provincesWithCounts
    });
  } catch (error) {
    console.error('Error retrieving provinces:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve provinces',
      details: error.message 
    });
  }
};

/**
 * Get province by ID with cities
 * GET /provinces/:id
 * @query {number} limit - Pagination limit for cities (default: 50)
 * @query {number} offset - Pagination offset (default: 0)
 */
exports.getProvinceById = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    if (!id) {
      return res.status(400).json({ 
        error: 'Province ID is required' 
      });
    }

    // Get province details
    const { data: province, error: provinceError } = await supabaseAdmin
      .from('provinces')
      .select(`
        *,
        cities(count)
      `)
      .eq('id', id)
      .single();

    if (provinceError) {
      if (provinceError.code === 'PGRST116') {
        return res.status(404).json({ 
          error: 'Province not found' 
        });
      }
      console.error('Error retrieving province:', provinceError);
      return res.status(500).json({ 
        error: 'Failed to retrieve province',
        details: provinceError.message 
      });
    }

    // Get cities with pagination
    const { data: cities, error: citiesError } = await supabaseAdmin
      .from('cities')
      .select('id, name, province_id, is_active, created_at')
      .eq('province_id', id)
      .range(offset, offset + parseInt(limit) - 1)
      .order('name', { ascending: true });

    if (citiesError) {
      console.error('Error retrieving cities:', citiesError);
      return res.status(500).json({ 
        error: 'Failed to retrieve cities',
        details: citiesError.message 
      });
    }

    res.status(200).json({
      message: 'Province retrieved successfully',
      data: {
        ...province,
        city_count: province.cities?.[0]?.count || 0,
        cities
      }
    });
  } catch (error) {
    console.error('Error retrieving province:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve province',
      details: error.message 
    });
  }
};

/**
 * Get cities by province
 * GET /provinces/:id/cities
 * @query {number} limit - Pagination limit (default: 50)
 * @query {number} offset - Pagination offset (default: 0)
 * @query {boolean} active_only - Show only active cities
 */
exports.getCitiesByProvince = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0, active_only } = req.query;

    if (!id) {
      return res.status(400).json({ 
        error: 'Province ID is required' 
      });
    }

    // Verify province exists
    const { data: province, error: provinceError } = await supabaseAdmin
      .from('provinces')
      .select('id, name')
      .eq('id', id)
      .single();

    if (provinceError || !province) {
      return res.status(404).json({ 
        error: 'Province not found' 
      });
    }

    // Get cities
    let query = supabaseAdmin
      .from('cities')
      .select('id, name, province_id, is_active, created_at', { count: 'exact' })
      .eq('province_id', id)
      .range(offset, offset + parseInt(limit) - 1)
      .order('name', { ascending: true });

    if (active_only === 'true') {
      query = query.eq('is_active', true);
    }

    const { data: cities, error: citiesError, count } = await query;

    if (citiesError) {
      console.error('Error retrieving cities:', citiesError);
      return res.status(500).json({ 
        error: 'Failed to retrieve cities',
        details: citiesError.message 
      });
    }

    res.status(200).json({
      message: 'Cities retrieved successfully',
      province: {
        id: province.id,
        name: province.name
      },
      total_count: count,
      cities_count: cities.length,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: count
      },
      data: cities
    });
  } catch (error) {
    console.error('Error retrieving cities:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve cities',
      details: error.message 
    });
  }
};

/**
 * Update province
 * PATCH /provinces/:id
 */
exports.updateProvince = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, is_active } = req.body;

    if (!id) {
      return res.status(400).json({ 
        error: 'Province ID is required' 
      });
    }

    // Validation - at least one field must be provided
    if (name === undefined && code === undefined && is_active === undefined) {
      return res.status(400).json({ 
        error: 'At least one field (name, code, or is_active) must be provided' 
      });
    }

    // Check if province exists
    const { data: existingProvince, error: checkError } = await supabaseAdmin
      .from('provinces')
      .select('id')
      .eq('id', id)
      .single();

    if (checkError || !existingProvince) {
      return res.status(404).json({ 
        error: 'Province not found' 
      });
    }

    // Check if new name already exists (if name is being updated)
    if (name) {
      const { data: duplicateName } = await supabaseAdmin
        .from('provinces')
        .select('id')
        .ilike('name', name)
        .neq('id', id)
        .single();

      if (duplicateName) {
        return res.status(400).json({ 
          error: 'Province name already exists' 
        });
      }
    }

    // Check if new code already exists (if code is being updated)
    if (code) {
      if (code.length > 3) {
        return res.status(400).json({ 
          error: 'Province code must be max 3 characters' 
        });
      }

      const { data: duplicateCode } = await supabaseAdmin
        .from('provinces')
        .select('id')
        .eq('code', code.toUpperCase())
        .neq('id', id)
        .single();

      if (duplicateCode) {
        return res.status(400).json({ 
          error: 'Province code already exists' 
        });
      }
    }

    // Build update object
    const updateObj = {};
    if (name !== undefined) updateObj.name = name.trim();
    if (code !== undefined) updateObj.code = code.toUpperCase();
    if (is_active !== undefined) updateObj.is_active = is_active;

    // Update province
    const { data: updatedProvince, error: updateError } = await supabaseAdmin
      .from('provinces')
      .update(updateObj)
      .eq('id', id)
      .select();

    if (updateError) {
      console.error('Error updating province:', updateError);
      return res.status(500).json({ 
        error: 'Failed to update province',
        details: updateError.message 
      });
    }

    res.status(200).json({
      message: 'Province updated successfully',
      data: updatedProvince[0]
    });
  } catch (error) {
    console.error('Error updating province:', error);
    res.status(500).json({ 
      error: 'Failed to update province',
      details: error.message 
    });
  }
};

/**
 * Delete province
 * DELETE /provinces/:id
 * Note: Will fail if province has linked cities (FK constraint)
 */
exports.deleteProvince = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ 
        error: 'Province ID is required' 
      });
    }

    // Check if province exists
    const { data: existingProvince, error: checkError } = await supabaseAdmin
      .from('provinces')
      .select('*')
      .eq('id', id)
      .single();

    if (checkError || !existingProvince) {
      return res.status(404).json({ 
        error: 'Province not found' 
      });
    }

    // Check if province has any linked cities
    const { data: linkedCities } = await supabaseAdmin
      .from('cities')
      .select('id', { count: 'exact', head: true })
      .eq('province_id', id);

    if (linkedCities && linkedCities.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete province with linked cities',
        details: `This province has ${linkedCities.length} linked cities. Delete or reassign cities first.`
      });
    }

    // Delete province
    const { error: deleteError } = await supabaseAdmin
      .from('provinces')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting province:', deleteError);
      return res.status(500).json({ 
        error: 'Failed to delete province',
        details: deleteError.message 
      });
    }

    res.status(200).json({
      message: 'Province deleted successfully',
      data: {
        id: existingProvince.id,
        name: existingProvince.name,
        code: existingProvince.code
      }
    });
  } catch (error) {
    console.error('Error deleting province:', error);
    res.status(500).json({ 
      error: 'Failed to delete province',
      details: error.message 
    });
  }
};
