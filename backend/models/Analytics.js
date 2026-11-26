const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema(
  {
    date: {
      type: String, // format: YYYY-MM-DD
      required: true,
      unique: true,
      index: true,
    },
    messagesCount: {
      type: Number,
      default: 0,
    },
    toxicBlockedCount: {
      type: Number,
      default: 0,
    },
    aiConversationsCount: {
      type: Number,
      default: 0,
    },
    newUsersCount: {
      type: Number,
      default: 0,
    },
    geminiRequestsCount: {
      type: Number,
      default: 0,
    },
    fallbackRequestsCount: {
      type: Number,
      default: 0,
    },
    cacheHitsCount: {
      type: Number,
      default: 0,
    },
    quotaErrorsCount: {
      type: Number,
      default: 0,
    },
    totalAiResponseTimeMs: {
      type: Number,
      default: 0,
    },
    aiSuccessCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Static method to increment counts for a specific day
analyticsSchema.statics.incrementCount = async function (field, incrementBy = 1) {
  const today = new Date().toISOString().split('T')[0];
  const update = { $inc: { [field]: incrementBy } };
  
  return await this.findOneAndUpdate(
    { date: today },
    update,
    { upsert: true, new: true }
  );
};

module.exports = mongoose.model('Analytics', analyticsSchema);
