import mongoose from "mongoose";
import {
  checkLimit,
  getSchoolSubscriptionSnapshot,
  type SubscriptionSnapshot,
} from "@/lib/billing/entitlements";
import type { SubscriptionLimitKey } from "@/lib/billing/feature-access";
import { canUseExpensiveAi } from "@/lib/billing/expensive-ai-access";

export type UsageLimitDecision = {
  allowed: boolean;
  current: number;
  limit: number | null;
  accessMode?: SubscriptionSnapshot["subscription"]["accessMode"];
  reason?: "access_mode_blocked" | "limit_exceeded";
};

export async function checkUsageLimit(input: {
  schoolId: string | mongoose.Types.ObjectId;
  limitKey: SubscriptionLimitKey;
  increment?: number;
  expensive?: boolean;
  snapshot?: SubscriptionSnapshot | null;
}): Promise<UsageLimitDecision> {
  const snapshot =
    input.snapshot ?? (await getSchoolSubscriptionSnapshot(input.schoolId));
  const accessMode = snapshot?.subscription.accessMode;

  if (input.expensive && accessMode && !canUseExpensiveAi(accessMode)) {
    return {
      allowed: false,
      current: 0,
      limit: null,
      accessMode,
      reason: "access_mode_blocked",
    };
  }

  const decision = await checkLimit(
    input.schoolId,
    input.limitKey,
    input.increment ?? 1
  );

  return {
    ...decision,
    accessMode,
    reason: decision.allowed ? undefined : "limit_exceeded",
  };
}
