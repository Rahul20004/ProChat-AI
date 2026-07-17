const { genAI } = require('./gemini.service');

/**
 * Generate a concise summary of a conversation based on its messages
 * @param {Array} messages - List of message objects containing sender name and text
 * @returns {Promise<string>} - The summary text
 */
const generateSummary = async (messages = []) => {
  if (!messages || messages.length === 0) {
    return 'No messages found to summarize.';
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
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
    return result.response.text().trim();
  } catch (error) {
    console.error('Summary Service Error:', error);
    throw new Error(`Failed to generate summary: ${error.message}`);
  }
};

module.exports = {
  generateSummary,
};
