const User = require('../models/User');
const Message = require('../models/Message');
const Analytics = require('../models/Analytics');
const Notification = require('../models/Notification');

// @desc    Get dashboard analytics numbers including AI toxicity moderation stats
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

    // 4. Historical Analytics Aggregation
    const analyticsRecords = await Analytics.find().sort({ date: 1 });

    // Sum totals from analytics records
    let totalAnalyzed = 0;
    let totalDetected = 0;
    let highSeverity = 0;
    let mediumSeverity = 0;
    let lowSeverity = 0;
    let falsePositives = 0;

    let catAbusive = 0;
    let catThreat = 0;
    let catHate = 0;
    let catHarass = 0;
    let catSexual = 0;
    let catInsult = 0;

    analyticsRecords.forEach((r) => {
      totalAnalyzed += (r.toxicAnalyzedCount || 0);
      totalDetected += (r.toxicDetectedCount || 0) + (r.toxicBlockedCount || 0);
      highSeverity += (r.severityHighCount || 0);
      mediumSeverity += (r.severityMediumCount || 0);
      lowSeverity += (r.severityLowCount || 0);
      falsePositives += (r.falsePositiveFeedbackCount || 0);

      catAbusive += (r.categoryAbusiveCount || 0);
      catThreat += (r.categoryThreatCount || 0);
      catHate += (r.categoryHateSpeechCount || 0);
      catHarass += (r.categoryHarassmentCount || 0);
      catSexual += (r.categorySexualCount || 0);
      catInsult += (r.categoryInsultCount || 0);
    });

    // Cross-check real counts from Message collection to guarantee consistency
    const realToxicMessagesCount = await Message.countDocuments({ isToxic: true });
    if (realToxicMessagesCount > totalDetected) {
      totalDetected = realToxicMessagesCount;
    }
    if (totalMessages > totalAnalyzed) {
      totalAnalyzed = totalMessages;
    }

    // False positives from Notification collection
    const realFalsePositives = await Notification.countDocuments({ feedback: 'false_positive' });
    falsePositives = Math.max(falsePositives, realFalsePositives);

    // Categories breakdown
    const categoriesBreakdown = [
      { name: 'Abusive Language', count: catAbusive },
      { name: 'Threats / Violence', count: catThreat },
      { name: 'Hate Speech', count: catHate },
      { name: 'Harassment & Bullying', count: catHarass },
      { name: 'Sexual Harassment', count: catSexual },
      { name: 'Insults', count: catInsult },
    ];

    // Severity breakdown
    const severityBreakdown = {
      high: highSeverity,
      medium: mediumSeverity,
      low: lowSeverity,
    };

    // Calculate detection rate
    const detectionRate = totalAnalyzed > 0
      ? ((totalDetected / totalAnalyzed) * 100).toFixed(1)
      : '0.0';

    // 5. Daily Activity (last 10 days for graph charts)
    const dailyActivity = analyticsRecords.slice(-10).map((record) => ({
      date: record.date,
      messages: record.messagesCount || 0,
      toxicDetected: (record.toxicDetectedCount || 0) + (record.toxicBlockedCount || 0),
      aiQueries: record.aiConversationsCount || 0,
      newUsers: record.newUsersCount || 0,
    }));

    res.json({
      success: true,
      data: {
        totalUsers,
        totalMessages,
        totalAiMessages,
        toxicMessagesBlocked: totalDetected,
        // Toxicity & Safety Stats
        toxicityStats: {
          totalAnalyzed,
          totalDetected,
          detectionRate: `${detectionRate}%`,
          severityBreakdown,
          categoriesBreakdown,
          falsePositiveCount: falsePositives,
        },
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
