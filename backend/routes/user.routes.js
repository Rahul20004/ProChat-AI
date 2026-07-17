const express = require('express');
const { getUsers, getUserById, getAiAssistant } = require('../controllers/user.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/', protect, getUsers);
router.get('/ai-assistant', protect, getAiAssistant);
router.get('/:id', protect, getUserById);

module.exports = router;
