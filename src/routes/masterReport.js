const express = require('express');
const masterReportController = require('../controllers/masterReportController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// All report routes require authentication
router.use(authMiddleware.verifyToken);

// Individual report endpoints
router.get('/industries', masterReportController.getIndustryReport);
router.get('/categories', masterReportController.getCategoryReport);
router.get('/provinces', masterReportController.getProvinceReport);
router.get('/cities', masterReportController.getCityReport);
router.get('/campaigns', masterReportController.getCampaignReport);
router.get('/groups', masterReportController.getGroupReport);

// Summary endpoint (all reports in one call)
router.get('/summary', masterReportController.getMasterReportSummary);

module.exports = router;
