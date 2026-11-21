const express = require('express');
const { sendMessage, getMessages, markRead, getUnreadCounts } = require('../controllers/message.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.route('/')
  .post(protect, sendMessage);

// IMPORTANT: Static routes must come BEFORE dynamic :param routes
router.get('/unread/counts', protect, getUnreadCounts);
router.put('/read/:conversationId', protect, markRead);

router.route('/:conversationId')
  .get(protect, getMessages);

module.exports = router;
