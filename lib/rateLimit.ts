// In-memory, per-IP rate limiting + a per-IP success counter used to decide
// when to challenge with a CAPTCHA. Good enough for a single-instance app /
// hackathon; for multi-instance production swap the Maps for Redis/Upstash.

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20; // per IP per window
const MAX_KEYS = 10_000; // hard cap so the Maps can't grow unbounded

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const planCounts = new Map<string, number>();

export interface RateResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

function prune(now: number): void {
  if (buckets.size < MAX_KEYS) return;
  for (const [key, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(key);
  }
}

/** Fixed-window rate limit. Call once per request. */
export function rateLimit(key: string, now: number = Date.now()): RateResult {
  prune(now);
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_REQUESTS - 1, retryAfterSec: 0 };
  }
  if (bucket.count >= MAX_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }
  bucket.count += 1;
  return { allowed: true, remaining: MAX_REQUESTS - bucket.count, retryAfterSec: 0 };
}

/** Number of plans this client has successfully generated so far. */
export function getPlanCount(key: string): number {
  return planCounts.get(key) ?? 0;
}

export function incrementPlanCount(key: string): number {
  const next = getPlanCount(key) + 1;
  if (planCounts.size >= MAX_KEYS) planCounts.clear();
  planCounts.set(key, next);
  return next;
}

/**
 * A CAPTCHA is required on every 3rd generation (the 3rd, 6th, 9th, …).
 * With N already generated, the next one is the (N+1)th, so require it when
 * (N + 1) is divisible by 3.
 */
export function isCaptchaDue(planCount: number): boolean {
  return (planCount + 1) % 3 === 0;
}
