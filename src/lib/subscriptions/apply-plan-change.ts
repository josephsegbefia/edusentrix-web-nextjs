import "server-only";

import { Types } from "mongoose";
import { Student } from "@/models/Student";
import { SchoolSubscription, type ISchoolSubscription } from "@/models/SchoolSubscription";
import { SubscriptionTier, type ISubscriptionTier } from "@/models/SubscriptionTier";
import {
  computeSubscriptionBasePrice,
  computeSubscriptionPricing,
  type BillingCadence,
} from "@/lib/platform-billing/subscription-pricing";
import { recordSubscriptionEvent } from "./record-event";

function normalizeCadence(value: string | null | undefined): BillingCadence {
  return value === "annual" || value === "monthly" || value === "custom" ? value : "term";
}

export async function applyPlanToSubscription(input: {
  subscription: ISchoolSubscription & { _id: Types.ObjectId };
  targetPlan: ISubscriptionTier & { _id: Types.ObjectId };
  actorEmail?: string | null;
  note?: string | null;
  eventType?: "subscription_upgraded" | "subscription_downgraded" | "subscription_updated";
  eventSummary?: string;
}) {
  const { subscription, targetPlan } = input;
  const studentCountSnapshot = await Student.countDocuments({
    schoolId: subscription.schoolId,
    status: "active",
  });

  const basePriceBreakdown = computeSubscriptionBasePrice({
    studentCount: studentCountSnapshot,
    pricePerStudentPerTermMinor: targetPlan.pricing?.pricePerStudentPerTermMinor ?? null,
    minimumTermFeeMinor: targetPlan.pricing?.minimumTermFeeMinor ?? targetPlan.priceMinor ?? null,
    annualDiscountPercent: targetPlan.pricing?.annualDiscountPercent ?? null,
    billingCadence: normalizeCadence(subscription.billingCadence),
  });

  const pricing = computeSubscriptionPricing({
    basePriceMinor: basePriceBreakdown.basePriceMinor,
    manualPriceOverrideMinor: subscription.manualPriceOverrideMinor,
    discountMode: subscription.discountMode,
    discountValue: subscription.discountValue,
  });

  const updated = await SchoolSubscription.findByIdAndUpdate(
    subscription._id,
    {
      $set: {
        tierId: targetPlan._id,
        tierCode: targetPlan.code,
        tierName: targetPlan.name,
        tierVersion: targetPlan.version ?? 1,
        studentCountSnapshot,
        basePriceMinor: pricing.baseTierPriceMinor,
        effectivePriceMinor: pricing.finalPriceMinor,
        featuresSnapshot: targetPlan.features ?? [],
        includedLimitsSnapshot: targetPlan.limits ?? {},
        pendingPlanChange: null,
        ...(input.note ? { note: input.note } : {}),
        updatedByEmail: input.actorEmail ?? null,
      },
    },
    { new: true, runValidators: true }
  );

  await recordSubscriptionEvent({
    schoolId: subscription.schoolId,
    subscriptionId: subscription._id,
    eventType: input.eventType ?? "subscription_updated",
    actorEmail: input.actorEmail ?? null,
    summary: input.eventSummary ?? `Subscription changed to ${targetPlan.name}.`,
    metadata: {
      targetPlanId: String(targetPlan._id),
      targetPlanCode: targetPlan.code,
      studentCountSnapshot,
      basePriceMinor: pricing.baseTierPriceMinor,
      effectivePriceMinor: pricing.finalPriceMinor,
      pricingBreakdown: basePriceBreakdown,
    },
  });

  return {
    subscription: updated,
    studentCountSnapshot,
    basePriceMinor: pricing.baseTierPriceMinor,
    effectivePriceMinor: pricing.finalPriceMinor,
    pricingBreakdown: basePriceBreakdown,
  };
}

export async function applyDuePendingPlanChanges(options?: {
  now?: Date;
  dryRun?: boolean;
  actorEmail?: string | null;
  schoolId?: string;
}) {
  const now = options?.now ?? new Date();
  const filter: Record<string, unknown> = {
    pendingPlanChange: { $ne: null },
    "pendingPlanChange.effectiveAt": { $lte: now },
  };
  if (options?.schoolId) filter.schoolId = new Types.ObjectId(options.schoolId);

  const due = await SchoolSubscription.find(filter);
  const results: Array<{ schoolId: string; subscriptionId: string; targetPlanCode?: string; applied: boolean; error?: string }> = [];

  for (const sub of due) {
    const pending = sub.pendingPlanChange;
    if (!pending) continue;
    try {
      const targetPlan = await SubscriptionTier.findById(pending.targetTierId);
      if (!targetPlan) {
        results.push({
          schoolId: String(sub.schoolId),
          subscriptionId: String(sub._id),
          targetPlanCode: pending.targetTierCode,
          applied: false,
          error: "Target plan not found.",
        });
        continue;
      }

      if (!options?.dryRun) {
        await applyPlanToSubscription({
          subscription: sub,
          targetPlan,
          actorEmail: options?.actorEmail ?? pending.requestedByEmail ?? "system",
          note: pending.note ?? null,
          eventType: pending.changeKind === "downgrade" ? "subscription_downgraded" : "subscription_updated",
          eventSummary: `Scheduled ${pending.changeKind} to ${targetPlan.name} applied.`,
        });
      }

      results.push({
        schoolId: String(sub.schoolId),
        subscriptionId: String(sub._id),
        targetPlanCode: targetPlan.code,
        applied: !options?.dryRun,
      });
    } catch (error) {
      results.push({
        schoolId: String(sub.schoolId),
        subscriptionId: String(sub._id),
        targetPlanCode: pending.targetTierCode,
        applied: false,
        error: error instanceof Error ? error.message : "Failed to apply pending plan change.",
      });
    }
  }

  return {
    totalDue: due.length,
    applied: results.filter((result) => result.applied).length,
    failed: results.filter((result) => result.error).length,
    dryRun: Boolean(options?.dryRun),
    results,
  };
}
