const express = require('express');
const { sendMessage, getMessages } = require('../controllers/message.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.route('/')
  .post(protect, sendMessage);

router.route('/:conversationId')
  .get(protect, getMessages);

module.exports = router;
