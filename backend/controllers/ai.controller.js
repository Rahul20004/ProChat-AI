const mongoose = require('mongoose');
const Message = require('../models/Message');
const Summary = require('../models/Summary');
const Conversation = require('../models/Conversation');
const { generateSummary, summarizeSingleMessage } = require('../services/summary.service');
const { translateMessage, translateToLanguage } = require('../services/translation.service');
const { generateSmartReplies } = require('../services/smartReply.service');
const { generateResponse } = require('../services/gemini.service');
const { parseAIError } = require('../utils/aiError');

// @desc    Generate a chat response from Gemini directly
// @route   POST /api/ai/chat
// @access  Private
const chatDirect = async (req, res) => {
  const { prompt, history } = req.body;
  if (!prompt) {
    return res.status(400).json({ success: false, message: 'Prompt is required' });
  }

  try {
    const reply = await generateResponse(prompt, history || []);
    res.json({ success: true, data: reply });
  } catch (error) {
    console.error('AI Direct Chat Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Generate a summary of a conversation (or individual message if specified)
// @route   POST /api/ai/summary
// @access  Private
const summarizeChat = async (req, res) => {
  const { conversationId, messageId, text } = req.body;

  // Fallback if client calls /api/ai/summary with single message params
  if (!conversationId && (messageId || text)) {
    return summarizeMessage(req, res);
  }

  if (!conversationId) {
    return res.status(400).json({ success: false, message: 'conversationId is required' });
  }

  try {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    // Verify user authorization for conversation
    if (conversation.participants) {
      const isParticipant = conversation.participants.some(
        (p) => p.toString() === req.user._id.toString()
      );
      if (!isParticipant) {
        return res.status(403).json({ success: false, message: 'Not authorized to summarize this conversation' });
      }
    }

    // Retrieve last 50 messages to summarize
    const messages = await Message.find({ conversation: conversationId })
      .populate('sender', 'username')
      .sort({ createdAt: -1 })
      .limit(50);

    // Order chronologically
    messages.reverse();

    if (messages.length === 0) {
      return res.status(400).json({ success: false, message: 'No messages found to summarize' });
    }

    const summaryText = await generateSummary(messages);

    const savedSummary = await Summary.create({
      conversation: conversationId,
      summaryText,
      generatedBy: req.user._id,
    });

    res.json({ success: true, data: savedSummary });
  } catch (error) {
    console.error('AI Summarize Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Generate a concise summary of an individual message
// @route   POST /api/ai/summarize-message
// @access  Private
const summarizeMessage = async (req, res) => {
  const { messageId, text } = req.body;

  let messageText = text;

  // Access control & message retrieval if messageId is supplied
  if (messageId && mongoose.Types.ObjectId.isValid(messageId)) {
    try {
      const message = await Message.findById(messageId).populate('conversation');
      if (message) {
        // Check if current user is participant in conversation
        const conversation = message.conversation;
        if (conversation && conversation.participants) {
          const isParticipant = conversation.participants.some(
            (p) => p.toString() === req.user._id.toString()
          );
          if (!isParticipant) {
            return res.status(403).json({ success: false, message: 'Not authorized to access this message' });
          }
        }

        if (!messageText) {
          messageText = message.text;
        }
      }
    } catch (err) {
      console.warn('Summarize Message Access Check Notice:', err.message);
    }
  }

  if (!messageText || messageText.trim() === '') {
    return res.status(400).json({
      success: false,
      errorType: 'INVALID_PAYLOAD',
      userTitle: 'Invalid Request',
      message: 'Valid message text is required to generate an AI summary.',
    });
  }

  try {
    const summaryText = await summarizeSingleMessage(messageText.trim());
    res.json({
      success: true,
      data: {
        originalText: messageText.trim(),
        summaryText,
        messageId: messageId || null,
      },
    });
  } catch (error) {
    const parsed = parseAIError(error, 'Summarization');
    console.error('AI Single Message Summarize Error:', {
      errorType: parsed.errorType,
      statusCode: parsed.statusCode,
      message: parsed.userMessage,
    });
    res.status(parsed.statusCode).json({
      success: false,
      errorType: parsed.errorType,
      userTitle: parsed.userTitle,
      message: parsed.userMessage,
      retryDelay: parsed.retryDelaySeconds,
      resetText: parsed.resetText,
      isDailyQuota: parsed.isDailyQuota,
      canRetryNow: parsed.canRetryNow,
    });
  }
};

// @desc    Get the latest summary for a conversation
// @route   GET /api/ai/summary/:conversationId
// @access  Private
const getLatestSummary = async (req, res) => {
  try {
    const summary = await Summary.findOne({ conversation: req.params.conversationId })
      .sort({ createdAt: -1 });

    if (!summary) {
      return res.json({ success: true, data: null, message: 'No summary found for this conversation' });
    }

    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Get Summary Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Translate a string of text
// @route   POST /api/ai/translate
// @access  Private
const translateText = async (req, res) => {
  const { text, targetLanguage, messageId } = req.body;

  let messageText = text;

  // Authorization check if messageId is supplied
  if (messageId) {
    try {
      const message = await Message.findById(messageId).populate('conversation');
      if (!message) {
        return res.status(404).json({ success: false, message: 'Message not found' });
      }

      // Check if current user is participant in conversation
      const conversation = message.conversation;
      if (conversation && conversation.participants) {
        const isParticipant = conversation.participants.some(
          (p) => p.toString() === req.user._id.toString()
        );
        if (!isParticipant) {
          return res.status(403).json({ success: false, message: 'Not authorized to access this message' });
        }
      }

      if (!messageText) {
        messageText = message.text;
      }
    } catch (err) {
      console.error('Translate Auth Check Error:', err);
      return res.status(500).json({ success: false, message: 'Error verifying message access' });
    }
  }

  if (!messageText || messageText.trim() === '') {
    return res.status(400).json({ success: false, message: 'Text is required for translation' });
  }

  try {
    if (targetLanguage) {
      const result = await translateToLanguage(messageText.trim(), targetLanguage);
      return res.json({ success: true, data: result });
    }

    const translations = await translateMessage(messageText.trim());
    res.json({ success: true, data: translations });
  } catch (error) {
    const parsed = parseAIError(error);
    console.error('AI Translate Error:', {
      errorType: parsed.errorType,
      statusCode: parsed.statusCode,
      message: parsed.userMessage,
      targetLanguage,
    });
    res.status(parsed.statusCode).json({
      success: false,
      errorType: parsed.errorType,
      userTitle: parsed.userTitle,
      message: parsed.userMessage,
      retryDelay: parsed.retryDelaySeconds,
      resetText: parsed.resetText,
      isDailyQuota: parsed.isDailyQuota,
      canRetryNow: parsed.canRetryNow,
    });
  }
};

// @desc    Generate smart reply suggestions for a conversation
// @route   GET /api/ai/smart-replies/:conversationId
// @access  Private
const getSmartReplies = async (req, res) => {
  try {
    const conversationId = req.params.conversationId;

    const messages = await Message.find({ conversation: conversationId })
      .populate('sender', 'username')
      .sort({ createdAt: -1 })
      .limit(10);

    messages.reverse();

    const replies = await generateSmartReplies(messages);
    res.json({ success: true, data: replies });
  } catch (error) {
    console.error('AI Smart Replies Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  chatDirect,
  summarizeChat,
  summarizeMessage,
  getLatestSummary,
  translateText,
  getSmartReplies,
};
