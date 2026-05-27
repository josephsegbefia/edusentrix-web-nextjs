import mongoose from "mongoose";
import type { SubscriptionLimitKey } from "@/lib/billing/feature-access";
import type { SubscriptionSnapshot } from "@/lib/billing/entitlements";

export type UsageLimitDecision = {
  allowed: boolean;
  current: number;
  limit: number | null;
  accessMode?: SubscriptionSnapshot["subscription"]["accessMode"];
  reason?: "access_mode_blocked" | "limit_exceeded";
};

/** No subscription limits — always allowed. */
export async function checkUsageLimit(_input: {
  schoolId: string | mongoose.Types.ObjectId;
  limitKey: SubscriptionLimitKey;
  increment?: number;
  expensive?: boolean;
  snapshot?: SubscriptionSnapshot | null;
}): Promise<UsageLimitDecision> {
  return { allowed: true, current: 0, limit: null };
}
