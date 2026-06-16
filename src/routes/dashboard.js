const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// All dashboard routes require authentication
router.use(authMiddleware.verifyToken);

// GET dashboard stats with all charts
router.get('/', dashboardController.getDashboardStats);

// GET lightweight summary (just KPIs)
router.get('/summary', dashboardController.getDashboardSummary);

module.exports = router;
