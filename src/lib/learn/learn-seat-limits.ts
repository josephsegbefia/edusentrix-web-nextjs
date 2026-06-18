import "server-only";

import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { LearnStudentAccount } from "@/models/LearnStudentAccount";
import { UsageBalance } from "@/models/UsageBalance";
import { LIMIT_KEYS } from "@/lib/subscriptions/limit-keys";
import { resolveSchoolEntitlements } from "@/lib/subscriptions/resolve-school-entitlements";
import type { LearnSeatEntitlement } from "@/lib/learn/learn-seat-limit-messages";

export type { LearnSeatEntitlement } from "@/lib/learn/learn-seat-limit-messages";
export { formatLearnSeatDeniedMessage } from "@/lib/learn/learn-seat-limit-messages";

function normalizeSchoolId(schoolId: string | mongoose.Types.ObjectId): mongoose.Types.ObjectId {
  return typeof schoolId === "string" ? new mongoose.Types.ObjectId(schoolId) : schoolId;
}

export async function resolveLearnSeatEntitlement(
  schoolId: string | mongoose.Types.ObjectId,
): Promise<LearnSeatEntitlement> {
  await connectToDatabase();

  const schoolOid = normalizeSchoolId(schoolId);
  const snapshot = await resolveSchoolEntitlements(schoolOid);
  const planBase = snapshot?.getLimit(LIMIT_KEYS.learnSeats) ?? 0;

  const balances = await UsageBalance.find({
    schoolId: schoolOid,
    balanceType: "learn_seats",
  })
    .select("includedQuantity purchasedQuantity adjustedQuantity")
    .lean<
      Array<{
        includedQuantity?: number;
        purchasedQuantity?: number;
        adjustedQuantity?: number;
      }>
    >();

  const addonSeats = balances.reduce(
    (sum, row) =>
      sum +
      Math.max(0, row.includedQuantity ?? 0) +
      Math.max(0, row.purchasedQuantity ?? 0) +
      Math.max(0, row.adjustedQuantity ?? 0),
    0,
  );

  const current = await LearnStudentAccount.countDocuments({
    schoolId: schoolOid,
    status: { $ne: "disabled" },
  });

  if (planBase === null) {
    return { current, limit: null, planBase, addonSeats };
  }

  return {
    current,
    limit: planBase + addonSeats,
    planBase,
    addonSeats,
  };
}
