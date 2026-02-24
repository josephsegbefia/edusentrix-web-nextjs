import { createHash } from "crypto";
import mongoose from "mongoose";
import { AIFeatureCache } from "@/models/AIFeatureCache";
import {
  AIFeatureUsageEvent,
  type IAIFeatureUsageEvent,
} from "@/models/AIFeatureUsageEvent";

const DEFAULT_DAILY_TOKEN_CAP = 120_000;
const DEFAULT_DAILY_REQUEST_CAP = 120;
const MIN_TOKEN_RESERVE = 800;

function toPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export const AI_BUDGET = {
  tokenCapPerDay: toPositiveInt(
    process.env.AI_DAILY_TOKEN_CAP_PER_SCHOOL,
    DEFAULT_DAILY_TOKEN_CAP
  ),
  requestCapPerDay: toPositiveInt(
    process.env.AI_DAILY_REQUEST_CAP_PER_SCHOOL,
    DEFAULT_DAILY_REQUEST_CAP
  ),
  minTokenReserve: MIN_TOKEN_RESERVE,
  usdPerMillionTokens: Number(process.env.AI_USD_PER_1M_TOKENS || "0.30"),
};

export type AIBudgetSnapshot = {
  dateKey: string;
  tokenCapPerDay: number;
  requestCapPerDay: number;
  tokensUsedToday: number;
  requestsUsedToday: number;
  tokensRemainingToday: number;
  requestsRemainingToday: number;
  estimatedCostUsdToday: number;
  canGenerate: boolean;
  reason: string | null;
};

type TokenUsage = IAIFeatureUsageEvent["tokenUsage"];

function startOfUtcDay() {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
  );
}

function dateKeyUtc() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

export async function getSchoolAIBudgetSnapshot(
  schoolId: mongoose.Types.ObjectId
): Promise<AIBudgetSnapshot> {
  const usageRows = await AIFeatureUsageEvent.aggregate<{
    totalTokens: number;
    requests: number;
  }>([
    {
      $match: {
        schoolId,
        generatedAt: { $gte: startOfUtcDay() },
      },
    },
    {
      $group: {
        _id: null,
        totalTokens: { $sum: { $ifNull: ["$tokenUsage.totalTokens", 0] } },
        requests: { $sum: 1 },
      },
    },
  ]);

  let tokensUsedToday = Number(usageRows[0]?.totalTokens || 0);
  let requestsUsedToday = Number(usageRows[0]?.requests || 0);

  // Backward compatibility: if no usage events exist yet, approximate from cache rows.
  if (tokensUsedToday === 0 && requestsUsedToday === 0) {
    const cacheRows = await AIFeatureCache.aggregate<{
      totalTokens: number;
      requests: number;
    }>([
      {
        $match: {
          schoolId,
          generatedAt: { $gte: startOfUtcDay() },
        },
      },
      {
        $group: {
          _id: null,
          totalTokens: { $sum: { $ifNull: ["$tokenUsage.totalTokens", 0] } },
          requests: { $sum: 1 },
        },
      },
    ]);

    tokensUsedToday = Number(cacheRows[0]?.totalTokens || 0);
    requestsUsedToday = Number(cacheRows[0]?.requests || 0);
  }
  const tokensRemainingToday = Math.max(
    0,
    AI_BUDGET.tokenCapPerDay - tokensUsedToday
  );
  const requestsRemainingToday = Math.max(
    0,
    AI_BUDGET.requestCapPerDay - requestsUsedToday
  );
  const estimatedCostUsdToday =
    (tokensUsedToday / 1_000_000) * AI_BUDGET.usdPerMillionTokens;

  let reason: string | null = null;
  if (requestsRemainingToday <= 0) {
    reason = "Daily AI generation request cap reached for this school.";
  } else if (tokensRemainingToday < AI_BUDGET.minTokenReserve) {
    reason = "Daily AI token budget is exhausted for this school.";
  }

  return {
    dateKey: dateKeyUtc(),
    tokenCapPerDay: AI_BUDGET.tokenCapPerDay,
    requestCapPerDay: AI_BUDGET.requestCapPerDay,
    tokensUsedToday,
    requestsUsedToday,
    tokensRemainingToday,
    requestsRemainingToday,
    estimatedCostUsdToday: Number(estimatedCostUsdToday.toFixed(4)),
    canGenerate: !reason,
    reason,
  };
}

export async function recordAIFeatureUsage(params: {
  schoolId: mongoose.Types.ObjectId;
  feature: "fees_account_brief" | "fees_reminder_template";
  scopeType: "school" | "student";
  scopeId?: mongoose.Types.ObjectId | null;
  variantKey: string;
  generatedBy?: mongoose.Types.ObjectId | null;
  modelUsed?: string | null;
  tokenUsage?: TokenUsage | null;
}) {
  const tokenUsage = params.tokenUsage || {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  return AIFeatureUsageEvent.create({
    schoolId: params.schoolId,
    feature: params.feature,
    scopeType: params.scopeType,
    scopeId: params.scopeId || null,
    variantKey: params.variantKey,
    generatedBy: params.generatedBy || null,
    modelUsed: params.modelUsed || null,
    tokenUsage: {
      promptTokens: Math.max(0, Number(tokenUsage.promptTokens || 0)),
      completionTokens: Math.max(0, Number(tokenUsage.completionTokens || 0)),
      totalTokens: Math.max(0, Number(tokenUsage.totalTokens || 0)),
    },
  });
}

export function hashFingerprint(payload: unknown) {
  const serialized = JSON.stringify(payload);
  return createHash("sha256").update(serialized).digest("hex");
}

export function isCacheFresh(expiresAt?: Date | null) {
  if (!expiresAt) return true;
  return expiresAt.getTime() > Date.now();
}
