const express = require('express');
const {
  chatDirect,
  summarizeChat,
  getLatestSummary,
  translateText,
  getSmartReplies,
} = require('../controllers/ai.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/chat', protect, chatDirect);
router.post('/summary', protect, summarizeChat);
router.get('/summary/:conversationId', protect, getLatestSummary);
router.post('/translate', protect, translateText);
router.get('/smart-replies/:conversationId', protect, getSmartReplies);

module.exports = router;
