const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const authMiddleware = require('../middleware/authMiddleware');

// All employee routes require authentication
router.use(authMiddleware.verifyToken);

// Specific routes MUST come before generic :id routes
// GET all employees with filters and pagination
router.get('/', employeeController.getAllEmployees);

// POST create new employee
router.post('/', employeeController.createEmployee);

// GET verification stats
router.get('/stats/verification', employeeController.getVerificationStats);

// GET employees by campaign
router.get('/campaign/:campaign_id', employeeController.getEmployeesByCampaign);

// PATCH verify employee
router.patch('/:id/verify', employeeController.verifyEmployee);

// PATCH reject employee
router.patch('/:id/reject', employeeController.rejectEmployee);

// PUT update employee
router.put('/:id', employeeController.updateEmployee);

// DELETE employee (soft delete)
router.delete('/:id', employeeController.deleteEmployee);

// GET employee by ID (must be last)
router.get('/:id', employeeController.getEmployeeById);

module.exports = router;
