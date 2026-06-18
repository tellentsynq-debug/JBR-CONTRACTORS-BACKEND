const supabaseModule = require('../config/database');
const supabaseAdmin = supabaseModule.admin;
const EmployeeChatService = require('../services/employeeChatService');

// Create or start a chat session
exports.startChatSession = async (req, res) => {
  try {
    const { employee_id, mobile_number, campaign_id, job_category_id } = req.body;

    if (!employee_id || !mobile_number) {
      return res.status(400).json({ error: 'Employee ID and mobile number are required' });
    }

    // Create new session directly without verification
    const session = await EmployeeChatService.createChatSession(
      employee_id,
      mobile_number,
      campaign_id,
      job_category_id
    );

    res.status(201).json({
      message: 'Chat session created successfully',
      data: session
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Send a message
exports.sendMessage = async (req, res) => {
  try {
    const { session_id, employee_id, message_text, message_type = 'text', media_url = null, sender_type = 'employee' } = req.body;

    if (!session_id || !employee_id || !message_text) {
      return res.status(400).json({ error: 'Session ID, employee ID, and message text are required' });
    }

    const message = await EmployeeChatService.sendMessage(
      session_id,
      employee_id,
      message_text,
      message_type,
      media_url,
      sender_type
    );

    res.status(201).json({
      message: 'Message sent successfully',
      data: message
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Get chat session messages
exports.getSessionMessages = async (req, res) => {
  try {
    const { session_id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Mark messages as read
    const { employee_id } = req.query;
    if (employee_id) {
      await EmployeeChatService.markMessagesAsRead(session_id, employee_id);
    }

    const { data, count } = await EmployeeChatService.getSessionMessages(
      session_id,
      parseInt(limit),
      parseInt(offset)
    );

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

// Get employee's active chat sessions
exports.getEmployeeSessions = async (req, res) => {
  try {
    const { employee_id } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const { data, count } = await EmployeeChatService.getEmployeeSessions(
      employee_id,
      parseInt(limit),
      parseInt(offset)
    );

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

// Get unread message count for a session
exports.getUnreadCount = async (req, res) => {
  try {
    const { session_id } = req.params;
    const { employee_id } = req.query;

    if (!employee_id) {
      return res.status(400).json({ error: 'Employee ID is required' });
    }

    const count = await EmployeeChatService.getUnreadCount(session_id, employee_id);

    res.json({
      session_id,
      unread_count: count
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Get total unread messages across all sessions
exports.getTotalUnreadMessages = async (req, res) => {
  try {
    const { employee_id } = req.params;

    const count = await EmployeeChatService.getTotalUnreadMessages(employee_id);

    res.json({
      employee_id,
      total_unread: count
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Close chat session
exports.closeSession = async (req, res) => {
  try {
    const { session_id } = req.params;

    const session = await EmployeeChatService.closeSession(session_id);

    res.json({
      message: 'Chat session closed successfully',
      data: session
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Get employee by mobile number (for chat initialization)
exports.getEmployeeByMobile = async (req, res) => {
  try {
    const { mobile_number } = req.params;

    const employee = await EmployeeChatService.getEmployeeByMobileForChat(mobile_number);

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found or chat not enabled' });
    }

    res.json({
      data: employee
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Archive inactive sessions (admin only)
exports.archiveInactiveSessions = async (req, res) => {
  try {
    const { days_old = 30 } = req.body;

    const result = await EmployeeChatService.archiveInactiveSessions(days_old);

    res.json({
      message: 'Inactive sessions archived successfully',
      ...result
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Get or create chat session for employee
exports.getOrCreateSession = async (req, res) => {
  try {
    const { employee_id } = req.params;
    const { mobile_number, campaign_id, job_category_id } = req.query;

    if (!employee_id) {
      return res.status(400).json({ error: 'Employee ID is required' });
    }

    const result = await EmployeeChatService.getOrCreateChatSession(
      employee_id,
      mobile_number,
      campaign_id,
      job_category_id
    );

    const statusCode = result.created ? 201 : 200;

    res.status(statusCode).json({
      message: result.message,
      data: result.session,
      created: result.created
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};
