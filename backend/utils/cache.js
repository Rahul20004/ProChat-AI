/**
 * Smart Shared Cache with In-Memory LRU & Optional Redis Support
 * Features TTL (Time-To-Live), LRU eviction, and in-flight request deduplication.
 */

class SmartCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 1000;
    this.defaultTTLMs = options.defaultTTLMs || 1000 * 60 * 60 * 24; // 24 hours
    this.cache = new Map();
    this.inFlight = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    if (!this.cache.has(key)) {
      this.misses++;
      return null;
    }

    const entry = this.cache.get(key);
    // Check expiration
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Refresh LRU position
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.hits++;
    return entry.value;
  }

  set(key, value, ttlMs = this.defaultTTLMs) {
    if (this.cache.size >= this.maxSize) {
      // Evict oldest item
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : null,
    });
  }

  has(key) {
    return this.get(key) !== null;
  }

  delete(key) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
    this.inFlight.clear();
  }

  /**
   * Execute an operation with in-flight deduplication and automatic caching
   * @param {string} key - Cache key
   * @param {Function} fetcher - Async function returning the fresh value
   * @param {number} ttlMs - Optional TTL
   * @returns {Promise<{ value: any, fromCache: boolean }>}
   */
  async getOrFetch(key, fetcher, ttlMs = this.defaultTTLMs) {
    // 1. Check existing cache
    const cached = this.get(key);
    if (cached !== null && cached !== undefined) {
      return { value: cached, fromCache: true };
    }

    // 2. Check in-flight deduplication
    if (this.inFlight.has(key)) {
      const inFlightPromise = this.inFlight.get(key);
      const value = await inFlightPromise;
      return { value, fromCache: true };
    }

    // 3. Launch operation with deduplication
    const fetchPromise = (async () => {
      try {
        const fresh = await fetcher();
        this.set(key, fresh, ttlMs);
        return fresh;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, fetchPromise);
    const value = await fetchPromise;
    return { value, fromCache: false };
  }

  getStats() {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
    };
  }
}

// Global singletons for translation and summary caches
const translationCache = new SmartCache({ maxSize: 1000, defaultTTLMs: 1000 * 60 * 60 * 48 }); // 48h
const summaryCache = new SmartCache({ maxSize: 500, defaultTTLMs: 1000 * 60 * 60 * 24 }); // 24h

module.exports = {
  SmartCache,
  translationCache,
  summaryCache,
};
