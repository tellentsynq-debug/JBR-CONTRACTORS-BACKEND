const express = require('express');
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes (no auth required)
router.post('/signup', userController.signup);
router.post('/login', userController.login);

// Protected routes (auth required)
router.get('/', authMiddleware.verifyToken, userController.getAllUsers);
router.get('/:id', authMiddleware.verifyToken, userController.getUserById);
router.post('/', authMiddleware.verifyToken, userController.createUser);
router.put('/:id', authMiddleware.verifyToken, userController.updateUser);
router.delete('/:id', authMiddleware.verifyToken, userController.deleteUser);

module.exports = router;
