const express = require('express');
const provinceController = require('../controllers/provinceController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Public Routes - Get provinces and details
router.get('/', provinceController.getAllProvinces);
router.get('/:id', provinceController.getProvinceById);
router.get('/:id/cities', provinceController.getCitiesByProvince);

// Protected Routes - Require JWT authentication
router.post('/', authMiddleware.verifyToken, provinceController.createProvince);
router.patch('/:id', authMiddleware.verifyToken, provinceController.updateProvince);
router.delete('/:id', authMiddleware.verifyToken, provinceController.deleteProvince);

module.exports = router;
