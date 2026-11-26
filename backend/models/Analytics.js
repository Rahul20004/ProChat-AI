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
    toxicAnalyzedCount: {
      type: Number,
      default: 0,
    },
    toxicDetectedCount: {
      type: Number,
      default: 0,
    },
    severityHighCount: {
      type: Number,
      default: 0,
    },
    severityMediumCount: {
      type: Number,
      default: 0,
    },
    severityLowCount: {
      type: Number,
      default: 0,
    },
    categoryAbusiveCount: {
      type: Number,
      default: 0,
    },
    categoryThreatCount: {
      type: Number,
      default: 0,
    },
    categoryHateSpeechCount: {
      type: Number,
      default: 0,
    },
    categoryHarassmentCount: {
      type: Number,
      default: 0,
    },
    categorySexualCount: {
      type: Number,
      default: 0,
    },
    categoryInsultCount: {
      type: Number,
      default: 0,
    },
    falsePositiveFeedbackCount: {
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

// Static method to increment multiple counts at once
analyticsSchema.statics.incrementMultiple = async function (increments = {}) {
  const today = new Date().toISOString().split('T')[0];
  const incObj = {};
  for (const [field, val] of Object.entries(increments)) {
    if (typeof val === 'number' && val !== 0) {
      incObj[field] = val;
    }
  }

  if (Object.keys(incObj).length === 0) return null;

  return await this.findOneAndUpdate(
    { date: today },
    { $inc: incObj },
    { upsert: true, new: true }
  );
};

module.exports = mongoose.model('Analytics', analyticsSchema);
