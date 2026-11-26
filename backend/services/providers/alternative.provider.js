/**
 * Configurable Alternative AI Provider
 * Supports multiple alternative providers: Groq, OpenAI, OpenRouter, Anthropic/custom
 * Configurable via ALT_AI_PROVIDER and ALT_AI_API_KEY
 */

const getProviderName = () => (process.env.ALT_AI_PROVIDER || 'alternative').toLowerCase();
const getApiKey = () => process.env.ALT_AI_API_KEY || process.env.ALTERNATIVE_AI_API_KEY;

const getBaseUrl = () => {
  if (process.env.ALT_AI_BASE_URL) return process.env.ALT_AI_BASE_URL;
  const provider = getProviderName();
  if (provider === 'groq') return 'https://api.groq.com/openai/v1';
  if (provider === 'openrouter') return 'https://openrouter.ai/api/v1';
  return 'https://api.openai.com/v1';
};

const getModel = () => {
  if (process.env.ALT_AI_MODEL) return process.env.ALT_AI_MODEL;
  const provider = getProviderName();
  if (provider === 'groq') return 'llama-3.1-8b-instant';
  if (provider === 'openrouter') return 'meta-llama/llama-3.1-8b-instruct';
  return 'gpt-4o-mini';
};

const isAvailable = () => {
  return !!getApiKey();
};

/**
 * Translate single message using alternative provider
 */
const translate = async (text, targetLanguage) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Alternative AI provider is not configured. Please set ALT_AI_API_KEY in environment variables.');
  }

  const endpoint = `${getBaseUrl().replace(/\/+$/, '')}/chat/completions`;

  const prompt = `You are a professional language translator. Translate the following text accurately and naturally into ${targetLanguage}.
Maintain the original tone, nuances, and formatting. Do not include any introductory remarks, explanations, quotes, or notes.
Output ONLY the direct translated text.

Text to translate:
"${text.replace(/"/g, '\\"')}"`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: getModel(),
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Alternative AI Provider (${getProviderName()}) Error [${response.status}]: ${errorBody || response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim();

  const cleaned = (content || '')
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  return cleaned || text;
};

/**
 * Translate text into 5 default languages
 */
const translateMulti = async (text) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { en: text, hi: text, fr: text, de: text, es: text };
  }

  const endpoint = `${getBaseUrl().replace(/\/+$/, '')}/chat/completions`;

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

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: getModel(),
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`Alternative AI Provider (${getProviderName()}) Error [${response.status}]`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  const cleaned = (content || '')
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
 * Summarize message using alternative provider
 */
const summarize = async (text) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Alternative AI provider is not configured. Please set ALT_AI_API_KEY in environment variables.');
  }

  const endpoint = `${getBaseUrl().replace(/\/+$/, '')}/chat/completions`;

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

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: getModel(),
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`Alternative AI Provider (${getProviderName()}) Error [${response.status}]`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  return (content || '')
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
};

module.exports = {
  get name() {
    return getProviderName();
  },
  translate,
  translateMulti,
  summarize,
  isAvailable,
};
