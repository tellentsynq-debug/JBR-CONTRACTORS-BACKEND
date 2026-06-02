const express = require('express');
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Public Route
router.post('/login', adminController.adminLogin);

// Protected Routes (only Super Admin can access)
router.post('/', authMiddleware.verifyToken, adminController.createAdmin);
router.get('/', authMiddleware.verifyToken, adminController.getAllAdmins);
router.get('/:id', authMiddleware.verifyToken, adminController.getAdminById);
router.put('/:id', authMiddleware.verifyToken, adminController.updateAdmin);
router.delete('/:id', authMiddleware.verifyToken, adminController.deleteAdmin);

module.exports = router;
