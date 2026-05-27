/**
 * Platform API — school subscription management.
 *
 * GET  /api/platform/schools/[id]/subscription — get current subscription
 * POST /api/platform/schools/[id]/subscription — assign or update subscription
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { School } from "@/models/School";
import { SchoolSubscription } from "@/models/SchoolSubscription";
import { SubscriptionTier } from "@/models/SubscriptionTier";
import { recordSubscriptionEvent } from "@/lib/subscriptions/record-event";
import { normaliseSubscriptionStatus, isKnownPlanCode } from "@/lib/subscriptions/plan-codes";

const AssignSubscriptionSchema = z.object({
  planId: z.string().trim().min(1, "Plan is required"),
  lifecycleMode: z.enum(["pilot", "paid", "custom"]).default("paid"),
  billingCadence: z.enum(["term", "annual", "monthly", "custom"]).default("term"),
  startsAt: z.string().datetime({ offset: true }).nullable().optional(),
  endsAt: z.string().datetime({ offset: true }).nullable().optional(),
  pilotEndsAt: z.string().datetime({ offset: true }).nullable().optional(),
  gracePeriodDays: z.number().int().min(0).max(90).default(14),
  manualPriceOverrideMinor: z.number().int().min(0).nullable().optional(),
  discountMode: z.enum(["none", "percent", "fixed"]).default("none"),
  discountValue: z.number().min(0).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

type Params = { params: Promise<{ id: string }> };

// GET — return current subscription for the school
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  const perm = await requirePlatformPermission(auth.userId, "platform.billing.read");
  if (!perm.success) {
    return NextResponse.json({ success: false, error: perm.error }, { status: 403 });
  }

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, error: "Invalid school ID." }, { status: 400 });
  }

  await connectToDatabase();

  const [school, sub, events] = await Promise.all([
    School.findById(id).select("name status").lean<any>(),
    SchoolSubscription.findOne({ schoolId: id }).lean<any>(),
    SubscriptionEvent.find({ schoolId: id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean<any[]>(),
  ]);

  if (!school) {
    return NextResponse.json({ success: false, error: "School not found." }, { status: 404 });
  }

  // Fetch plan details if subscription exists
  let plan = null;
  if (sub?.tierId) {
    plan = await SubscriptionTier.findById(sub.tierId).lean<any>();
  }

  return NextResponse.json({
    success: true,
    data: {
      school: { id: String(school._id), name: school.name, status: school.status },
      subscription: sub
        ? {
            ...sub,
            _id: String(sub._id),
            schoolId: String(sub.schoolId),
            tierId: sub.tierId ? String(sub.tierId) : null,
          }
        : null,
      plan,
      events: events.map((e) => ({
        ...e,
        _id: String(e._id),
        schoolId: String(e.schoolId),
        subscriptionId: e.subscriptionId ? String(e.subscriptionId) : null,
      })),
    },
  });
}

// POST — assign or update subscription
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
  const parsed = AssignSubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  if (!mongoose.Types.ObjectId.isValid(parsed.data.planId)) {
    return NextResponse.json({ success: false, error: "Invalid plan ID." }, { status: 400 });
  }

  await connectToDatabase();

  const [school, plan] = await Promise.all([
    School.findById(schoolId).select("name status").lean<any>(),
    SubscriptionTier.findById(parsed.data.planId).lean<any>(),
  ]);

  if (!school) {
    return NextResponse.json({ success: false, error: "School not found." }, { status: 404 });
  }
  if (!plan) {
    return NextResponse.json({ success: false, error: "Plan not found." }, { status: 404 });
  }

  const {
    planId,
    lifecycleMode,
    billingCadence,
    startsAt,
    endsAt,
    pilotEndsAt,
    gracePeriodDays,
    manualPriceOverrideMinor,
    discountMode,
    discountValue,
    note,
  } = parsed.data;

  const startsAtDate = startsAt ? new Date(startsAt) : new Date();
  const endsAtDate = endsAt ? new Date(endsAt) : null;
  const pilotEndsAtDate = pilotEndsAt ? new Date(pilotEndsAt) : null;

  // Calculate grace period end
  const gracePeriodEndsAt =
    endsAtDate && gracePeriodDays > 0
      ? new Date(endsAtDate.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000)
      : null;

  // Determine status
  const status = lifecycleMode === "pilot" ? "pilot" : "active";

  // Calculate effective price
  const basePriceMinor = plan.pricing?.minimumTermFeeMinor ?? plan.priceMinor ?? 0;
  let effectivePriceMinor = manualPriceOverrideMinor ?? basePriceMinor;

  if (discountMode === "percent" && discountValue) {
    effectivePriceMinor = Math.round(effectivePriceMinor * (1 - discountValue / 100));
  } else if (discountMode === "fixed" && discountValue) {
    effectivePriceMinor = Math.max(0, effectivePriceMinor - discountValue);
  }

  const existingSub = await SchoolSubscription.findOne({ schoolId });
  const isUpdate = !!existingSub;

  // Snapshot features from plan
  const featuresSnapshot: string[] = plan.features ?? [];
  const limitsSnapshot: Record<string, number | null> = plan.limits ?? {};

  const subData = {
    schoolId: new mongoose.Types.ObjectId(schoolId),
    tierId: new mongoose.Types.ObjectId(planId),
    tierCode: plan.code,
    tierName: plan.name,
    tierVersion: plan.version ?? 1,
    status,
    lifecycleMode,
    billingCadence,
    startsAt: startsAtDate,
    endsAt: endsAtDate,
    pilotEndsAt: pilotEndsAtDate,
    gracePeriodEndsAt,
    basePriceMinor,
    manualPriceOverrideMinor: manualPriceOverrideMinor ?? null,
    discountMode,
    discountValue: discountValue ?? null,
    effectivePriceMinor,
    featuresSnapshot,
    includedLimitsSnapshot: limitsSnapshot,
    note: note ?? null,
    updatedBy: null,
    updatedByEmail: auth.email ?? null,
  };

  let subscription;
  if (isUpdate) {
    subscription = await SchoolSubscription.findByIdAndUpdate(
      existingSub._id,
      { $set: subData },
      { new: true, runValidators: true }
    );
  } else {
    subscription = await SchoolSubscription.create(subData);
  }

  // Record subscription event
  await recordSubscriptionEvent({
    schoolId: new mongoose.Types.ObjectId(schoolId),
    subscriptionId: subscription!._id,
    eventType: isUpdate ? "subscription_updated" : "subscription_assigned",
    actorEmail: auth.email ?? null,
    summary: isUpdate
      ? `Subscription updated to ${plan.name} (${plan.code}) by platform admin.`
      : `Subscription assigned: ${plan.name} (${plan.code}) — ${lifecycleMode} mode.`,
    metadata: {
      planCode: plan.code,
      lifecycleMode,
      billingCadence,
      effectivePriceMinor,
      startsAt: startsAtDate.toISOString(),
      endsAt: endsAtDate?.toISOString() ?? null,
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      ...subscription!.toObject(),
      _id: String(subscription!._id),
    },
  });
}
