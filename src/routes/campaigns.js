const express = require('express');
const campaignController = require('../controllers/campaignController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Routes with JWT authentication
router.post('/', authMiddleware.verifyToken, campaignController.createCampaign);
router.get('/', authMiddleware.verifyToken, campaignController.getAllCampaigns);
router.get('/:id', authMiddleware.verifyToken, campaignController.getCampaignById);
router.get('/:id/link', authMiddleware.verifyToken, campaignController.getCampaignLink);
router.put('/:id', authMiddleware.verifyToken, campaignController.updateCampaign);
router.delete('/:id', authMiddleware.verifyToken, campaignController.deleteCampaign);
router.patch('/:id/activate', authMiddleware.verifyToken, campaignController.activateCampaign);
router.patch('/:id/deactivate', authMiddleware.verifyToken, campaignController.deactivateCampaign);

module.exports = router;
