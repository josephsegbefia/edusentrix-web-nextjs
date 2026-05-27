/**
 * POST /api/platform/schools/[id]/subscription/renew
 *
 * Manually renew a school's subscription for the next term/period.
 *
 * Renewal logic:
 *  1. Find the current subscription.
 *  2. Set new endsAt based on the billingCadence (term = +120 days, annual = +365 days,
 *     monthly = +31 days, custom = use body.newEndsAt).
 *  3. Set status back to "active".
 *  4. Clear gracePeriodEndsAt / manualAccessModeOverride.
 *  5. Recompute gracePeriodEndsAt = new endsAt + gracePeriodDays.
 *  6. Record renewal event.
 *
 * The body can override the new endsAt date, billing cadence, price, and discount.
 *
 * Spec §11.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { School } from "@/models/School";
import { SchoolSubscription } from "@/models/SchoolSubscription";
import { recordSubscriptionEvent } from "@/lib/subscriptions/record-event";

type Params = { params: Promise<{ id: string }> };

const CADENCE_DAYS: Record<string, number> = {
  term: 120,
  annual: 365,
  monthly: 31,
};

const RenewSchema = z.object({
  newEndsAt: z.string().datetime({ offset: true }).nullable().optional(),
  gracePeriodDays: z.number().int().min(0).max(90).default(14),
  manualPriceOverrideMinor: z.number().int().min(0).nullable().optional(),
  discountMode: z.enum(["none", "percent", "fixed"]).optional(),
  discountValue: z.number().min(0).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
  confirmedByPlatformAdmin: z.boolean().default(false),
});

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  const perm = await requirePlatformPermission(auth.userId, "platform.subscriptions.manage");
  if (!perm.success) {
    return NextResponse.json({ success: false, error: perm.error }, { status: 403 });
  }

  const { id: schoolId } = await params;
  if (!mongoose.Types.ObjectId.isValid(schoolId)) {
    return NextResponse.json({ success: false, error: "Invalid school ID." }, { status: 400 });
  }

  const body = await req.json();
  const parsed = RenewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  await connectToDatabase();

  const [school, sub] = await Promise.all([
    School.findById(schoolId).select("name").lean<{ _id: mongoose.Types.ObjectId; name?: string } | null>(),
    SchoolSubscription.findOne({ schoolId: new mongoose.Types.ObjectId(schoolId) }),
  ]);

  if (!school) {
    return NextResponse.json({ success: false, error: "School not found." }, { status: 404 });
  }
  if (!sub) {
    return NextResponse.json({ success: false, error: "No subscription found for this school." }, { status: 404 });
  }

  const {
    newEndsAt,
    gracePeriodDays,
    manualPriceOverrideMinor,
    discountMode,
    discountValue,
    note,
  } = parsed.data;

  // Calculate new period
  const renewalStartsAt = new Date();

  let renewalEndsAt: Date | null = null;
  if (newEndsAt) {
    renewalEndsAt = new Date(newEndsAt);
  } else {
    const cadenceDays = CADENCE_DAYS[sub.billingCadence ?? "term"] ?? 120;
    renewalEndsAt = new Date(renewalStartsAt.getTime() + cadenceDays * 24 * 60 * 60 * 1000);
  }

  const newGracePeriodEndsAt =
    gracePeriodDays > 0
      ? new Date(renewalEndsAt.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000)
      : null;

  // Recalculate effective price
  let basePriceMinor = sub.basePriceMinor;
  let effectivePriceMinor = manualPriceOverrideMinor ?? sub.effectivePriceMinor;
  const resolvedDiscountMode = discountMode ?? sub.discountMode;
  const resolvedDiscountValue = discountValue ?? sub.discountValue;

  if (resolvedDiscountMode === "percent" && resolvedDiscountValue) {
    effectivePriceMinor = Math.round(basePriceMinor * (1 - resolvedDiscountValue / 100));
  } else if (resolvedDiscountMode === "fixed" && resolvedDiscountValue) {
    effectivePriceMinor = Math.max(0, basePriceMinor - resolvedDiscountValue);
  }

  const updateData = {
    status: "active",
    startsAt: renewalStartsAt,
    endsAt: renewalEndsAt,
    gracePeriodEndsAt: newGracePeriodEndsAt,
    manualAccessModeOverride: null,
    effectivePriceMinor,
    ...(manualPriceOverrideMinor != null ? { manualPriceOverrideMinor } : {}),
    ...(discountMode != null ? { discountMode } : {}),
    ...(discountValue != null ? { discountValue } : {}),
    ...(note ? { note } : {}),
    updatedByEmail: auth.email ?? null,
  };

  await SchoolSubscription.findByIdAndUpdate(sub._id, { $set: updateData });

  await recordSubscriptionEvent({
    schoolId: new mongoose.Types.ObjectId(schoolId),
    subscriptionId: sub._id,
    eventType: "subscription_renewed",
    actorEmail: auth.email ?? null,
    summary: `Subscription renewed by platform admin. New period: ${renewalStartsAt.toDateString()} → ${renewalEndsAt.toDateString()}.${note ? ` Note: ${note}` : ""}`,
    metadata: {
      renewalStartsAt: renewalStartsAt.toISOString(),
      renewalEndsAt: renewalEndsAt.toISOString(),
      gracePeriodEndsAt: newGracePeriodEndsAt?.toISOString() ?? null,
      effectivePriceMinor,
      previousStatus: sub.status,
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      schoolId,
      schoolName: school.name,
      renewalStartsAt: renewalStartsAt.toISOString(),
      renewalEndsAt: renewalEndsAt.toISOString(),
      gracePeriodEndsAt: newGracePeriodEndsAt?.toISOString() ?? null,
      effectivePriceMinor,
      status: "active",
    },
  });
}
