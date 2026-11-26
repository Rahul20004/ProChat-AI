const express = require('express');
const { getDashboardStats, getTopEngagementStats } = require('../controllers/analytics.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/', protect, getDashboardStats);
router.get('/engagement', protect, getTopEngagementStats);

module.exports = router;
