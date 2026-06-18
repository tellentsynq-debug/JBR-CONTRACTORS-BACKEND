const express = require('express');
const router = express.Router();
const employeeJobMobileController = require('../controllers/employeeJobMobileController');
const authMiddleware = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authMiddleware.verifyToken);

// Register employee mobile number for chat
router.post('/register', employeeJobMobileController.registerMobileNumber);

// Send OTP for verification
router.post('/send-otp', employeeJobMobileController.sendOTP);

// Verify OTP and enable chat
router.post('/verify-otp', employeeJobMobileController.verifyOTP);

// Register device token for push notifications
router.post('/register-device-token', employeeJobMobileController.registerDeviceToken);

// Update last active time
router.patch('/update-active', employeeJobMobileController.updateLastActive);

// Get chat statistics (admin only)
router.get('/stats/chat-statistics', employeeJobMobileController.getChatStatistics);

// Get all active employees by job category for chat
router.get('/job-category/:job_category_id/active', employeeJobMobileController.getActiveEmployeesByJobCategory);

// Get employee mobile mappings
router.get('/:employee_id', employeeJobMobileController.getEmployeeMappings);

// Deactivate mobile mapping
router.delete('/:employee_id/:mobile_number', employeeJobMobileController.deactivateMobileMapping);

module.exports = router;
