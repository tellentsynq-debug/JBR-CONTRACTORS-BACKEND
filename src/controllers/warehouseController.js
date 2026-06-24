const supabase = require('../config/database');
const supabaseAdmin = supabase.admin;

/**
 * Create a new warehouse
 * POST /warehouses
 */
exports.createWarehouse = async (req, res) => {
  try {
    const {
      customer_name,
      warehouse_name,
      warehouse_address,
      supervisor_manager,
      is_active = true
    } = req.body;

    if (!customer_name || !customer_name.trim()) {
      return res.status(400).json({ error: 'Customer name is required' });
    }

    if (!warehouse_name || !warehouse_name.trim()) {
      return res.status(400).json({ error: 'Warehouse name is required' });
    }

    if (!warehouse_address || !warehouse_address.trim()) {
      return res.status(400).json({ error: 'Warehouse address is required' });
    }

    if (!supervisor_manager || !supervisor_manager.trim()) {
      return res.status(400).json({ error: 'Supervisor/Manager name is required' });
    }

    const { data: existingWarehouse, error: duplicateError } = await supabaseAdmin
      .from('warehouses')
      .select('id')
      .ilike('customer_name', customer_name.trim())
      .ilike('warehouse_name', warehouse_name.trim())
      .single();

    if (duplicateError && duplicateError.code !== 'PGRST116') {
      console.error('Warehouse duplicate check error:', duplicateError);
      return res.status(500).json({ error: 'Failed to validate warehouse uniqueness', details: duplicateError.message });
    }

    if (existingWarehouse) {
      return res.status(400).json({ error: 'Warehouse already exists for this customer' });
    }

    const { data, error } = await supabaseAdmin
      .from('warehouses')
      .insert([{
        customer_name: customer_name.trim(),
        warehouse_name: warehouse_name.trim(),
        warehouse_address: warehouse_address.trim(),
        supervisor_manager: supervisor_manager.trim(),
        is_active,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select();

    if (error) {
      console.error('Error creating warehouse:', error);
      return res.status(500).json({ error: 'Failed to create warehouse', details: error.message });
    }

    res.status(201).json({
      message: 'Warehouse created successfully',
      data: data[0]
    });
  } catch (error) {
    console.error('Error creating warehouse:', error);
    res.status(500).json({ error: 'Failed to create warehouse', details: error.message });
  }
};

/**
 * Get all warehouses
 * GET /warehouses
 */
exports.getAllWarehouses = async (req, res) => {
  try {
    const { search, active_only } = req.query;

    let query = supabaseAdmin
      .from('warehouses')
      .select('*')
      .order('created_at', { ascending: false });

    if (active_only === 'true') {
      query = query.eq('is_active', true);
    }

    if (search && search.trim() !== '') {
      const searchValue = `%${search.trim()}%`;
      query = query.or(
        `customer_name.ilike.${searchValue},warehouse_name.ilike.${searchValue},warehouse_address.ilike.${searchValue},supervisor_manager.ilike.${searchValue}`
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching warehouses:', error);
      return res.status(500).json({ error: 'Failed to retrieve warehouses', details: error.message });
    }

    res.status(200).json({
      message: 'Warehouses retrieved successfully',
      count: data.length,
      data
    });
  } catch (error) {
    console.error('Error fetching warehouses:', error);
    res.status(500).json({ error: 'Failed to retrieve warehouses', details: error.message });
  }
};

/**
 * Get warehouse by ID
 * GET /warehouses/:id
 */
exports.getWarehouseById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Warehouse ID is required' });
    }

    const { data, error } = await supabaseAdmin
      .from('warehouses')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Warehouse not found' });
      }
      console.error('Error fetching warehouse:', error);
      return res.status(500).json({ error: 'Failed to retrieve warehouse', details: error.message });
    }

    res.status(200).json({ message: 'Warehouse retrieved successfully', data });
  } catch (error) {
    console.error('Error fetching warehouse:', error);
    res.status(500).json({ error: 'Failed to retrieve warehouse', details: error.message });
  }
};

/**
 * Update warehouse
 * PATCH /warehouses/:id
 */
exports.updateWarehouse = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      customer_name,
      warehouse_name,
      warehouse_address,
      supervisor_manager,
      is_active
    } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Warehouse ID is required' });
    }

    if (
      customer_name === undefined &&
      warehouse_name === undefined &&
      warehouse_address === undefined &&
      supervisor_manager === undefined &&
      is_active === undefined
    ) {
      return res.status(400).json({ error: 'At least one field must be provided to update' });
    }

    const { data: existingWarehouse, error: checkError } = await supabaseAdmin
      .from('warehouses')
      .select('*')
      .eq('id', id)
      .single();

    if (checkError || !existingWarehouse) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }

    const updateObj = {};
    if (customer_name !== undefined) updateObj.customer_name = customer_name.trim();
    if (warehouse_name !== undefined) updateObj.warehouse_name = warehouse_name.trim();
    if (warehouse_address !== undefined) updateObj.warehouse_address = warehouse_address.trim();
    if (supervisor_manager !== undefined) updateObj.supervisor_manager = supervisor_manager.trim();
    if (is_active !== undefined) updateObj.is_active = is_active;

    if (updateObj.customer_name || updateObj.warehouse_name) {
      const customerToCheck = updateObj.customer_name || existingWarehouse.customer_name;
      const warehouseToCheck = updateObj.warehouse_name || existingWarehouse.warehouse_name;

      const { data: duplicateWarehouse, error: duplicateError } = await supabaseAdmin
        .from('warehouses')
        .select('id')
        .ilike('customer_name', customerToCheck)
        .ilike('warehouse_name', warehouseToCheck)
        .neq('id', id)
        .single();

      if (duplicateError && duplicateError.code !== 'PGRST116') {
        console.error('Warehouse duplicate check error:', duplicateError);
        return res.status(500).json({ error: 'Failed to validate warehouse uniqueness', details: duplicateError.message });
      }

      if (duplicateWarehouse) {
        return res.status(400).json({ error: 'Another warehouse with the same customer and name already exists' });
      }
    }

    updateObj.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('warehouses')
      .update(updateObj)
      .eq('id', id)
      .select();

    if (error) {
      console.error('Error updating warehouse:', error);
      return res.status(500).json({ error: 'Failed to update warehouse', details: error.message });
    }

    res.status(200).json({ message: 'Warehouse updated successfully', data: data[0] });
  } catch (error) {
    console.error('Error updating warehouse:', error);
    res.status(500).json({ error: 'Failed to update warehouse', details: error.message });
  }
};

/**
 * Delete warehouse
 * DELETE /warehouses/:id
 */
exports.deleteWarehouse = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Warehouse ID is required' });
    }

    const { data: existingWarehouse, error: checkError } = await supabaseAdmin
      .from('warehouses')
      .select('*')
      .eq('id', id)
      .single();

    if (checkError || !existingWarehouse) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }

    const { error } = await supabaseAdmin
      .from('warehouses')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting warehouse:', error);
      return res.status(500).json({ error: 'Failed to delete warehouse', details: error.message });
    }

    res.status(200).json({ message: 'Warehouse deleted successfully', data: { id } });
  } catch (error) {
    console.error('Error deleting warehouse:', error);
    res.status(500).json({ error: 'Failed to delete warehouse', details: error.message });
  }
};
