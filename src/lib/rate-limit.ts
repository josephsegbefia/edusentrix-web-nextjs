/* eslint-disable @typescript-eslint/no-explicit-any */
// src/lib/rate-limit.ts
type Hit = { count: number; resetAt: number };
type Key = string;

// NOTE: In serverless this is best-effort (per instance). Good enough as a guard.
// For production, swap to Redis/Upstash/etc.
const store: Map<Key, Hit> =
  (global as any).__rate_limiter_store__ ?? new Map();
if (!(global as any).__rate_limiter_store__) {
  (global as any).__rate_limiter_store__ = store;
}

export function keyFor(ip: string, email: string | undefined, route: string) {
  return `${route}::${ip || "?"}::${(email || "").toLowerCase()}`;
}

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const hit = store.get(key);
  if (!hit || hit.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  if (hit.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: hit.resetAt };
  }
  hit.count++;
  store.set(key, hit);
  return {
    allowed: true,
    remaining: Math.max(0, limit - hit.count),
    resetAt: hit.resetAt,
  };
}
