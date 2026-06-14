const supabase = require('../config/database');
const supabaseAdmin = supabase.admin;

/**
 * Create a new city
 * POST /cities
 * @body {string} name - City name (required)
 * @body {string} province_id - Parent province UUID (required)
 * @body {boolean} is_active - Active status (default: true)
 */
exports.createCity = async (req, res) => {
  try {
    const { name, province_id, is_active = true } = req.body;

    // Validation
    if (!name || name.trim() === '') {
      return res.status(400).json({ 
        error: 'City name is required' 
      });
    }

    if (!province_id) {
      return res.status(400).json({ 
        error: 'Province ID is required' 
      });
    }

    // Verify province exists
    const { data: province, error: provinceError } = await supabaseAdmin
      .from('provinces')
      .select('id, name')
      .eq('id', province_id)
      .single();

    if (provinceError || !province) {
      return res.status(400).json({ 
        error: 'Invalid province ID' 
      });
    }

    // Check if city name already exists for this province (case-insensitive)
    const { data: existingCity } = await supabaseAdmin
      .from('cities')
      .select('id')
      .eq('province_id', province_id)
      .ilike('name', name)
      .single();

    if (existingCity) {
      return res.status(400).json({ 
        error: 'City name already exists for this province' 
      });
    }

    // Create new city
    const { data: newCity, error: insertError } = await supabaseAdmin
      .from('cities')
      .insert([{
        name: name.trim(),
        province_id,
        is_active
      }])
      .select();

    if (insertError) {
      console.error('Error creating city:', insertError);
      return res.status(500).json({ 
        error: 'Failed to create city',
        details: insertError.message 
      });
    }

    res.status(201).json({
      message: 'City created successfully',
      data: {
        ...newCity[0],
        province_name: province.name
      }
    });
  } catch (error) {
    console.error('Error creating city:', error);
    res.status(500).json({ 
      error: 'Failed to create city',
      details: error.message 
    });
  }
};

/**
 * Get all cities
 * GET /cities
 * @query {string} search - Filter by city name or province name
 * @query {string} province_id - Filter by specific province
 * @query {boolean} active_only - Show only active cities
 */
exports.getAllCities = async (req, res) => {
  try {
    const { search, province_id, active_only } = req.query;

    let query = supabaseAdmin
      .from('cities')
      .select(`
        id,
        name,
        province_id,
        is_active,
        created_at,
        updated_at,
        provinces(id, name, code),
        candidates(count)
      `)
      .order('name', { ascending: true });

    // Filter by province if provided
    if (province_id) {
      query = query.eq('province_id', province_id);
    }

    // Filter by active status if requested
    if (active_only === 'true') {
      query = query.eq('is_active', true);
    }

    const { data: cities, error } = await query;

    if (error) {
      console.error('Error retrieving cities:', error);
      return res.status(500).json({ 
        error: 'Failed to retrieve cities',
        details: error.message 
      });
    }

    // Filter by search term if provided
    let filteredCities = cities;
    if (search && search.trim() !== '') {
      const searchLower = search.toLowerCase();
      filteredCities = cities.filter(city => 
        city.name.toLowerCase().includes(searchLower) ||
        (city.provinces && city.provinces.name.toLowerCase().includes(searchLower))
      );
    }

    // Map candidate counts
    const citiesWithCounts = filteredCities.map(city => ({
      ...city,
      candidate_count: city.candidates?.[0]?.count || 0
    }));

    res.status(200).json({
      message: 'Cities retrieved successfully',
      count: citiesWithCounts.length,
      data: citiesWithCounts
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
 * Get city by ID
 * GET /cities/:id
 */
exports.getCityById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ 
        error: 'City ID is required' 
      });
    }

    const { data: city, error } = await supabaseAdmin
      .from('cities')
      .select(`
        *,
        provinces(id, name, code),
        candidates(count)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ 
          error: 'City not found' 
        });
      }
      console.error('Error retrieving city:', error);
      return res.status(500).json({ 
        error: 'Failed to retrieve city',
        details: error.message 
      });
    }

    res.status(200).json({
      message: 'City retrieved successfully',
      data: {
        ...city,
        candidate_count: city.candidates?.[0]?.count || 0
      }
    });
  } catch (error) {
    console.error('Error retrieving city:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve city',
      details: error.message 
    });
  }
};

/**
 * Get cities by province
 * GET /cities/province/:provinceId
 * @query {boolean} active_only - Show only active cities
 */
exports.getCitiesByProvince = async (req, res) => {
  try {
    const { provinceId } = req.params;
    const { active_only } = req.query;

    if (!provinceId) {
      return res.status(400).json({ 
        error: 'Province ID is required' 
      });
    }

    // Verify province exists
    const { data: province, error: provinceError } = await supabaseAdmin
      .from('provinces')
      .select('id, name')
      .eq('id', provinceId)
      .single();

    if (provinceError || !province) {
      return res.status(404).json({ 
        error: 'Province not found' 
      });
    }

    let query = supabaseAdmin
      .from('cities')
      .select(`
        id,
        name,
        province_id,
        is_active,
        created_at,
        candidates(count)
      `)
      .eq('province_id', provinceId)
      .order('name', { ascending: true });

    if (active_only === 'true') {
      query = query.eq('is_active', true);
    }

    const { data: cities, error } = await query;

    if (error) {
      console.error('Error retrieving cities:', error);
      return res.status(500).json({ 
        error: 'Failed to retrieve cities',
        details: error.message 
      });
    }

    const citiesWithCounts = cities.map(city => ({
      ...city,
      candidate_count: city.candidates?.[0]?.count || 0
    }));

    res.status(200).json({
      message: 'Cities retrieved successfully',
      province: {
        id: province.id,
        name: province.name
      },
      count: citiesWithCounts.length,
      data: citiesWithCounts
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
 * Update city
 * PATCH /cities/:id
 */
exports.updateCity = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, province_id, is_active } = req.body;

    if (!id) {
      return res.status(400).json({ 
        error: 'City ID is required' 
      });
    }

    // Validation - at least one field must be provided
    if (name === undefined && province_id === undefined && is_active === undefined) {
      return res.status(400).json({ 
        error: 'At least one field (name, province_id, or is_active) must be provided' 
      });
    }

    // Check if city exists
    const { data: existingCity, error: checkError } = await supabaseAdmin
      .from('cities')
      .select('*')
      .eq('id', id)
      .single();

    if (checkError || !existingCity) {
      return res.status(404).json({ 
        error: 'City not found' 
      });
    }

    // If province_id is provided, verify it exists
    if (province_id) {
      const { data: province, error: provinceError } = await supabaseAdmin
        .from('provinces')
        .select('id')
        .eq('id', province_id)
        .single();

      if (provinceError || !province) {
        return res.status(400).json({ 
          error: 'Invalid province ID' 
        });
      }
    }

    // Check if new city name already exists for the province
    if (name) {
      const { data: duplicateName } = await supabaseAdmin
        .from('cities')
        .select('id')
        .eq('province_id', province_id || existingCity.province_id)
        .ilike('name', name)
        .neq('id', id)
        .single();

      if (duplicateName) {
        return res.status(400).json({ 
          error: 'City name already exists for this province' 
        });
      }
    }

    // Build update object
    const updateObj = {};
    if (name !== undefined) updateObj.name = name.trim();
    if (province_id !== undefined) updateObj.province_id = province_id;
    if (is_active !== undefined) updateObj.is_active = is_active;

    // Update city
    const { data: updatedCity, error: updateError } = await supabaseAdmin
      .from('cities')
      .update(updateObj)
      .eq('id', id)
      .select(`
        *,
        provinces(id, name, code)
      `);

    if (updateError) {
      console.error('Error updating city:', updateError);
      return res.status(500).json({ 
        error: 'Failed to update city',
        details: updateError.message 
      });
    }

    res.status(200).json({
      message: 'City updated successfully',
      data: updatedCity[0]
    });
  } catch (error) {
    console.error('Error updating city:', error);
    res.status(500).json({ 
      error: 'Failed to update city',
      details: error.message 
    });
  }
};

/**
 * Delete city
 * DELETE /cities/:id
 * Note: Will fail if city has linked candidates (FK constraint)
 */
exports.deleteCity = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ 
        error: 'City ID is required' 
      });
    }

    // Check if city exists
    const { data: existingCity, error: checkError } = await supabaseAdmin
      .from('cities')
      .select('*')
      .eq('id', id)
      .single();

    if (checkError || !existingCity) {
      return res.status(404).json({ 
        error: 'City not found' 
      });
    }

    // Check if city has any linked candidates
    const { data: linkedCandidates } = await supabaseAdmin
      .from('candidates')
      .select('id', { count: 'exact', head: true })
      .eq('city_id', id);

    if (linkedCandidates && linkedCandidates.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete city with linked candidates',
        details: `This city has ${linkedCandidates.length} linked candidates. Delete or reassign candidates first.`
      });
    }

    // Delete city
    const { error: deleteError } = await supabaseAdmin
      .from('cities')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting city:', deleteError);
      return res.status(500).json({ 
        error: 'Failed to delete city',
        details: deleteError.message 
      });
    }

    res.status(200).json({
      message: 'City deleted successfully',
      data: {
        id: existingCity.id,
        name: existingCity.name,
        province_id: existingCity.province_id
      }
    });
  } catch (error) {
    console.error('Error deleting city:', error);
    res.status(500).json({ 
      error: 'Failed to delete city',
      details: error.message 
    });
  }
};
