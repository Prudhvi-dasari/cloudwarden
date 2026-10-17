/**
 * High-Performance Redis Cache Wrapper
 * Provides sub-millisecond link resolution, atomic download counters, and rate limiting.
 * Includes automatic in-memory fallback when REDIS_URL is not provided.
 */

import Redis from 'ioredis';

let redisClient = null;
const memoryCache = new Map();

function getClient() {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;
  if (redisUrl) {
    try {
      redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 2,
        connectTimeout: 5000,
        lazyConnect: true,
      });
      redisClient.connect().catch((err) => {
        console.warn('Redis connection failed, using in-memory cache fallback:', err.message);
        redisClient = null;
      });
    } catch (e) {
      redisClient = null;
    }
  }
  return redisClient;
}

export const cache = {
  /**
   * Set cached metadata with specific TTL (in seconds)
   */
  async set(key, value, ttlSeconds = 3600) {
    const serialized = JSON.stringify(value);
    const client = getClient();

    if (client && client.status === 'ready') {
      try {
        await client.set(key, serialized, 'EX', ttlSeconds);
        return true;
      } catch (e) {}
    }

    // In-memory fallback
    memoryCache.set(key, {
      data: value,
      expires: Date.now() + ttlSeconds * 1000,
    });
    return true;
  },

  /**
   * Get cached metadata
   */
  async get(key) {
    const client = getClient();

    if (client && client.status === 'ready') {
      try {
        const raw = await client.get(key);
        if (raw) return JSON.parse(raw);
      } catch (e) {}
    }

    // In-memory fallback
    const item = memoryCache.get(key);
    if (!item) return null;
    if (Date.now() > item.expires) {
      memoryCache.delete(key);
      return null;
    }
    return item.data;
  },

  /**
   * Invalidate cached key
   */
  async del(key) {
    const client = getClient();
    if (client && client.status === 'ready') {
      try {
        await client.del(key);
      } catch (e) {}
    }
    memoryCache.delete(key);
    return true;
  },

  /**
   * Atomic counter increment (for download tracking & rate limiting)
   */
  async incr(key, ttlSeconds = 86400) {
    const client = getClient();
    if (client && client.status === 'ready') {
      try {
        const val = await client.incr(key);
        if (val === 1 && ttlSeconds) {
          await client.expire(key, ttlSeconds);
        }
        return val;
      } catch (e) {}
    }

    // Memory fallback
    const current = (memoryCache.get(key)?.data || 0) + 1;
    memoryCache.set(key, {
      data: current,
      expires: Date.now() + ttlSeconds * 1000,
    });
    return current;
  },

  /**
   * Fast Link Redirection Cache Helper
   */
  async cacheTransfer(shareId, transferData, expiresAt) {
    const ttlSeconds = Math.max(
      60,
      Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
    );
    await this.set(`transfer:${shareId}`, transferData, ttlSeconds);
  },

  async getCachedTransfer(shareId) {
    return await this.get(`transfer:${shareId}`);
  },

  async invalidateTransfer(shareId) {
    await this.del(`transfer:${shareId}`);
  },
};
