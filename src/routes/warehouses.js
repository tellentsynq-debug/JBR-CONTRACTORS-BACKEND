const express = require('express');
const warehouseController = require('../controllers/warehouseController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes
router.get('/', warehouseController.getAllWarehouses);
router.get('/:id', warehouseController.getWarehouseById);

// Protected routes
router.post('/', authMiddleware.verifyToken, warehouseController.createWarehouse);
router.patch('/:id', authMiddleware.verifyToken, warehouseController.updateWarehouse);
router.delete('/:id', authMiddleware.verifyToken, warehouseController.deleteWarehouse);

module.exports = router;
