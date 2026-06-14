const express = require('express');
const cityController = require('../controllers/cityController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Public Routes - Get cities and details
router.get('/', cityController.getAllCities);
router.get('/:id', cityController.getCityById);
router.get('/province/:provinceId/list', cityController.getCitiesByProvince);

// Protected Routes - Require JWT authentication
router.post('/', authMiddleware.verifyToken, cityController.createCity);
router.patch('/:id', authMiddleware.verifyToken, cityController.updateCity);
router.delete('/:id', authMiddleware.verifyToken, cityController.deleteCity);

module.exports = router;
