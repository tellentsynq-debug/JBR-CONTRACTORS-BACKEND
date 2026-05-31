const express = require('express');
const campaignController = require('../controllers/campaignController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Routes with JWT authentication
router.post('/', authMiddleware.verifyToken, campaignController.createCampaign);
router.get('/', authMiddleware.verifyToken, campaignController.getAllCampaigns);
router.get('/:id', authMiddleware.verifyToken, campaignController.getCampaignById);
router.put('/:id', authMiddleware.verifyToken, campaignController.updateCampaign);
router.delete('/:id', authMiddleware.verifyToken, campaignController.deleteCampaign);

module.exports = router;
