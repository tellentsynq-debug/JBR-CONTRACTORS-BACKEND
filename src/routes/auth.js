const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// Public routes (no auth required)
router.post('/signin', authController.signIn);
router.post('/signup', authController.signUp);
router.get('/verify-email', authController.verifyEmail);
router.post('/refresh-token', authController.refreshToken);
router.post('/reset-password', authController.resetPasswordRequest);

// Protected routes (auth required)
router.get('/me', authMiddleware.verifyToken, authController.getCurrentUser);
router.post('/signout', authMiddleware.verifyToken, authController.signOut);
router.post('/update-password', authMiddleware.verifyToken, authController.updatePassword);

module.exports = router;
