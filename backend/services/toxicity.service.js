const { genAI } = require('./gemini.service');

/**
 * Check if a text message is toxic, abusive, or harmful
 * @param {string} text - The content of the message
 * @returns {Promise<{ isToxic: boolean, reason: string }>}
 */
const checkToxicity = async (text) => {
  if (!text || text.trim() === '') {
    return { isToxic: false, reason: '' };
  }

  try {
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    });

    const prompt = `Analyze the following user chat message for toxicity (including harassment, abuse, severe profanity, hate speech, threats, sexual content, self-harm, or illegal activities).
Respond ONLY with a valid JSON object matching this schema:
{
  "isToxic": boolean,
  "reason": "Brief explanation of why it is flagged, or empty string if it is clean"
}

Message to analyze: "${text.replace(/"/g, '\\"')}"`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    
    try {
      const cleaned = responseText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      const evaluation = JSON.parse(cleaned);
      return {
        isToxic: !!evaluation.isToxic,
        reason: evaluation.reason || '',
      };
    } catch (parseError) {
      // Fallback in case JSON parsing fails
      console.error('Failed to parse toxicity response:', responseText);
      const isToxic = responseText.toLowerCase().includes('true') || responseText.toLowerCase().includes('yes');
      return {
        isToxic,
        reason: isToxic ? 'Message flagged as containing inappropriate content.' : '',
      };
    }
  } catch (error) {
    console.error('Toxicity Service Error:', error);
    // Fail safe: if Gemini is down, do not block the system entirely, or alert admin.
    // Let's default to not toxic to prevent system lockout, but log the issue.
    return { isToxic: false, reason: '' };
  }
};

module.exports = {
  checkToxicity,
};
