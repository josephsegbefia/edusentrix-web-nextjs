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
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { School } from "@/models/School";
import { Student } from "@/models/Student";
import { SchoolSubscription } from "@/models/SchoolSubscription";
import { SubscriptionTier } from "@/models/SubscriptionTier";
import { recordSubscriptionEvent } from "@/lib/subscriptions/record-event";
import { SubscriptionInvoice } from "@/models/SubscriptionInvoice";
import { applyPlanToSubscription } from "@/lib/subscriptions/apply-plan-change";
import {
  computeSubscriptionBasePrice,
  computeSubscriptionPricing,
} from "@/lib/platform-billing/subscription-pricing";
import { resolveBillingCoverage } from "@/lib/subscriptions/billing-coverage";

type Params = { params: Promise<{ id: string }> };

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
  const perm = await requirePlatformPermission("platform.subscriptions.manage");
  if (!perm.ok) return perm.res;

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

  const renewalStartsAt = new Date();
  let workingSub = sub;
  let appliedPendingPlanChange: {
    targetPlanCode: string;
    targetPlanName: string;
  } | null = null;

  if (
    sub.pendingPlanChange &&
    sub.pendingPlanChange.effectiveAt.getTime() <= renewalStartsAt.getTime()
  ) {
    const pendingPlan = await SubscriptionTier.findById(sub.pendingPlanChange.targetTierId);
    if (!pendingPlan) {
      return NextResponse.json(
        { success: false, error: "Pending plan change target plan was not found." },
        { status: 409 }
      );
    }
    await applyPlanToSubscription({
      subscription: sub,
      targetPlan: pendingPlan,
      actorEmail: perm.actor.email ?? null,
      note: sub.pendingPlanChange.note ?? null,
      targetBillingCadence: sub.pendingPlanChange.targetBillingCadence ?? null,
      eventType: sub.pendingPlanChange.changeKind === "downgrade" ? "subscription_downgraded" : "subscription_updated",
      eventSummary: `Scheduled ${sub.pendingPlanChange.changeKind} to ${pendingPlan.name} applied during renewal.`,
    });
    appliedPendingPlanChange = {
      targetPlanCode: pendingPlan.code,
      targetPlanName: pendingPlan.name,
    };
    const refreshed = await SchoolSubscription.findById(sub._id);
    if (refreshed) workingSub = refreshed;
  }

  const billingCoverage = await resolveBillingCoverage({
    schoolId,
    billingCadence: workingSub.billingCadence ?? "term",
    startsAt: renewalStartsAt,
    preferNextTerm: true,
  });
  const renewalEndsAt = newEndsAt ? new Date(newEndsAt) : new Date(billingCoverage.endsAt);

  const newGracePeriodEndsAt =
    gracePeriodDays > 0
      ? new Date(renewalEndsAt.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000)
      : null;

  const [plan, studentCountSnapshot] = await Promise.all([
    workingSub.tierId ? SubscriptionTier.findById(workingSub.tierId).lean<any>() : null,
    Student.countDocuments({
      schoolId: new mongoose.Types.ObjectId(schoolId),
      status: "active",
    }),
  ]);

  // Recalculate effective price from the current active student count.
  const resolvedDiscountMode = discountMode ?? workingSub.discountMode;
  const resolvedDiscountValue = discountValue ?? workingSub.discountValue;
  const basePriceBreakdown = computeSubscriptionBasePrice({
    studentCount: studentCountSnapshot,
    pricePerStudentPerTermMinor: plan?.pricing?.pricePerStudentPerTermMinor ?? null,
    minimumTermFeeMinor: plan?.pricing?.minimumTermFeeMinor ?? workingSub.basePriceMinor,
    annualDiscountPercent: plan?.pricing?.annualDiscountPercent ?? null,
    billingCadence: workingSub.billingCadence ?? "term",
  });
  const pricing = computeSubscriptionPricing({
    basePriceMinor: basePriceBreakdown.basePriceMinor,
    manualPriceOverrideMinor,
    discountMode: resolvedDiscountMode,
    discountValue: resolvedDiscountValue,
  });
  const basePriceMinor = pricing.baseTierPriceMinor;
  const effectivePriceMinor = pricing.finalPriceMinor;

  const updateData = {
    status: "active",
    startsAt: renewalStartsAt,
    endsAt: renewalEndsAt,
    gracePeriodEndsAt: newGracePeriodEndsAt,
    manualAccessModeOverride: null,
    studentCountSnapshot,
    basePriceMinor,
    effectivePriceMinor,
    usageResetPolicy: workingSub.billingCadence === "annual" ? "annual" : "term",
    billingCoverage,
    ...(manualPriceOverrideMinor != null ? { manualPriceOverrideMinor } : {}),
    ...(discountMode != null ? { discountMode } : {}),
    ...(discountValue != null ? { discountValue } : {}),
    ...(note ? { note } : {}),
    updatedByEmail: perm.actor.email ?? null,
  };

  await SchoolSubscription.findByIdAndUpdate(workingSub._id, { $set: updateData });

  let invoice = null;
  if (effectivePriceMinor > 0) {
    invoice = await SubscriptionInvoice.create({
      schoolId: new mongoose.Types.ObjectId(schoolId),
      subscriptionId: workingSub._id,
      status: "issued",
      currency: "GHS",
      lines: [
        {
          lineType: "plan_charge",
          description: `${plan?.name ?? workingSub.tierName ?? "Subscription"} renewal (${workingSub.billingCadence ?? "term"})`,
          quantity: 1,
          unitPriceMinor: effectivePriceMinor,
          subtotalMinor: effectivePriceMinor,
          reference: plan?._id ? String(plan._id) : null,
        },
      ],
      subtotalMinor: effectivePriceMinor,
      taxMinor: 0,
      totalMinor: effectivePriceMinor,
      billingPeriodStart: renewalStartsAt,
      billingPeriodEnd: renewalEndsAt,
      billingCoverage,
      issuedAt: new Date(),
      dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      note: note ?? "Subscription renewal invoice.",
      createdByEmail: perm.actor.email ?? null,
    });
  }

  await recordSubscriptionEvent({
    schoolId: new mongoose.Types.ObjectId(schoolId),
    subscriptionId: workingSub._id,
    eventType: "subscription_renewed",
    actorEmail: perm.actor.email ?? null,
    summary: `Subscription renewed by platform admin. New period: ${renewalStartsAt.toDateString()} → ${renewalEndsAt.toDateString()}.${note ? ` Note: ${note}` : ""}`,
    metadata: {
      renewalStartsAt: renewalStartsAt.toISOString(),
      renewalEndsAt: renewalEndsAt.toISOString(),
      gracePeriodEndsAt: newGracePeriodEndsAt?.toISOString() ?? null,
      effectivePriceMinor,
      studentCountSnapshot,
      pricingBreakdown: basePriceBreakdown,
      billingCoverage,
      previousStatus: sub.status,
      appliedPendingPlanChange,
      invoiceId: invoice ? String(invoice._id) : null,
      invoiceNumber: invoice?.invoiceNumber ?? null,
    },
  });

  if (invoice) {
    await recordSubscriptionEvent({
      schoolId: new mongoose.Types.ObjectId(schoolId),
      subscriptionId: workingSub._id,
      eventType: "subscription_invoice_issued",
      actorEmail: perm.actor.email ?? null,
      summary: `Renewal invoice ${invoice.invoiceNumber} issued for ${minorToGHS(effectivePriceMinor)}.`,
      metadata: {
        invoiceId: String(invoice._id),
        invoiceNumber: invoice.invoiceNumber,
        totalMinor: invoice.totalMinor,
        billingPeriodStart: renewalStartsAt.toISOString(),
        billingPeriodEnd: renewalEndsAt.toISOString(),
        billingCoverage,
      },
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      schoolId,
      schoolName: school.name,
      renewalStartsAt: renewalStartsAt.toISOString(),
      renewalEndsAt: renewalEndsAt.toISOString(),
      gracePeriodEndsAt: newGracePeriodEndsAt?.toISOString() ?? null,
      effectivePriceMinor,
      studentCountSnapshot,
      status: "active",
      appliedPendingPlanChange,
      invoice: invoice ? { _id: String(invoice._id), invoiceNumber: invoice.invoiceNumber } : null,
    },
  });
}

function minorToGHS(minor: number) {
  return `GHS ${(minor / 100).toLocaleString("en-GH", { minimumFractionDigits: 2 })}`;
}
