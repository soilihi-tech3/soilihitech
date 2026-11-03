const Redis = require("ioredis");

let redis = null;
let isRedisAvailable = false;

// Fallback in-memory cache: Map<key, { value, expiresAt }>
const memoryCache = new Map();

try {
  const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => {
      if (times > 3) {
        return null; // Stop retrying, switch to memory fallback
      }
      return Math.min(times * 200, 1000);
    },
    enableOfflineQueue: false
  });

  redis.on("connect", () => {
    isRedisAvailable = true;
    console.log("[CACHE] Connecte au serveur Redis avec succes.");
  });

  redis.on("error", (err) => {
    if (isRedisAvailable) {
      console.warn("[CACHE] Redis indisponible. Basculement sur le cache memoire local.");
    }
    isRedisAvailable = false;
  });
} catch (e) {
  isRedisAvailable = false;
  console.warn("[CACHE] Redis non configure. Utilisation du cache memoire local.");
}

// Memory cache cleaner interval (every 60 seconds)
setInterval(() => {
  const now = Date.now();
  for (const [key, item] of memoryCache.entries()) {
    if (item.expiresAt < now) {
      memoryCache.delete(key);
    }
  }
}, 60000);

async function getCache(key) {
  if (isRedisAvailable && redis) {
    try {
      const data = await redis.get(key);
      if (data) return JSON.parse(data);
    } catch (err) {
      isRedisAvailable = false;
    }
  }
  const item = memoryCache.get(key);
  if (item && item.expiresAt > Date.now()) {
    return item.value;
  }
  return null;
}

async function setCache(key, value, ttlSeconds = 300) {
  if (isRedisAvailable && redis) {
    try {
      await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch (err) {
      isRedisAvailable = false;
    }
  }
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000
  });
}

async function clearCachePattern(patternKey) {
  if (isRedisAvailable && redis) {
    try {
      const keys = [];
      await new Promise((resolve, reject) => {
        const stream = redis.scanStream({ match: `*${patternKey}*`, count: 200 });
        stream.on("data", (batch) => keys.push(...batch));
        stream.on("end", resolve);
        stream.on("error", reject);
      });
      if (keys.length > 0) {
        await redis.del(keys);
      }
    } catch (err) {
      isRedisAvailable = false;
    }
  }
  for (const key of memoryCache.keys()) {
    if (key.includes(patternKey)) {
      memoryCache.delete(key);
    }
  }
}

// Express Cache Middleware
function cacheMiddleware(durationSeconds = 120) {
  return async (req, res, next) => {
    if (req.method !== "GET") return next();

    const boutiqueId = req.boutique ? req.boutique.id : "default";
    const cacheKey = `cache:b${boutiqueId}:${req.originalUrl || req.url}`;
    const cachedData = await getCache(cacheKey);

    if (cachedData) {
      res.setHeader("X-Cache", "HIT");
      return res.json(cachedData);
    }

    res.setHeader("X-Cache", "MISS");
    const originalJson = res.json.bind(res);

    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setCache(cacheKey, body, durationSeconds).catch(() => {});
      }
      return originalJson(body);
    };

    next();
  };
}

async function remember(key, ttlSeconds, fetchFn) {
  const cached = await getCache(key);
  if (cached) return cached;
  const fresh = await fetchFn();
  if (fresh) await setCache(key, fresh, ttlSeconds);
  return fresh;
}

async function delCache(key) {
  if (isRedisAvailable && redis) {
    try {
      await redis.del(key);
    } catch (err) {
      isRedisAvailable = false;
    }
  }
  memoryCache.delete(key);
}

module.exports = {
  getCache,
  setCache,
  delCache,
  clearCachePattern,
  cacheMiddleware,
  remember
};

