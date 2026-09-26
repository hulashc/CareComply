import { getRedis } from "@/lib/redis";
import { Ratelimit } from "@upstash/ratelimit";

type RateLimitResult = { allowed: boolean; remaining: number; resetIn: number };

const WINDOW_MS = 60_000;

const memStore = new Map<string, { count: number; resetAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of memStore) { if (now > v.resetAt) memStore.delete(k); }
}, 60_000);

function inMemoryLimit(key: string, limit: number): RateLimitResult {
  const now = Date.now();
  const entry = memStore.get(key);
  if (!entry || now > entry.resetAt) {
    memStore.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: limit - 1, resetIn: WINDOW_MS };
  }
  if (entry.count >= limit) return { allowed: false, remaining: 0, resetIn: entry.resetAt - now };
  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetIn: entry.resetAt - now };
}

const redisLimiters = new Map<string, Ratelimit>();

function getRedisLimiter(key: string, limit: number): Ratelimit {
  const existing = redisLimiters.get(key);
  if (existing) return existing;
  const rl = new Ratelimit({
    redis: getRedis()!,
    limiter: Ratelimit.slidingWindow(limit, "60 s"),
    analytics: false,
    prefix: `carecomply:${key}`,
  });
  redisLimiters.set(key, rl);
  return rl;
}

export async function rateLimit(
  key: string,
  limit: number = 10,
): Promise<RateLimitResult> {
  const redis = getRedis();
  if (!redis) return inMemoryLimit(key, limit);

  try {
    const prefix = key.split(":")[0];
    const limiter = getRedisLimiter(prefix, limit);
    const result = await limiter.limit(key);
    return {
      allowed: result.success,
      remaining: result.remaining,
      resetIn: result.reset - Date.now(),
    };
  } catch {
    return inMemoryLimit(key, limit);
  }
}
