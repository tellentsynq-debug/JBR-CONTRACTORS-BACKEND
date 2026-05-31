const pool = require('../config/database');

// Create campaign
exports.createCampaign = async (req, res) => {
  try {
    const { name, startDate, endDate } = req.body;

    // Validation
    if (!name || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Campaign name, start date, and end date are required'
      });
    }

    const status = 'active'; // Default status

    const connection = await pool.getConnection();
    
    const [result] = await connection.query(
      'INSERT INTO campaigns (name, start_date, end_date, status) VALUES (?, ?, ?, ?)',
      [name, startDate, endDate, status]
    );
    connection.release();

    res.status(201).json({
      id: result.insertId,
      name,
      startDate,
      endDate,
      status,
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
    const connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT * FROM campaigns ORDER BY created_at DESC');
    connection.release();
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Get campaign by ID
exports.getCampaignById = async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT * FROM campaigns WHERE id = ?', [id]);
    connection.release();

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Update campaign
exports.updateCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, startDate, endDate, status } = req.body;

    const connection = await pool.getConnection();

    await connection.query(
      'UPDATE campaigns SET name = ?, start_date = ?, end_date = ?, status = ? WHERE id = ?',
      [name, startDate, endDate, status, id]
    );
    connection.release();

    res.json({
      id,
      name,
      startDate,
      endDate,
      status,
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
    const connection = await pool.getConnection();
    const [result] = await connection.query('DELETE FROM campaigns WHERE id = ?', [id]);
    connection.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
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
    const connection = await pool.getConnection();
    
    // Check current status
    const [rows] = await connection.query('SELECT status FROM campaigns WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (rows[0].status === 'active') {
      connection.release();
      return res.status(400).json({ 
        error: 'Campaign is already active',
        status: 'active'
      });
    }

    const [result] = await connection.query(
      'UPDATE campaigns SET status = ? WHERE id = ?',
      ['active', id]
    );
    connection.release();

    res.json({
      id,
      status: 'active',
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
    const connection = await pool.getConnection();
    
    // Check current status
    const [rows] = await connection.query('SELECT status FROM campaigns WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (rows[0].status === 'inactive') {
      connection.release();
      return res.status(400).json({ 
        error: 'Campaign is already inactive',
        status: 'inactive'
      });
    }

    const [result] = await connection.query(
      'UPDATE campaigns SET status = ? WHERE id = ?',
      ['inactive', id]
    );
    connection.release();

    res.json({
      id,
      status: 'inactive',
      message: 'Campaign deactivated successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};
