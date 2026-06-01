const express = require('express');
const jobCategoryController = require('../controllers/jobCategoryController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Public Routes
router.get('/', jobCategoryController.getAllJobCategories);
router.get('/:id', jobCategoryController.getJobCategoryById);
router.get('/industry/:industryId', jobCategoryController.getCategoriesByIndustryId);

// Protected Routes (require JWT authentication)
router.post('/', authMiddleware.verifyToken, jobCategoryController.createJobCategory);
router.patch('/:id', authMiddleware.verifyToken, jobCategoryController.updateJobCategory);
router.delete('/:id', authMiddleware.verifyToken, jobCategoryController.deleteJobCategory);

module.exports = router;
