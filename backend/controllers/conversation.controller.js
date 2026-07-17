const Conversation = require('../models/Conversation');
const User = require('../models/User');

// @desc    Create or get a 1-to-1 conversation
// @route   POST /api/conversations
// @access  Private
const accessConversation = async (req, res) => {
  const { recipientId } = req.body;

  if (!recipientId) {
    return res.status(400).json({ success: false, message: 'recipientId is required' });
  }

  try {
    // Check if recipient exists
    const recipientExists = await User.findById(recipientId);
    if (!recipientExists) {
      return res.status(404).json({ success: false, message: 'Recipient user not found' });
    }

    // Find conversation involving exactly these two participants
    let conversation = await Conversation.findOne({
      isGroup: false,
      $and: [
        { participants: { $elemMatch: { $eq: req.user._id } } },
        { participants: { $elemMatch: { $eq: recipientId } } },
      ],
    })
      .populate('participants', '-password')
      .populate('lastMessage');

    // If conversation doesn't exist, create it
    if (!conversation) {
      const chatData = {
        participants: [req.user._id, recipientId],
        isGroup: false,
      };

      const createdConversation = await Conversation.create(chatData);
      conversation = await Conversation.findById(createdConversation._id).populate(
        'participants',
        '-password'
      );
    }

    res.status(200).json({ success: true, data: conversation });
  } catch (error) {
    console.error('Access Conversation Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all conversations for the logged-in user
// @route   GET /api/conversations
// @access  Private
const getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: { $elemMatch: { $eq: req.user._id } },
    })
      .populate('participants', '-password')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: 'username email avatar',
        },
      })
      .sort({ updatedAt: -1 });

    res.status(200).json({ success: true, data: conversations });
  } catch (error) {
    console.error('Get Conversations Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  accessConversation,
  getConversations,
};
