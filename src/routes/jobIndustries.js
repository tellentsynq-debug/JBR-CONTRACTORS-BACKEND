const express = require('express');
const jobIndustryController = require('../controllers/jobIndustryController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Public Routes
router.get('/', jobIndustryController.getAllJobIndustries);
router.get('/:id', jobIndustryController.getJobIndustryById);

// Protected Routes (require JWT authentication)
router.post('/', authMiddleware.verifyToken, jobIndustryController.createJobIndustry);
router.patch('/:id', authMiddleware.verifyToken, jobIndustryController.updateJobIndustry);
router.delete('/:id', authMiddleware.verifyToken, jobIndustryController.deleteJobIndustry);

module.exports = router;
