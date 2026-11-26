const { executeTranslation, executeMultiTranslation } = require('./providers');

// In-Memory Translation Cache (LRU up to 500 items)
const translationCache = new Map();
const MAX_CACHE_SIZE = 500;

// In-flight request deduplication map to prevent multiple identical requests from rapid clicking
const inFlightRequests = new Map();

function getCacheKey(text, targetLanguage) {
  return `${text.trim()}__${(targetLanguage || 'en').trim().toLowerCase()}`;
}

function getFromCache(text, targetLanguage) {
  const key = getCacheKey(text, targetLanguage);
  if (translationCache.has(key)) {
    // Refresh LRU position
    const val = translationCache.get(key);
    translationCache.delete(key);
    translationCache.set(key, val);
    return val;
  }
  return null;
}

function setToCache(text, targetLanguage, translatedText) {
  const key = getCacheKey(text, targetLanguage);
  if (translationCache.size >= MAX_CACHE_SIZE) {
    // Delete oldest entry
    const oldestKey = translationCache.keys().next().value;
    translationCache.delete(oldestKey);
  }
  translationCache.set(key, translatedText);
}

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
    return await executeMultiTranslation(text);
  } catch (error) {
    console.error('Translation Multi Error:', error.message);
    return {
      en: text,
      hi: text,
      fr: text,
      de: text,
      es: text,
    };
  }
};

/**
 * Translate text dynamically into a specified target language
 * Features in-memory caching and in-flight request deduplication
 * @param {string} text - Content to translate
 * @param {string} targetLanguage - Target language name (e.g. 'Hindi', 'Spanish', etc.)
 * @returns {Promise<{ originalText: string, targetLanguage: string, translatedText: string, fromCache?: boolean }>}
 */
const translateToLanguage = async (text, targetLanguage = 'English') => {
  if (!text || text.trim() === '') {
    return {
      originalText: '',
      targetLanguage,
      translatedText: '',
    };
  }

  const trimmedText = text.trim();
  const lang = targetLanguage.trim();

  // 1. Check in-memory cache
  const cached = getFromCache(trimmedText, lang);
  if (cached) {
    return {
      originalText: trimmedText,
      targetLanguage: lang,
      translatedText: cached,
      fromCache: true,
    };
  }

  // 2. In-flight request deduplication
  const cacheKey = getCacheKey(trimmedText, lang);
  if (inFlightRequests.has(cacheKey)) {
    const existingResult = await inFlightRequests.get(cacheKey);
    return {
      originalText: trimmedText,
      targetLanguage: lang,
      translatedText: existingResult,
      fromCache: true,
    };
  }

  // 3. Launch translation with in-flight tracking
  const translationPromise = (async () => {
    try {
      const translated = await executeTranslation(trimmedText, lang);
      setToCache(trimmedText, lang, translated);
      return translated;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, translationPromise);

  const translatedText = await translationPromise;

  return {
    originalText: trimmedText,
    targetLanguage: lang,
    translatedText,
    fromCache: false,
  };
};

module.exports = {
  translateMessage,
  translateToLanguage,
  translationCache,
};
