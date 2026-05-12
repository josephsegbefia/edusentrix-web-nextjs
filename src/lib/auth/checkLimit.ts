import "server-only";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { checkUsageLimit } from "@/lib/billing/check-usage-limit";
import type { SubscriptionLimitKey } from "@/lib/billing/feature-access";

export async function enforceSchoolLimit(input: {
  schoolId: string | mongoose.Types.ObjectId;
  limitKey: SubscriptionLimitKey;
  increment?: number;
  expensive?: boolean;
  message?: string;
}) {
  const increment = Math.max(1, Math.floor(Number(input.increment || 1)));
  const result = await checkUsageLimit({
    schoolId: input.schoolId,
    limitKey: input.limitKey,
    increment,
    expensive: input.expensive,
  });

  if (!result.allowed) {
    throw NextResponse.json(
      {
        success: false,
        error:
          input.message ||
          `The ${input.limitKey} limit has been reached for this subscription.`,
        limitKey: input.limitKey,
        current: result.current,
        limit: result.limit,
        accessMode: result.accessMode,
        reason: result.reason,
      },
      { status: 403 }
    );
  }

  return result;
}
