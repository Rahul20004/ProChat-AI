const express = require('express');
const { accessConversation, getConversations } = require('../controllers/conversation.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.route('/')
  .post(protect, accessConversation)
  .get(protect, getConversations);

module.exports = router;
