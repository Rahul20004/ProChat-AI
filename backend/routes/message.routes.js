const express = require('express');
const {
  sendMessage,
  getMessages,
  deleteMessage,
  togglePinMessage,
  toggleSaveMessage,
  markRead,
  getUnreadCounts,
} = require('../controllers/message.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.route('/')
  .post(protect, sendMessage);

// IMPORTANT: Static routes must come BEFORE dynamic :param routes
router.get('/unread/counts', protect, getUnreadCounts);
router.put('/read/:conversationId', protect, markRead);
router.put('/pin/:id', protect, togglePinMessage);
router.put('/save/:id', protect, toggleSaveMessage);

router.route('/:conversationId')
  .get(protect, getMessages);

router.route('/:id')
  .delete(protect, deleteMessage);

module.exports = router;
