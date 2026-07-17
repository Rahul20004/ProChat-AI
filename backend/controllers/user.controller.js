const User = require('../models/User');

// @desc    Search users by username or email
// @route   GET /api/users
// @access  Private
const getUsers = async (req, res) => {
  try {
    const search = req.query.search
      ? {
          $and: [
            {
              $or: [
                { username: { $regex: req.query.search, $options: 'i' } },
                { email: { $regex: req.query.search, $options: 'i' } },
              ],
            },
            { _id: { $ne: req.user._id } }, // Exclude self
          ],
        }
      : { _id: { $ne: req.user._id } };

    const users = await User.find(search).select('-password');
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Get Users Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get a specific user by ID
// @route   GET /api/users/:id
// @access  Private
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (user) {
      res.json({ success: true, data: user });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    console.error('Get User ID Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get the virtual AI Assistant user
// @route   GET /api/users/ai-assistant
// @access  Private
const getAiAssistant = async (req, res) => {
  try {
    const aiUser = await User.findOne({ isAi: true }).select('-password');
    if (aiUser) {
      res.json({ success: true, data: aiUser });
    } else {
      res.status(404).json({ success: false, message: 'AI Assistant not initialized' });
    }
  } catch (error) {
    console.error('Get AI Assistant Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getUsers,
  getUserById,
  getAiAssistant,
};
