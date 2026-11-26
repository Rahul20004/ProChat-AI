const { GoogleGenerativeAI } = require('@google/generative-ai');

function getApiKey() {
  return process.env.GEMINI_API_KEY;
}

function getModelName() {
  return process.env.GEMINI_MODEL || 'gemini-3.5-flash';
}

function getGenAI() {
  const key = getApiKey();
  if (!key) {
    console.warn('WARNING: GEMINI_API_KEY is not defined in environment variables.');
  }
  return new GoogleGenerativeAI(key || 'dummy-key');
}

// Dynamic proxy to support existing imports of { genAI } without stale API key
const genAI = new Proxy({}, {
  get(target, prop) {
    const instance = getGenAI();
    const value = instance[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  }
});

/**
 * Generate a chat response using Gemini (AI Assistant)
 * @param {string} prompt - The user's input message
 * @param {Array} history - Previous messages for conversation history/context
 * @returns {Promise<string>} - The model's response
 */
const generateResponse = async (prompt, history = []) => {
  try {
    const key = getApiKey();
    if (!key) {
      const err = new Error('Gemini API key is not configured.');
      err.status = 401;
      err.code = 'AUTH_ERROR';
      throw err;
    }

    const client = getGenAI();
    const model = client.getGenerativeModel({
      model: getModelName(),
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
      },
    });

    // Format chat history for Gemini API
    const formattedHistory = [
      {
        role: 'user',
        parts: [{ text: 'You are ProChat AI, an intelligent, helpful, friendly and witty AI assistant inside the ProChat AI Real-Time Communication Platform. Keep your replies clear, concise, conversational, and tailored to chat. Respond in markdown if appropriate.' }]
      },
      {
        role: 'model',
        parts: [{ text: 'Understood. I am ProChat AI, your intelligent and friendly virtual chat companion. I will keep my responses concise, helpful, and highly conversational!' }]
      }
    ];

    // Append context-aware history
    history.forEach((msg) => {
      if (msg.sender && msg.text) {
        formattedHistory.push({
          role: msg.role === 'model' ? 'model' : 'user',
          parts: [{ text: msg.text }],
        });
      }
    });

    const chat = model.startChat({
      history: formattedHistory,
    });

    const result = await chat.sendMessage(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error('Gemini Service Error:', error.message);
    throw error;
  }
};

module.exports = {
  genAI,
  getGenAI,
  getModelName,
  generateResponse,
};
