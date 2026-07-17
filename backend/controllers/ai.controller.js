const Message = require('../models/Message');
const Summary = require('../models/Summary');
const Conversation = require('../models/Conversation');
const { generateSummary } = require('../services/summary.service');
const { translateMessage } = require('../services/translation.service');
const { generateSmartReplies } = require('../services/smartReply.service');
const { generateResponse } = require('../services/gemini.service');

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

// @desc    Generate a summary of a conversation
// @route   POST /api/ai/summary
// @access  Private
const summarizeChat = async (req, res) => {
  const { conversationId } = req.body;

  if (!conversationId) {
    return res.status(400).json({ success: false, message: 'conversationId is required' });
  }

  try {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
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
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ success: false, message: 'Text is required' });
  }

  try {
    const translations = await translateMessage(text);
    res.json({ success: true, data: translations });
  } catch (error) {
    console.error('AI Translate Error:', error);
    res.status(500).json({ success: false, message: error.message });
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
  getLatestSummary,
  translateText,
  getSmartReplies,
};
