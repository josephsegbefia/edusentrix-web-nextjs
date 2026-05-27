import "server-only";
import mongoose from "mongoose";
import type { SubscriptionLimitKey } from "@/lib/billing/feature-access";

/** No subscription limits — always allowed. */
export async function enforceSchoolLimit(_input: {
  schoolId: string | mongoose.Types.ObjectId;
  limitKey: SubscriptionLimitKey;
  increment?: number;
  expensive?: boolean;
  message?: string;
}) {
  return { allowed: true, current: 0, limit: null as number | null };
}
