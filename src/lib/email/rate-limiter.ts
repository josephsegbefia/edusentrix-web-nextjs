import "server-only";

import { EmailRateWindow } from "@/models/EmailRateWindow";

export interface RateLimitConfig {
  scopeType: "global" | "school" | "user" | "sender_family";
  scopeKey: string;
  trafficClass: "transactional" | "manual" | "bulk" | "digest";
  windowMinutes: number;
  maxSentPerWindow: number;
}

const DEFAULT_LIMITS: RateLimitConfig[] = [
  { scopeType: "global", scopeKey: "platform", trafficClass: "transactional", windowMinutes: 60, maxSentPerWindow: 3000 },
  { scopeType: "global", scopeKey: "platform", trafficClass: "bulk", windowMinutes: 60, maxSentPerWindow: 1000 },
  { scopeType: "global", scopeKey: "platform", trafficClass: "digest", windowMinutes: 60, maxSentPerWindow: 500 },
  { scopeType: "school", scopeKey: "*", trafficClass: "transactional", windowMinutes: 60, maxSentPerWindow: 500 },
  { scopeType: "school", scopeKey: "*", trafficClass: "bulk", windowMinutes: 60, maxSentPerWindow: 200 },
  { scopeType: "school", scopeKey: "*", trafficClass: "digest", windowMinutes: 60, maxSentPerWindow: 100 },
];

function getWindowStart(now: Date, windowMinutes: number): Date {
  const ms = now.getTime();
  const windowMs = windowMinutes * 60 * 1000;
  return new Date(Math.floor(ms / windowMs) * windowMs);
}

function getLimitsForScope(
  scopeType: "global" | "school",
  scopeKey: string,
  trafficClass: "transactional" | "manual" | "bulk" | "digest",
): RateLimitConfig[] {
  return DEFAULT_LIMITS.filter(
    (l) =>
      l.scopeType === scopeType &&
      (l.scopeKey === scopeKey || l.scopeKey === "*") &&
      l.trafficClass === trafficClass,
  );
}

export interface RateLimitCheckResult {
  allowed: boolean;
  retryAfterMs?: number;
  scope?: string;
  currentCount?: number;
  limit?: number;
}

/**
 * Check whether sending is allowed under all applicable rate limits.
 * Does NOT increment counters — call `recordSend` after successful dispatch.
 */
export async function checkRateLimit(opts: {
  schoolId?: string | null;
  trafficClass: "transactional" | "manual" | "bulk" | "digest";
}): Promise<RateLimitCheckResult> {
  const now = new Date();

  const globalLimits = getLimitsForScope("global", "platform", opts.trafficClass);
  for (const limit of globalLimits) {
    const windowStart = getWindowStart(now, limit.windowMinutes);
    const window = await EmailRateWindow.findOne({
      scopeType: "global",
      scopeKey: "platform",
      trafficClass: opts.trafficClass,
      windowStart,
    }).lean();

    const currentCount = window?.sentCount ?? 0;
    if (currentCount >= limit.maxSentPerWindow) {
      const windowEndMs = windowStart.getTime() + limit.windowMinutes * 60 * 1000;
      return {
        allowed: false,
        retryAfterMs: windowEndMs - now.getTime(),
        scope: `global:platform:${opts.trafficClass}`,
        currentCount,
        limit: limit.maxSentPerWindow,
      };
    }
  }

  if (opts.schoolId) {
    const schoolLimits = getLimitsForScope("school", opts.schoolId, opts.trafficClass);
    for (const limit of schoolLimits) {
      const windowStart = getWindowStart(now, limit.windowMinutes);
      const window = await EmailRateWindow.findOne({
        scopeType: "school",
        scopeKey: opts.schoolId,
        trafficClass: opts.trafficClass,
        windowStart,
      }).lean();

      const currentCount = window?.sentCount ?? 0;
      if (currentCount >= limit.maxSentPerWindow) {
        const windowEndMs = windowStart.getTime() + limit.windowMinutes * 60 * 1000;
        return {
          allowed: false,
          retryAfterMs: windowEndMs - now.getTime(),
          scope: `school:${opts.schoolId}:${opts.trafficClass}`,
          currentCount,
          limit: limit.maxSentPerWindow,
        };
      }
    }
  }

  return { allowed: true };
}

/**
 * Increment send counters for all applicable rate windows after a successful send.
 * Uses upsert to lazily create windows.
 */
export async function recordSend(opts: {
  schoolId?: string | null;
  trafficClass: "transactional" | "manual" | "bulk" | "digest";
}): Promise<void> {
  const now = new Date();

  const globalLimits = getLimitsForScope("global", "platform", opts.trafficClass);
  for (const limit of globalLimits) {
    const windowStart = getWindowStart(now, limit.windowMinutes);
    await EmailRateWindow.findOneAndUpdate(
      {
        scopeType: "global",
        scopeKey: "platform",
        trafficClass: opts.trafficClass,
        windowStart,
      },
      {
        $inc: { sentCount: 1 },
        $setOnInsert: { windowMinutes: limit.windowMinutes },
      },
      { upsert: true },
    );
  }

  if (opts.schoolId) {
    const schoolLimits = getLimitsForScope("school", opts.schoolId, opts.trafficClass);
    for (const limit of schoolLimits) {
      const windowStart = getWindowStart(now, limit.windowMinutes);
      await EmailRateWindow.findOneAndUpdate(
        {
          scopeType: "school",
          scopeKey: opts.schoolId,
          trafficClass: opts.trafficClass,
          windowStart,
        },
        {
          $inc: { sentCount: 1 },
          $setOnInsert: { windowMinutes: limit.windowMinutes },
        },
        { upsert: true },
      );
    }
  }
}

/**
 * Record a bounce or complaint against the rate windows
 * so that reputation-sensitive decisions can factor them in.
 */
export async function recordBounceOrComplaint(opts: {
  schoolId?: string | null;
  trafficClass: "transactional" | "manual" | "bulk" | "digest";
  kind: "bounce" | "complaint";
}): Promise<void> {
  const now = new Date();
  const field = opts.kind === "bounce" ? "bounceCount" : "complaintCount";

  const globalLimits = getLimitsForScope("global", "platform", opts.trafficClass);
  for (const limit of globalLimits) {
    const windowStart = getWindowStart(now, limit.windowMinutes);
    await EmailRateWindow.findOneAndUpdate(
      {
        scopeType: "global",
        scopeKey: "platform",
        trafficClass: opts.trafficClass,
        windowStart,
      },
      {
        $inc: { [field]: 1 },
        $setOnInsert: { windowMinutes: limit.windowMinutes },
      },
      { upsert: true },
    );
  }

  if (opts.schoolId) {
    const schoolLimits = getLimitsForScope("school", opts.schoolId, opts.trafficClass);
    for (const limit of schoolLimits) {
      const windowStart = getWindowStart(now, limit.windowMinutes);
      await EmailRateWindow.findOneAndUpdate(
        {
          scopeType: "school",
          scopeKey: opts.schoolId,
          trafficClass: opts.trafficClass,
          windowStart,
        },
        {
          $inc: { [field]: 1 },
          $setOnInsert: { windowMinutes: limit.windowMinutes },
        },
        { upsert: true },
      );
    }
  }
}
