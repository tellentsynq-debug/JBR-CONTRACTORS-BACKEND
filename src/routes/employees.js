const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const authMiddleware = require('../middleware/authMiddleware');

// All employee routes require authentication
router.use(authMiddleware.verifyToken);

// GET all employees with filters and pagination
router.get('/', employeeController.getAllEmployees);

// GET employee by ID
router.get('/:id', employeeController.getEmployeeById);

// POST create new employee
router.post('/', employeeController.createEmployee);

// PUT update employee
router.put('/:id', employeeController.updateEmployee);

// DELETE employee (soft delete)
router.delete('/:id', employeeController.deleteEmployee);

// PATCH verify employee
router.patch('/:id/verify', employeeController.verifyEmployee);

// PATCH reject employee
router.patch('/:id/reject', employeeController.rejectEmployee);

// GET employees by campaign
router.get('/campaign/:campaign_id', employeeController.getEmployeesByCampaign);

// GET verification stats
router.get('/stats/verification', employeeController.getVerificationStats);

module.exports = router;
