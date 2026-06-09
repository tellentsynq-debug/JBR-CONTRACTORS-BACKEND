const express = require('express');
const router = express.Router();
const candidateController = require('../controllers/candidateController');
const securityMiddleware = require('../middleware/securityMiddleware');

// Apply origin checking middleware to all candidate routes
router.use(securityMiddleware.checkOrigin);

// Public routes (no auth required)
// Send OTP to candidate email
router.post('/send-otp', candidateController.sendOTP);

// Verify OTP
router.post('/verify-otp', candidateController.verifyOTP);

// Register candidate (after OTP verification)
router.post('/register', candidateController.registerCandidate);

// Get verification status
router.get('/verification-status/:email', candidateController.getVerificationStatus);

module.exports = router;
