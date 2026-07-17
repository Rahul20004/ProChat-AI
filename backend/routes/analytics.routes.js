const express = require('express');
const { getDashboardStats } = require('../controllers/analytics.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/', protect, getDashboardStats);

module.exports = router;
