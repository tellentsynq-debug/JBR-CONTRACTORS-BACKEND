const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');

// Create job
router.post('/', jobController.createJob);

// Debug route to check server-side Supabase config (safe)
router.get('/debug', jobController.debug);

// List jobs
router.get('/', jobController.getAllJobs);

// Get job by ID
router.get('/:id', jobController.getJobById);

// Update job
router.patch('/:id', jobController.updateJob);

// Delete job
router.delete('/:id', jobController.deleteJob);

module.exports = router;
