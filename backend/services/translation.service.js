const { genAI } = require('./gemini.service');

/**
 * Translate text into multiple languages: English, Hindi, French, German, Spanish
 * @param {string} text - Content to translate
 * @returns {Promise<{ en: string, hi: string, fr: string, de: string, es: string }>}
 */
const translateMessage = async (text) => {
  if (!text || text.trim() === '') {
    return { en: '', hi: '', fr: '', de: '', es: '' };
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-pro',
    });

    const prompt = `Translate the following chat message into the five languages listed below.
Provide your response ONLY as a JSON object matching this schema:
{
  "en": "English translation here",
  "hi": "Hindi translation here",
  "fr": "French translation here",
  "de": "German translation here",
  "es": "Spanish translation here"
}

Message to translate: "${text.replace(/"/g, '\\"')}"`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    try {
      const translations = JSON.parse(responseText);
      return {
        en: translations.en || text,
        hi: translations.hi || text,
        fr: translations.fr || text,
        de: translations.de || text,
        es: translations.es || text,
      };
    } catch (parseError) {
      console.error('Failed to parse translation response:', responseText);
      // Fallback: return original text for all fields
      return {
        en: text,
        hi: text,
        fr: text,
        de: text,
        es: text,
      };
    }
  } catch (error) {
    console.error('Translation Service Error:', error);
    return {
      en: text,
      hi: text,
      fr: text,
      de: text,
      es: text,
    };
  }
};

module.exports = {
  translateMessage,
};
