const express = require('express');
const { auth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createJobValidators } = require('../middleware/validators');
const job = require('../controllers/jobController');

const router = express.Router();

router.post('/estimate', auth, job.estimateJob);
router.post('/', auth, createJobValidators, validate, job.createJob);
router.get('/my', auth, job.getMyJobs);
router.get('/available', auth, job.getAvailableJobs);
router.get('/intercity-matches', auth, job.getMatchingIntercityJobs);
router.get('/:id/applications', auth, job.getJobApplications);
router.post('/:id/apply', auth, job.applyForJob);
router.post('/:id/select-driver', auth, job.selectDriver);
router.post('/:id/cancel', auth, job.cancelJob);

module.exports = router;
