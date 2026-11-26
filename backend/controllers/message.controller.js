const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const Analytics = require('../models/Analytics');
const Notification = require('../models/Notification');

// Import AI Services
const { checkToxicity } = require('../services/toxicity.service');
const { translateMessage } = require('../services/translation.service');
const { generateResponse } = require('../services/gemini.service');

/**
 * Asynchronously analyze message toxicity without blocking real-time messaging latency
 */
async function processAsyncToxicity({ message, conversationId, senderUser, io }) {
  try {
    const text = message.text;
    if (!text || text.trim() === '') return;

    // 1. Fetch conversation participants to identify recipients
    const conversation = await Conversation.findById(conversationId).populate('participants', 'username avatar isAi');
    if (!conversation || !conversation.participants) return;

    // Filter to human recipients only (exclude message sender and AI bot)
    const recipients = conversation.participants.filter(
      (p) => p._id.toString() !== senderUser._id.toString() && !p.isAi
    );

    // If there are no other human recipients (e.g. talking only to AI), skip
    if (recipients.length === 0) return;

    // 2. Increment messages analyzed count in Analytics
    await Analytics.incrementCount('toxicAnalyzedCount');

    // 3. Analyze text toxicity using Gemini AI service
    const toxicity = await checkToxicity(text);

    // 4. If toxic with sufficient confidence (Medium, High, or confidence >= 0.65)
    if (toxicity.isToxic && toxicity.severity !== 'None' && toxicity.confidence >= 0.65) {
      console.log(`[Safety System] Toxic message detected in conv ${conversationId} from ${senderUser.username}:`, {
        category: toxicity.category,
        severity: toxicity.severity,
        confidence: toxicity.confidence,
      });

      // Update message in DB with toxicity flags
      await Message.findByIdAndUpdate(message._id, {
        isToxic: true,
        toxicityCategory: toxicity.category,
        toxicitySeverity: toxicity.severity,
        toxicityConfidence: toxicity.confidence,
        toxicityReason: toxicity.reason,
      });

      // Update Analytics counters
      const increments = {
        toxicDetectedCount: 1,
      };
      if (toxicity.severity === 'High') increments.severityHighCount = 1;
      else if (toxicity.severity === 'Medium') increments.severityMediumCount = 1;
      else if (toxicity.severity === 'Low') increments.severityLowCount = 1;

      const catLower = (toxicity.category || '').toLowerCase();
      if (catLower.includes('threat')) increments.categoryThreatCount = 1;
      else if (catLower.includes('hate')) increments.categoryHateSpeechCount = 1;
      else if (catLower.includes('sexual')) increments.categorySexualCount = 1;
      else if (catLower.includes('harass') || catLower.includes('bully')) increments.categoryHarassmentCount = 1;
      else if (catLower.includes('insult')) increments.categoryInsultCount = 1;
      else increments.categoryAbusiveCount = 1;

      await Analytics.incrementMultiple(increments);

      // Create and deliver notification to each recipient
      for (const recipient of recipients) {
        // Prevent duplicate notification
        const existing = await Notification.findOne({
          recipient: recipient._id,
          message: message._id,
        });
        if (existing) continue;

        // Persist notification in MongoDB
        const notif = await Notification.create({
          recipient: recipient._id,
          sender: senderUser._id,
          message: message._id,
          conversation: conversationId,
          type: 'TOXIC_MESSAGE',
          title: 'Toxic Message Detected',
          category: toxicity.category,
          severity: toxicity.severity,
          confidence: toxicity.confidence,
          reason: toxicity.reason,
          messageSnippet: text.slice(0, 120),
        });

        const populatedNotif = await Notification.findById(notif._id)
          .populate('sender', 'username avatar isAi')
          .populate('recipient', 'username');

        // Emit real-time notification to the receiver's private user room
        if (io) {
          io.to(`user_${recipient._id.toString()}`).emit('toxic_notification', populatedNotif);
          console.log(`[Safety System] Emitted real-time safety alert to user_${recipient._id.toString()} for message ${message._id}`);
        }
      }

      // Also notify the active room so clients can update the message UI
      if (io) {
        io.to(conversationId.toString()).emit('message_toxicity_updated', {
          messageId: message._id,
          conversationId,
          isToxic: true,
          toxicityCategory: toxicity.category,
          toxicitySeverity: toxicity.severity,
          toxicityConfidence: toxicity.confidence,
          toxicityReason: toxicity.reason,
        });
      }
    }
  } catch (err) {
    console.error('[Safety System Error] Asynchronous toxicity processing failed:', err.message);
  }
}

// @desc    Send a message in a conversation
// @route   POST /api/messages
// @access  Private
const sendMessage = async (req, res) => {
  const { conversationId, text } = req.body;

  if (!conversationId || !text) {
    return res.status(400).json({ success: false, message: 'conversationId and text are required' });
  }

  try {
    // 1. Generate Translations
    const translations = await translateMessage(text);

    // 2. Create and save user message immediately (non-blocking delivery)
    let message = await Message.create({
      conversation: conversationId,
      sender: req.user._id,
      text,
      translations,
      isToxic: false,
    });

    // Populate sender details for frontend usage
    message = await Message.findById(message._id).populate('sender', 'username email avatar isAi');

    // 3. Update Conversation's lastMessage reference
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
    });

    // 4. Log message count in analytics
    await Analytics.incrementCount('messagesCount');

    // 5. Broadcast user message immediately via Socket.io
    const io = req.app.get('io');
    if (io) {
      // Emit to conversation room for instant chat delivery
      io.to(conversationId.toString()).emit('message_received', message);
    }

    // 6. Return response to sender immediately (real-time chat latency remains sub-second)
    res.status(201).json({ success: true, data: message });

    // 7. Non-blocking asynchronous background analysis for toxicity & safety alerts
    setImmediate(() => {
      processAsyncToxicity({
        message,
        conversationId,
        senderUser: req.user,
        io,
      });
    });

    // 8. Check if recipient is the AI Assistant
    const conversation = await Conversation.findById(conversationId).populate('participants');
    const aiParticipant = conversation.participants.find(p => p.isAi);

    if (aiParticipant) {
      // Retrieve conversation history (up to last 15 messages) for memory context
      const chatHistory = await Message.find({ conversation: conversationId })
        .sort({ createdAt: -1 })
        .limit(15);
      
      // Reverse to chronological order
      chatHistory.reverse();

      const geminiHistory = chatHistory.map(msg => ({
        sender: msg.sender.toString() === aiParticipant._id.toString() ? 'ProChat AI' : 'User',
        role: msg.sender.toString() === aiParticipant._id.toString() ? 'model' : 'user',
        text: msg.text
      }));

      // Generate AI response
      try {
        const aiReplyText = await generateResponse(text, geminiHistory);
        const aiTranslations = await translateMessage(aiReplyText);

        let aiMessage = await Message.create({
          conversation: conversationId,
          sender: aiParticipant._id,
          text: aiReplyText,
          translations: aiTranslations,
        });

        aiMessage = await Message.findById(aiMessage._id).populate('sender', 'username email avatar isAi');

        // Update Conversation lastMessage
        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: aiMessage._id,
        });

        // Log analytics
        await Analytics.incrementCount('messagesCount');
        await Analytics.incrementCount('aiConversationsCount');

        // Broadcast AI reply via Socket.io
        if (io) {
          io.to(conversationId.toString()).emit('message_received', aiMessage);
        }
      } catch (aiError) {
        console.error('AI Processing Error:', aiError);
        let fallbackMessage = await Message.create({
          conversation: conversationId,
          sender: aiParticipant._id,
          text: `AI Error: ${aiError.message || 'Unknown error occurred'}`,
        });
        fallbackMessage = await Message.findById(fallbackMessage._id).populate('sender', 'username email avatar isAi');
        if (io) {
          io.to(conversationId.toString()).emit('message_received', fallbackMessage);
        }
      }
    }
  } catch (error) {
    console.error('Send Message Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all messages in a conversation
// @route   GET /api/messages/:conversationId
// @access  Private
const getMessages = async (req, res) => {
  try {
    const messages = await Message.find({
      conversation: req.params.conversationId,
      isDeletedForEveryone: { $ne: true },
      deletedFor: { $ne: req.user._id },
    })
      .populate('sender', 'username email avatar isAi')
      .sort({ createdAt: 1 });

    res.status(200).json({ success: true, data: messages });
  } catch (error) {
    console.error('Get Messages Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete message (Delete for me OR Delete for everyone)
// @route   DELETE /api/messages/:id
// @access  Private
const deleteMessage = async (req, res) => {
  const { id } = req.params;
  const { deleteType = 'me' } = req.body;

  try {
    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    // Security check: Validate conversation membership
    const conversation = await Conversation.findById(message.conversation);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const isMember = conversation.participants.some(
      (p) => p.toString() === req.user._id.toString()
    );
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'You are not a member of this conversation' });
    }

    if (deleteType === 'everyone') {
      // Security check: Only author can delete for everyone
      if (message.sender.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Permission denied: Only the message sender can delete for everyone',
        });
      }

      message.isDeletedForEveryone = true;
      message.text = 'This message was deleted';
      message.translations = { en: '', hi: '', fr: '', de: '', es: '' };
      await message.save();

      // Check if this was the lastMessage of the conversation
      if (conversation.lastMessage && conversation.lastMessage.toString() === message._id.toString()) {
        const prevMessage = await Message.findOne({
          conversation: conversation._id,
          isDeletedForEveryone: { $ne: true },
        }).sort({ createdAt: -1 });

        await Conversation.findByIdAndUpdate(conversation._id, {
          lastMessage: prevMessage ? prevMessage._id : null,
        });
      }

      // Synchronize deletion via Socket.io to the entire conversation room
      const io = req.app.get('io');
      if (io) {
        io.to(message.conversation.toString()).emit('message_deleted', {
          messageId: message._id,
          conversationId: message.conversation,
          deleteType: 'everyone',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Message deleted for everyone',
        data: { messageId: message._id, deleteType: 'everyone' },
      });
    } else {
      // Delete for me
      await Message.findByIdAndUpdate(message._id, {
        $addToSet: { deletedFor: req.user._id },
      });

      return res.status(200).json({
        success: true,
        message: 'Message deleted for you',
        data: { messageId: message._id, deleteType: 'me' },
      });
    }
  } catch (error) {
    console.error('Delete Message Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Toggle pin status of a message
// @route   PUT /api/messages/pin/:id
// @access  Private
const togglePinMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ success: false, message: 'Message not found' });
    message.isPinned = !message.isPinned;
    await message.save();
    res.status(200).json({ success: true, isPinned: message.isPinned });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Toggle saved status of a message
// @route   PUT /api/messages/save/:id
// @access  Private
const toggleSaveMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ success: false, message: 'Message not found' });
    const isSaved = message.savedBy?.some((u) => u.toString() === req.user._id.toString());
    if (isSaved) {
      await Message.findByIdAndUpdate(message._id, { $pull: { savedBy: req.user._id } });
    } else {
      await Message.findByIdAndUpdate(message._id, { $addToSet: { savedBy: req.user._id } });
    }
    res.status(200).json({ success: true, isSaved: !isSaved });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Mark all messages in a conversation as read by the current user
// @route   PUT /api/messages/read/:conversationId
// @access  Private
const markRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    await Message.updateMany(
      {
        conversation: conversationId,
        sender: { $ne: req.user._id },
        readBy: { $ne: req.user._id },
      },
      { $addToSet: { readBy: req.user._id } }
    );
    res.status(200).json({ success: true, message: 'Messages marked as read' });
  } catch (error) {
    console.error('Mark Read Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get unread message counts for all conversations of the current user
// @route   GET /api/messages/unread/counts
// @access  Private
const getUnreadCounts = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: { $elemMatch: { $eq: req.user._id } },
    });

    const counts = {};
    for (const conv of conversations) {
      const count = await Message.countDocuments({
        conversation: conv._id,
        sender: { $ne: req.user._id },
        readBy: { $ne: req.user._id },
      });
      if (count > 0) {
        counts[conv._id.toString()] = count;
      }
    }

    res.status(200).json({ success: true, data: counts });
  } catch (error) {
    console.error('Get Unread Counts Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  sendMessage,
  getMessages,
  deleteMessage,
  togglePinMessage,
  toggleSaveMessage,
  markRead,
  getUnreadCounts,
  processAsyncToxicity,
};
