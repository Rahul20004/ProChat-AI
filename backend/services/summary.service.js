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

        const prompt = `You are an expert conversation analyst. Analyze the following real-time chat between users and generate a clear, highly accurate, structured summary.

Conversation log:
${conversationLog}

Your task:
Analyze the conversation and provide a structured summary adhering strictly to the guidelines below.

Output format (use this exact structure):
Overview:
[2-3 sentences summarizing the conversation, distinguishing casual banter from technical discussions. Use natural, concise language without repetitive phrases.]

Key Topics:
- [Important subject or topic discussed]
- [Another topic if relevant]

Decisions:
- [Actual decision or consensus reached by the participants]

Action Items:
- [Concrete task, follow-up, or commitment explicitly agreed to]

Important Messages:
- [Critical technical detail, credential, deadline, or notable message needing attention]

Strict Rules & Constraints:
1. Summarize ONLY the messages provided. Do not extrapolate, assume, or invent events, tasks, decisions, or conclusions.
2. Distinguish casual chat from technical discussions. Never treat casual greetings, jokes, or chit-chat as formal or professional meetings.
3. Do NOT invent professional decisions or action items for casual conversations.
4. Avoid unnecessarily mentioning arguments, hostile remarks, or deleted messages unless they are genuinely central to the conversation context.
5. Preserve important technical details (e.g. language, library names, architectures, error codes) accurately.
6. Identify actual tasks or commitments ONLY when explicitly discussed by the participants.
7. Avoid repetitive sentences. Use concise, natural, and easy-to-understand language.
8. CRITICAL: If no decisions were made, completely omit the "Decisions:" heading and section. Do NOT write "None" or "N/A".
9. CRITICAL: If no action items or commitments were made, completely omit the "Action Items:" heading and section. Do NOT write "None" or "N/A".
10. CRITICAL: If no important messages need attention, completely omit the "Important Messages:" heading and section. Do NOT write "None" or "N/A".
11. Do NOT wrap the output in markdown code blocks (\`\`\`). Do NOT include raw asterisks around section headers.`;

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
