const User = require('../models/User');
const Message = require('../models/Message');
const Analytics = require('../models/Analytics');

// @desc    Get dashboard analytics numbers
// @route   GET /api/analytics
// @access  Private
const getDashboardStats = async (req, res) => {
  try {
    // 1. Total Registered Users (excluding AI Bot itself)
    const totalUsers = await User.countDocuments({ isAi: false });

    // 2. Total Messages sent
    const totalMessages = await Message.countDocuments();

    // 3. AI Assistant Conversations/Replies
    const aiUser = await User.findOne({ isAi: true });
    let totalAiMessages = 0;
    if (aiUser) {
      totalAiMessages = await Message.countDocuments({ sender: aiUser._id });
    }

    // 4. Toxic Messages Blocked
    const analyticsRecords = await Analytics.find().sort({ date: 1 });
    const toxicMessagesBlocked = analyticsRecords.reduce(
      (sum, record) => sum + (record.toxicBlockedCount || 0),
      0
    );

    // 5. Daily Activity (last 10 days for graph charts)
    const dailyActivity = analyticsRecords.slice(-10).map((record) => ({
      date: record.date,
      messages: record.messagesCount || 0,
      toxicBlocked: record.toxicBlockedCount || 0,
      aiQueries: record.aiConversationsCount || 0,
      newUsers: record.newUsersCount || 0,
    }));

    res.json({
      success: true,
      data: {
        totalUsers,
        totalMessages,
        totalAiMessages,
        toxicMessagesBlocked,
        dailyActivity,
      },
    });
  } catch (error) {
    console.error('Get Analytics Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getDashboardStats,
};
