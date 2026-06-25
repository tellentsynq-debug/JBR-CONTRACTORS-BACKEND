const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');

// Create job
router.post('/', jobController.createJob);

// List jobs
router.get('/', jobController.getAllJobs);

module.exports = router;
