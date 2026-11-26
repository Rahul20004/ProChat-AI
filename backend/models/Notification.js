const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    message: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      required: true,
      index: true,
    },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    type: {
      type: String,
      default: 'TOXIC_MESSAGE',
      enum: ['TOXIC_MESSAGE', 'SYSTEM', 'MENTION'],
    },
    title: {
      type: String,
      default: 'Toxic Message Detected',
    },
    category: {
      type: String,
      required: true,
      default: 'Abusive language',
    },
    severity: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.85,
    },
    reason: {
      type: String,
      default: '',
    },
    messageSnippet: {
      type: String,
      default: '',
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    dismissed: {
      type: Boolean,
      default: false,
    },
    feedback: {
      type: String,
      enum: ['none', 'confirmed', 'false_positive'],
      default: 'none',
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate notifications for the same message and recipient
notificationSchema.index({ recipient: 1, message: 1 }, { unique: true });

module.exports = mongoose.model('Notification', notificationSchema);
