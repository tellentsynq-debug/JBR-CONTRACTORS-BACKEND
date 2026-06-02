const express = require('express');
const superAdminController = require('../controllers/superAdminController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Public Routes
router.post('/signup-request', superAdminController.superAdminSignupRequest);
router.post('/verify-otp', superAdminController.superAdminVerifyOTP);
router.post('/login', superAdminController.superAdminLogin);

// Protected Routes (require JWT authentication)
router.get('/', authMiddleware.verifyToken, superAdminController.getAllSuperAdmins);
router.get('/:id', authMiddleware.verifyToken, superAdminController.getSuperAdminById);
router.patch('/:id/status', authMiddleware.verifyToken, superAdminController.updateSuperAdminStatus);

module.exports = router;
