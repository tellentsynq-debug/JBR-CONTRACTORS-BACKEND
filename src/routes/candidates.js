const express = require('express');
const router = express.Router();
const candidateController = require('../controllers/candidateController');
const securityMiddleware = require('../middleware/securityMiddleware');
const { verifyJWT } = require('../middleware/jwtMiddleware');

// Apply origin checking middleware to all candidate routes
router.use(securityMiddleware.checkOrigin);

// Public routes (no auth required)
// Send OTP to candidate email
router.post('/send-otp', candidateController.sendOTP);

// Verify OTP
router.post('/verify-otp', candidateController.verifyOTP);

// Register candidate (requires JWT token from OTP verification)
router.post('/register', verifyJWT, candidateController.registerCandidate);

// Get verification status
router.get('/verification-status/:email', candidateController.getVerificationStatus);

module.exports = router;
