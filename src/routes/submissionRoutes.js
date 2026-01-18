const express = require('express');
const router = express.Router();
const { submitCode } = require('../controllers/submissionController');

// POST /api/submissions
router.post('/', submitCode);

module.exports = router;
