const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Summary = require('../models/Summary');
const Analytics = require('../models/Analytics');
const Notification = require('../models/Notification');

/**
 * Calculate activity-based session chat time with a 5-minute (300s) inactivity timeout.
 * - Single message / new session starts with a baseline interaction time (60 seconds).
 * - Messages sent within 5 minutes accumulate the actual interval duration.
 */
function calculateEngagement(messages) {
  if (!messages || messages.length === 0) {
    return { chatTimeMinutes: 0, formattedTime: '0m' };
  }
  const sorted = [...messages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  let totalSeconds = 60; // 1 min baseline for the initial message

  for (let i = 1; i < sorted.length; i++) {
    const diffSeconds = (new Date(sorted[i].createdAt) - new Date(sorted[i - 1].createdAt)) / 1000;
    if (diffSeconds <= 300) {
      // User active within 5 minutes: accumulate interval (minimum 15s)
      totalSeconds += Math.max(15, diffSeconds);
    } else {
      // New session after inactivity gap: add baseline
      totalSeconds += 60;
    }
  }

  const totalMinutes = Math.max(1, Math.round(totalSeconds / 60));
  let formattedTime = `${totalMinutes}m`;
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    formattedTime = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  return { chatTimeMinutes: totalMinutes, formattedTime };
}

// @desc    Get dashboard analytics numbers including AI safety, feature usage, and chat engagement
// @route   GET /api/analytics
// @access  Private
const getDashboardStats = async (req, res) => {
  try {
    // 1. Total Registered Users (excluding AI Bot itself)
    const totalUsers = await User.countDocuments({ isAi: false });

    // 2. Total Messages sent
    const totalMessages = await Message.countDocuments();

    // 3. AI Assistant Conversations / Replies
    const aiUser = await User.findOne({ isAi: true });
    let totalAiMessages = 0;
    if (aiUser) {
      totalAiMessages = await Message.countDocuments({ sender: aiUser._id });
    }

    // 4. Historical Analytics Aggregation
    const analyticsRecords = await Analytics.find().sort({ date: 1 });

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

    let aiFeatureTransCount = 0;
    let aiFeatureSummCount = 0;
    let aiFeatureSmartCount = 0;
    let aiFeatureToxCount = 0;

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

      aiFeatureTransCount += (r.aiFeatureTranslationCount || 0);
      aiFeatureSummCount += (r.aiFeatureSummarizationCount || 0);
      aiFeatureSmartCount += (r.aiFeatureSmartReplyCount || 0);
      aiFeatureToxCount += (r.aiFeatureToxicityCount || 0);
    });

    // Cross-check real counts from database to guarantee absolute consistency
    const realToxicMessagesCount = await Message.countDocuments({ isToxic: true });
    if (realToxicMessagesCount > totalDetected) {
      totalDetected = realToxicMessagesCount;
    }
    if (totalMessages > totalAnalyzed) {
      totalAnalyzed = totalMessages;
    }

    // Cross-check specific severity from real messages if analytics records are 0
    if (highSeverity === 0 && mediumSeverity === 0 && lowSeverity === 0 && realToxicMessagesCount > 0) {
      const realHigh = await Message.countDocuments({ isToxic: true, toxicitySeverity: 'High' });
      const realMed = await Message.countDocuments({ isToxic: true, toxicitySeverity: 'Medium' });
      const realLow = await Message.countDocuments({ isToxic: true, toxicitySeverity: 'Low' });
      highSeverity = realHigh;
      mediumSeverity = realMed;
      lowSeverity = realLow;
    }

    // False positives from Notification collection
    const realFalsePositives = await Notification.countDocuments({ feedback: 'false_positive' });
    falsePositives = Math.max(falsePositives, realFalsePositives);

    // Cross-check categories from Message collection if counts are empty
    if (catAbusive + catThreat + catHate + catHarass + catSexual + catInsult === 0 && realToxicMessagesCount > 0) {
      const toxicMsgs = await Message.find({ isToxic: true }).select('toxicityCategory');
      toxicMsgs.forEach((msg) => {
        const cat = (msg.toxicityCategory || '').toLowerCase();
        if (cat.includes('abusive')) catAbusive++;
        else if (cat.includes('threat') || cat.includes('violent')) catThreat++;
        else if (cat.includes('hate')) catHate++;
        else if (cat.includes('harass') || cat.includes('bully')) catHarass++;
        else if (cat.includes('sex')) catSexual++;
        else if (cat.includes('insult')) catInsult++;
        else catAbusive++;
      });
    }

    // 5. Detected Categories Breakdown (All 6 canonical categories)
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

    // 6. AI Feature Usage (Real usage metrics across all 4 AI features)
    // - Translation: count of messages with non-empty translation
    const realTranslationsCount = await Message.countDocuments({
      $or: [
        { 'translations.hi': { $exists: true, $ne: '' } },
        { 'translations.en': { $exists: true, $ne: '' } },
        { 'translations.fr': { $exists: true, $ne: '' } },
        { 'translations.de': { $exists: true, $ne: '' } },
        { 'translations.es': { $exists: true, $ne: '' } },
      ],
    });
    const translationCount = Math.max(realTranslationsCount, aiFeatureTransCount);

    // - Summarization: count of summaries in Summary model
    const realSummariesCount = await Summary.countDocuments();
    const summarizationCount = Math.max(realSummariesCount, aiFeatureSummCount);

    // - Smart Reply: AI bot message responses / smart replies
    const smartReplyCount = Math.max(totalAiMessages, aiFeatureSmartCount);

    // - Toxicity Detection: Total messages processed through moderation
    const toxicityCount = Math.max(totalAnalyzed, aiFeatureToxCount);

    const rawAiUsage = [
      { name: 'Translation', count: translationCount, color: '#38bdf8' },
      { name: 'Summarization', count: summarizationCount, color: '#a855f7' },
      { name: 'Smart Reply', count: smartReplyCount, color: '#10b981' },
      { name: 'Toxicity Detection', count: toxicityCount, color: '#f43f5e' },
    ];
    const totalAiUsageCount = rawAiUsage.reduce((sum, item) => sum + item.count, 0);

    const aiFeatureUsage = rawAiUsage.map((item) => ({
      ...item,
      percentage: totalAiUsageCount > 0 ? Math.round((item.count / totalAiUsageCount) * 100) : 0,
    }));

    // 7. Daily Message Activity
    const dailyActivity = analyticsRecords.slice(-10).map((record) => ({
      date: record.date,
      messages: record.messagesCount || 0,
      toxicDetected: (record.toxicDetectedCount || 0) + (record.toxicBlockedCount || 0),
      aiQueries: record.aiConversationsCount || 0,
      newUsers: record.newUsersCount || 0,
    }));

    // If daily activity is empty, provide today's baseline so chart renders cleanly
    if (dailyActivity.length === 0 && totalMessages > 0) {
      const today = new Date().toISOString().split('T')[0];
      dailyActivity.push({
        date: today,
        messages: totalMessages,
        toxicDetected: totalDetected,
        aiQueries: totalAiMessages,
        newUsers: totalUsers,
      });
    }

    // 8. Top Chat Engagement (Activity-based tracking with 5-minute inactivity timeout)
    const currentUserId = req.user?._id;
    let targetConversations = [];

    if (currentUserId) {
      targetConversations = await Conversation.find({ participants: currentUserId })
        .populate('participants', 'username avatar isAi');
    }

    // Fallback to platform-wide top conversations if user has no personal chats
    if (!targetConversations || targetConversations.length === 0) {
      targetConversations = await Conversation.find()
        .populate('participants', 'username avatar isAi');
    }

    const engagementMap = new Map();

    for (const conv of targetConversations) {
      // Find the contact relative to current user, or the non-AI participant
      let contact = null;
      if (currentUserId) {
        contact = conv.participants.find((p) => p._id.toString() !== currentUserId.toString());
      }
      if (!contact && conv.participants.length > 0) {
        contact = conv.participants.find((p) => !p.isAi) || conv.participants[0];
      }
      if (!contact) continue;

      const msgs = await Message.find({ conversation: conv._id }).select('createdAt');
      if (msgs.length === 0) continue;

      const { chatTimeMinutes, formattedTime } = calculateEngagement(msgs);
      const contactKey = contact._id.toString();

      if (engagementMap.has(contactKey)) {
        const existing = engagementMap.get(contactKey);
        const combinedMinutes = existing.chatTimeMinutes + chatTimeMinutes;
        let combinedFormatted = `${combinedMinutes}m`;
        if (combinedMinutes >= 60) {
          const h = Math.floor(combinedMinutes / 60);
          const m = combinedMinutes % 60;
          combinedFormatted = m > 0 ? `${h}h ${m}m` : `${h}h`;
        }
        engagementMap.set(contactKey, {
          contact: existing.contact,
          messagesExchanged: existing.messagesExchanged + msgs.length,
          chatTimeMinutes: combinedMinutes,
          estimatedChatTime: combinedFormatted,
        });
      } else {
        engagementMap.set(contactKey, {
          contact: {
            _id: contact._id,
            username: contact.username,
            avatar: contact.avatar,
            isAi: contact.isAi || false,
          },
          messagesExchanged: msgs.length,
          chatTimeMinutes,
          estimatedChatTime: formattedTime,
        });
      }
    }

    const sortedEngagement = Array.from(engagementMap.values())
      .sort((a, b) => b.messagesExchanged - a.messagesExchanged)
      .slice(0, 5)
      .map((item, index) => ({
        rank: index + 1,
        ...item,
      }));

    res.json({
      success: true,
      data: {
        totalUsers,
        totalMessages,
        totalAiMessages,
        toxicMessagesBlocked: totalDetected,
        // AI Feature Usage
        aiFeatureUsage,
        // Toxicity & Safety Stats
        toxicityStats: {
          totalAnalyzed,
          totalDetected,
          detectionRate: `${detectionRate}%`,
          severityBreakdown,
          categoriesBreakdown,
          falsePositiveCount: falsePositives,
        },
        // Daily Activity
        dailyActivity,
        // Top Chat Engagement
        topChatEngagement: sortedEngagement,
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
