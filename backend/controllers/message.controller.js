const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const Analytics = require('../models/Analytics');

// Import AI Services
const { checkToxicity } = require('../services/toxicity.service');
const { translateMessage } = require('../services/translation.service');
const { generateResponse } = require('../services/gemini.service');

// @desc    Send a message in a conversation
// @route   POST /api/messages
// @access  Private
const sendMessage = async (req, res) => {
  const { conversationId, text } = req.body;

  if (!conversationId || !text) {
    return res.status(400).json({ success: false, message: 'conversationId and text are required' });
  }

  try {
    // 1. Toxicity Check
    const toxicityResult = await checkToxicity(text);
    if (toxicityResult.isToxic) {
      // Log blocked toxic message in analytics
      await Analytics.incrementCount('toxicBlockedCount');

      return res.status(400).json({
        success: false,
        isToxic: true,
        message: `Message blocked: ${toxicityResult.reason || 'Flagged for toxic content.'}`,
      });
    }

    // 2. Generate Translations in Parallel
    const translations = await translateMessage(text);

    // 3. Create and save user message
    let message = await Message.create({
      conversation: conversationId,
      sender: req.user._id,
      text,
      translations,
    });

    // Populate sender details for frontend usage
    message = await Message.findById(message._id).populate('sender', 'username email avatar isAi');

    // 4. Update Conversation's lastMessage reference
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
    });

    // 5. Log message count in analytics
    await Analytics.incrementCount('messagesCount');

    // 6. Broadcast user message via Socket.io
    const io = req.app.get('io');
    if (io) {
      // Emit to conversation room
      io.to(conversationId.toString()).emit('message_received', message);
    }

    // 7. Check if recipient is the AI Assistant
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

      // Generate AI response in background
      // To ensure responsiveness, we can generate it immediately
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
        // If AI generation fails, send error/fallback message
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

    res.status(201).json({ success: true, data: message });
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
    const messages = await Message.find({ conversation: req.params.conversationId })
      .populate('sender', 'username email avatar isAi')
      .sort({ createdAt: 1 });

    res.status(200).json({ success: true, data: messages });
  } catch (error) {
    console.error('Get Messages Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark all messages in a conversation as read by the current user
// @route   PUT /api/messages/read/:conversationId
// @access  Private
const markRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    // Update all messages in this conversation where the user hasn't read yet
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
    // Find all conversations the user participates in
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
  markRead,
  getUnreadCounts,
};
