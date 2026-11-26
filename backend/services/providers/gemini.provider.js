const { GoogleGenerativeAI } = require('@google/generative-ai');

const getApiKey = () => process.env.GEMINI_API_KEY;
const getModelName = () => process.env.GEMINI_MODEL || 'gemini-3.5-flash';

function getGenAI() {
  const key = getApiKey();
  if (!key) {
    const error = new Error('Gemini API key is not configured.');
    error.status = 401;
    error.code = 'AUTH_ERROR';
    throw error;
  }
  return new GoogleGenerativeAI(key);
}

/**
 * Translate a single text into a specified target language using Gemini
 */
const translate = async (text, targetLanguage) => {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({
    model: getModelName(),
  });

  const prompt = `You are a professional language translator. Translate the following text accurately and naturally into ${targetLanguage}.
Maintain the original tone, nuances, and formatting. Do not include any introductory remarks, explanations, quotes, or notes.
Output ONLY the direct translated text.

Text to translate:
"${text.replace(/"/g, '\\"')}"`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text().trim();

  // Strip any accidental markdown formatting
  const cleaned = responseText
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  return cleaned || text;
};

/**
 * Translate text into 5 default languages (en, hi, fr, de, es)
 */
const translateMulti = async (text) => {
  if (!getApiKey()) {
    return { en: text, hi: text, fr: text, de: text, es: text };
  }

  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({
    model: getModelName(),
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

  const cleaned = responseText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const translations = JSON.parse(cleaned);
  return {
    en: translations.en || text,
    hi: translations.hi || text,
    fr: translations.fr || text,
    de: translations.de || text,
    es: translations.es || text,
  };
};

/**
 * Summarize a single message using Gemini
 */
const summarize = async (text) => {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({
    model: getModelName(),
  });

  const prompt = `You are an AI assistant in ProChat AI.
Summarize the following individual chat message concisely and meaningfully.
Requirements:
1. Focus only on this single message.
2. Capture its key points, core idea, or actionable takeaway clearly.
3. Keep the summary concise (typically 1-3 crisp sentences or concise bullet points).
4. Do NOT include any introductory or concluding meta-commentary (such as "Here is the summary:", "Summary:", or "In this message").
5. Provide ONLY the direct summary text.

Message:
"${text.replace(/"/g, '\\"')}"`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text().trim();
  const cleaned = responseText
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (!cleaned) {
    const error = new Error('Gemini returned an empty summary.');
    error.code = 'EMPTY_RESPONSE';
    throw error;
  }

  return cleaned;
};

module.exports = {
  name: 'gemini',
  translate,
  translateMulti,
  summarize,
  isAvailable: () => !!getApiKey(),
};
