const { genAI } = require('./gemini.service');
const { executeSummarize } = require('./providers');
const { summaryCache } = require('../utils/cache');
const { executeWithRetry } = require('../utils/retry');
const { recordAIMetrics } = require('../utils/aiLogger');

function getModelName() {
  return process.env.GEMINI_MODEL || 'gemini-3.5-flash';
}

/**
 * Generate a concise summary of a conversation based on its messages
 * @param {Array} messages - List of message objects containing sender name and text
 * @returns {Promise<string>} - The summary text
 */
const generateSummary = async (messages = []) => {
  if (!messages || messages.length === 0) {
    return 'No messages found to summarize.';
  }

  const startTime = Date.now();
  try {
    const summary = await executeWithRetry(
      async () => {
        const model = genAI.getGenerativeModel({
          model: getModelName(),
        });

        // Format messages into a conversation log script
        const conversationLog = messages
          .map((msg) => {
            const senderName = msg.sender && msg.sender.username ? msg.sender.username : 'User';
            return `${senderName}: ${msg.text}`;
          })
          .join('\n');

        const prompt = `Below is a real-time conversation between users. Summarize this conversation, capturing the core topics discussed, any decisions reached, and any action items. Keep the summary under 150 words and present it professionally in clear bullet points or a short paragraph.

Conversation log:
${conversationLog}`;

        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        return text
          .replace(/^```[a-z]*\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim();
      },
      { name: 'Conversation Summary', maxRetries: 2 }
    );

    recordAIMetrics({
      provider: 'gemini',
      action: 'summarize-chat',
      durationMs: Date.now() - startTime,
      success: true,
      fromCache: false,
    });

    return summary;
  } catch (error) {
    recordAIMetrics({
      provider: 'gemini',
      action: 'summarize-chat',
      durationMs: Date.now() - startTime,
      success: false,
      errorType: error.code || 'UNKNOWN',
    });
    console.error('Summary Service Error:', error.message);
    throw error;
  }
};

/**
 * Generate a concise, meaningful summary of an individual text message
 * Features in-memory caching, in-flight deduplication, and retry logic.
 * @param {string} text - Message text to summarize
 * @returns {Promise<string>} - The summarized text
 */
const summarizeSingleMessage = async (text) => {
  if (!text || text.trim() === '') {
    const err = new Error('Empty message cannot be summarized.');
    err.status = 400;
    err.code = 'INVALID_PAYLOAD';
    throw err;
  }

  const trimmedText = text.trim();
  const cacheKey = `single_summary_${trimmedText}`;

  const startTime = Date.now();

  try {
    const { value: summaryText, fromCache } = await summaryCache.getOrFetch(
      cacheKey,
      async () => {
        return await executeWithRetry(
          async () => {
            return await executeSummarize(trimmedText);
          },
          { name: 'Single Message Summarize', maxRetries: 2 }
        );
      }
    );

    recordAIMetrics({
      provider: 'gemini',
      action: 'summarize-message',
      durationMs: Date.now() - startTime,
      success: true,
      fromCache,
    });

    return summaryText;
  } catch (error) {
    recordAIMetrics({
      provider: 'gemini',
      action: 'summarize-message',
      durationMs: Date.now() - startTime,
      success: false,
      errorType: error.code || 'SERVER_ERROR',
    });
    console.error('Single Message Summary Service Error:', error.message);
    throw error;
  }
};

module.exports = {
  generateSummary,
  summarizeSingleMessage,
};
