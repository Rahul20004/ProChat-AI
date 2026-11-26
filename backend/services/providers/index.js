const geminiProvider = require('./gemini.provider');
const alternativeProvider = require('./alternative.provider');

const providers = {
  gemini: geminiProvider,
  alternative: alternativeProvider,
};

/**
 * Get active AI translation provider based on environment configuration
 */
function getActiveProvider() {
  const configuredName = (process.env.AI_TRANSLATION_PROVIDER || process.env.AI_PROVIDER || 'gemini').toLowerCase();
  const provider = providers[configuredName] || providers.gemini;

  if (!provider.isAvailable()) {
    // If selected provider isn't available, check if fallback is explicitly configured
    if (process.env.AI_FALLBACK_ENABLED === 'true' && alternativeProvider.isAvailable()) {
      return alternativeProvider;
    }
  }

  return provider;
}

/**
 * Execute translation with configured provider, and only fall back if explicitly enabled
 */
async function executeTranslation(text, targetLanguage) {
  const primaryProvider = getActiveProvider();

  if (!primaryProvider.isAvailable()) {
    const error = new Error(`AI Provider "${primaryProvider.name}" is not configured. Please check environment variables.`);
    error.status = 401;
    error.code = 'AUTH_ERROR';
    throw error;
  }

  try {
    return await primaryProvider.translate(text, targetLanguage);
  } catch (primaryError) {
    // Check if alternative provider is explicitly enabled for fallback
    const isFallbackEnabled = process.env.AI_FALLBACK_ENABLED === 'true';
    if (
      isFallbackEnabled &&
      primaryProvider.name !== 'alternative' &&
      alternativeProvider.isAvailable()
    ) {
      console.warn(`[AI Provider] Primary provider (${primaryProvider.name}) failed. Engaging alternative provider...`);
      return await alternativeProvider.translate(text, targetLanguage);
    }

    // Do NOT silently switch providers or return fake text; re-throw original error
    throw primaryError;
  }
}

/**
 * Execute multi-language translation
 */
async function executeMultiTranslation(text) {
  const primaryProvider = getActiveProvider();
  if (!primaryProvider.isAvailable()) {
    return { en: text, hi: text, fr: text, de: text, es: text };
  }

  try {
    return await primaryProvider.translateMulti(text);
  } catch (error) {
    if (process.env.AI_FALLBACK_ENABLED === 'true' && alternativeProvider.isAvailable()) {
      try {
        return await alternativeProvider.translateMulti(text);
      } catch (altError) {
        // Fall back to original
        return { en: text, hi: text, fr: text, de: text, es: text };
      }
    }
    throw error;
  }
}

/**
 * Execute summarization with configured provider, and fallback if enabled
 */
async function executeSummarize(text) {
  const primaryProvider = getActiveProvider();

  if (!primaryProvider.isAvailable()) {
    const error = new Error(`AI Provider "${primaryProvider.name}" is not configured. Please check environment variables.`);
    error.status = 401;
    error.code = 'AUTH_ERROR';
    throw error;
  }

  try {
    return await primaryProvider.summarize(text);
  } catch (primaryError) {
    const isFallbackEnabled = process.env.AI_FALLBACK_ENABLED === 'true';
    if (
      isFallbackEnabled &&
      primaryProvider.name !== 'alternative' &&
      alternativeProvider.isAvailable()
    ) {
      console.warn(`[AI Provider] Primary provider (${primaryProvider.name}) failed. Engaging alternative provider for summarization...`);
      return await alternativeProvider.summarize(text);
    }
    throw primaryError;
  }
}

module.exports = {
  getActiveProvider,
  executeTranslation,
  executeMultiTranslation,
  executeSummarize,
  providers,
};
