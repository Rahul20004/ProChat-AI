const express = require('express');
const {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  submitFeedback,
} = require('../controllers/notification.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/', protect, getNotifications);
router.put('/read-all', protect, markAllNotificationsRead);
router.put('/:id/read', protect, markNotificationRead);
router.put('/:id/dismiss', protect, dismissNotification);
router.post('/:id/feedback', protect, submitFeedback);

module.exports = router;
