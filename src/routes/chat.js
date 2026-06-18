const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authMiddleware.verifyToken);

// Start a new chat session
router.post('/sessions/start', chatController.startChatSession);

// Get or create chat session for employee
router.get('/sessions/employee/:employee_id', chatController.getOrCreateSession);

// Get employee's active chat sessions
router.get('/sessions/:employee_id', chatController.getEmployeeSessions);

// Get unread messages count for total
router.get('/unread/:employee_id/total', chatController.getTotalUnreadMessages);

// Send a message in chat session
router.post('/messages/send', chatController.sendMessage);

// Get messages from a session
router.get('/messages/:session_id', chatController.getSessionMessages);

// Get unread count for specific session
router.get('/messages/:session_id/unread', chatController.getUnreadCount);

// Close chat session
router.patch('/sessions/:session_id/close', chatController.closeSession);

// Get employee by mobile number
router.get('/employee/:mobile_number', chatController.getEmployeeByMobile);

// Archive inactive sessions (admin only)
router.post('/admin/archive-sessions', chatController.archiveInactiveSessions);

module.exports = router;
