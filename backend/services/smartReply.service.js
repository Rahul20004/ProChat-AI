const { genAI } = require('./gemini.service');

/**
 * Generate 3 smart quick reply suggestions based on the last few messages in a conversation
 * @param {Array} messages - List of recent messages
 * @returns {Promise<Array<string>>} - An array of 3 string recommendations
 */
const generateSmartReplies = async (messages = []) => {
  if (!messages || messages.length === 0) {
    return ['Hello!', 'How can I help you?', 'How are you?'];
  }

  try {
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    // Format last 5 messages for context
    const contextText = messages
      .slice(-5)
      .map((msg) => {
        const senderName = msg.sender && msg.sender.username ? msg.sender.username : 'User';
        return `${senderName}: ${msg.text}`;
      })
      .join('\n');

    const prompt = `Based on the following conversation snippets, suggest exactly 3 short, natural, context-aware reply options that a participant could choose to send next. Each response should be concise (typically 2-8 words).
Respond ONLY with a JSON array of 3 strings.

Conversation context:
${contextText}

Example Output:
["Sounds good!", "I'm on it", "Can you explain?"]`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    try {
      const cleaned = responseText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      const suggestions = JSON.parse(cleaned);
      if (Array.isArray(suggestions)) {
        return suggestions.slice(0, 3);
      }
      return ['Understood', 'Got it', 'Thanks!'];
    } catch (parseError) {
      console.error('Failed to parse smart replies:', responseText);
      return ['Got it, thanks', 'Understood', 'Let me check on that'];
    }
  } catch (error) {
    console.error('Smart Reply Service Error:', error);
    return ['Got it, thanks', 'Understood', 'Let me check on that'];
  }
};

module.exports = {
  generateSmartReplies,
};
