const express = require('express');
const groupController = require('../controllers/groupController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Public Routes - Get groups and details
router.get('/', groupController.getAllGroups);
router.get('/:id', groupController.getGroupById);
router.get('/:id/members', groupController.getGroupMembers);

// Protected Routes - Require JWT authentication
router.post('/', authMiddleware.verifyToken, groupController.createGroup);
router.patch('/:id', authMiddleware.verifyToken, groupController.updateGroup);
router.delete('/:id', authMiddleware.verifyToken, groupController.deleteGroup);

// Bulk member management
router.post('/:id/add-members', authMiddleware.verifyToken, groupController.addCandidatesToGroup);
router.post('/:id/remove-members', authMiddleware.verifyToken, groupController.removeCandidatesFromGroup);

// Get groups for a specific candidate
router.get('/candidate/:candidateId/groups', groupController.getCandidateGroups);

module.exports = router;
