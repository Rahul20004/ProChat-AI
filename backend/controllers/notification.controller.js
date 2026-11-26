const Notification = require('../models/Notification');
const Analytics = require('../models/Analytics');

// @desc    Get all notifications for the authenticated user
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipient: req.user._id,
      dismissed: { $ne: true },
    })
      .populate('sender', 'username avatar isAi')
      .populate('message', 'text conversation createdAt isToxic toxicityCategory toxicitySeverity')
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false,
      dismissed: { $ne: true },
    });

    res.json({
      success: true,
      data: notifications,
      unreadCount,
    });
  } catch (error) {
    console.error('Get Notifications Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark a specific notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        recipient: req.user._id,
      },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, data: notification });
  } catch (error) {
    console.error('Mark Notification Read Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark all notifications as read for current user
// @route   PUT /api/notifications/read-all
// @access  Private
const markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      {
        recipient: req.user._id,
        isRead: false,
      },
      { isRead: true }
    );

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark All Read Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Dismiss a notification
// @route   PUT /api/notifications/:id/dismiss
// @access  Private
const dismissNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        recipient: req.user._id,
      },
      { dismissed: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification dismissed' });
  } catch (error) {
    console.error('Dismiss Notification Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Submit user feedback on toxicity detection (e.g. false positive report)
// @route   POST /api/notifications/:id/feedback
// @access  Private
const submitFeedback = async (req, res) => {
  const { feedback } = req.body;
  if (!['false_positive', 'confirmed'].includes(feedback)) {
    return res.status(400).json({ success: false, message: 'Invalid feedback value. Must be "false_positive" or "confirmed".' });
  }

  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      recipient: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    const previousFeedback = notification.feedback;
    notification.feedback = feedback;
    await notification.save();

    // If marked as false positive and wasn't before, track in analytics
    if (feedback === 'false_positive' && previousFeedback !== 'false_positive') {
      await Analytics.incrementCount('falsePositiveFeedbackCount');
    }

    res.json({
      success: true,
      message: feedback === 'false_positive' ? 'Report received. Thank you for helping improve AI moderation.' : 'Feedback recorded.',
      data: notification,
    });
  } catch (error) {
    console.error('Submit Feedback Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  submitFeedback,
};
