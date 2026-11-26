const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    text: {
      type: String,
      required: [true, 'Message text is required'],
      trim: true,
    },
    translations: {
      en: { type: String, default: '' },
      hi: { type: String, default: '' },
      fr: { type: String, default: '' },
      de: { type: String, default: '' },
      es: { type: String, default: '' },
    },
    isToxic: {
      type: Boolean,
      default: false,
    },
    toxicityCategory: {
      type: String,
      default: '',
    },
    toxicitySeverity: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'None'],
      default: 'None',
    },
    toxicityConfidence: {
      type: Number,
      default: 0,
    },
    toxicityReason: {
      type: String,
      default: '',
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isDeletedForEveryone: {
      type: Boolean,
      default: false,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    savedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Message', messageSchema);
