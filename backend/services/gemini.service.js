const { GoogleGenerativeAI } = require('@google/generative-ai');

// Check if Gemini API key exists
if (!process.env.GEMINI_API_KEY) {
  console.warn('WARNING: GEMINI_API_KEY is not defined in environment variables.');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy-key');

/**
 * Generate a chat response using Gemini
 * @param {string} prompt - The user's input message
 * @param {Array} history - Previous messages for conversation history/context
 * @returns {Promise<string>} - The model's response
 */
const generateResponse = async (prompt, history = []) => {
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
      },
    });

    // Format chat history for Gemini API
    // Gemini history format is: [ { role: 'user' | 'model', parts: [{ text: string }] } ]
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
      // Avoid system-level instructions in regular message history formatting
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
    console.error('Gemini Service Error:', error);
    throw new Error(`AI generation failed: ${error.message}`);
  }
};

module.exports = {
  genAI,
  generateResponse,
};
