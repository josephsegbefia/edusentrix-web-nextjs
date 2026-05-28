import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Student } from "@/models/Student";
import { SchoolSubscription } from "@/models/SchoolSubscription";
import { SubscriptionTier } from "@/models/SubscriptionTier";
import { SubscriptionInvoice } from "@/models/SubscriptionInvoice";
import { PLAN_CODES } from "@/lib/subscriptions/plan-codes";
import { computePlanChangeQuote } from "@/lib/subscriptions/plan-change-quote";
import { recordSubscriptionEvent } from "@/lib/subscriptions/record-event";
import { applyPlanToSubscription } from "@/lib/subscriptions/apply-plan-change";

type Params = { params: Promise<{ id: string }> };

const Schema = z.object({
  targetPlanId: z.string().trim().min(1),
  targetBillingCadence: z.enum(["term", "annual"]).optional(),
  apply: z.boolean().default(false),
  note: z.string().trim().max(500).nullable().optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
  const perm = await requirePlatformPermission("platform.subscriptions.manage");
  if (!perm.ok) return perm.res;

  const { id: schoolId } = await params;
  if (!mongoose.Types.ObjectId.isValid(schoolId)) {
    return NextResponse.json({ success: false, error: "Invalid school ID." }, { status: 400 });
  }

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  if (!mongoose.Types.ObjectId.isValid(parsed.data.targetPlanId)) {
    return NextResponse.json({ success: false, error: "Invalid target plan." }, { status: 400 });
  }

  await connectToDatabase();

  const [sub, targetPlan, studentCount] = await Promise.all([
    SchoolSubscription.findOne({ schoolId }),
    SubscriptionTier.findOne({
      _id: parsed.data.targetPlanId,
      code: { $in: Object.values(PLAN_CODES) },
      active: true,
    }),
    Student.countDocuments({ schoolId: new mongoose.Types.ObjectId(schoolId), status: "active" }),
  ]);

  if (!sub) return NextResponse.json({ success: false, error: "No active subscription found." }, { status: 404 });
  if (!targetPlan) return NextResponse.json({ success: false, error: "Plan not found." }, { status: 404 });

  const quote = computePlanChangeQuote({
    currentSubscription: sub,
    targetPlan,
    targetBillingCadence: parsed.data.targetBillingCadence,
    studentCount,
  });

  if (!parsed.data.apply) {
    return NextResponse.json({ success: true, data: quote });
  }

  if (quote.kind === "downgrade" || (quote.kind === "lateral" && quote.cadenceChange)) {
    await SchoolSubscription.updateOne(
      { _id: sub._id },
      {
        $set: {
          pendingPlanChange: {
            targetTierId: targetPlan._id,
            targetTierCode: targetPlan.code,
            targetTierName: targetPlan.name,
            targetTierVersion: targetPlan.version ?? 1,
            targetBillingCadence: quote.cadenceChange ? quote.targetBillingCadence : null,
            changeKind: quote.kind,
            effectiveAt: quote.scheduledAt ? new Date(quote.scheduledAt) : sub.endsAt ?? new Date(),
            requestedByEmail: perm.actor.email ?? null,
            requestedAt: new Date(),
            note: parsed.data.note ?? null,
            quoteSnapshot: quote,
          },
        },
      },
      { runValidators: true }
    );

    await recordSubscriptionEvent({
      schoolId: sub.schoolId,
      subscriptionId: sub._id,
      eventType: "plan_change_requested",
      actorEmail: perm.actor.email ?? null,
      summary: quote.kind === "downgrade"
        ? `Downgrade to ${targetPlan.name} scheduled for renewal.`
        : `Cadence change to ${quote.targetBillingCadence} scheduled for next term.`,
      metadata: {
        targetPlanId: String(targetPlan._id),
        targetPlanCode: targetPlan.code,
        scheduledAt: quote.scheduledAt,
        quote,
        note: parsed.data.note ?? null,
      },
    });
    return NextResponse.json({ success: true, data: { quote, applied: false, scheduled: true } });
  }

  const applied = await applyPlanToSubscription({
    subscription: sub,
    targetPlan,
    actorEmail: perm.actor.email ?? null,
    note: parsed.data.note ?? null,
    targetBillingCadence: parsed.data.targetBillingCadence ?? null,
    eventType: quote.kind === "upgrade" ? "subscription_upgraded" : "subscription_updated",
    eventSummary: `Subscription changed to ${targetPlan.name}.`,
  });

  let invoice = null;
  if (quote.amountDueNowMinor > 0) {
    invoice = await SubscriptionInvoice.create({
      schoolId: sub.schoolId,
      subscriptionId: sub._id,
      status: "issued",
      currency: "GHS",
      lines: [
        {
          lineType: "plan_charge",
          description: `Prorated ${quote.kind} to ${targetPlan.name}`,
          quantity: 1,
          unitPriceMinor: quote.amountDueNowMinor,
          subtotalMinor: quote.amountDueNowMinor,
          reference: String(targetPlan._id),
        },
      ],
      subtotalMinor: quote.amountDueNowMinor,
      taxMinor: 0,
      totalMinor: quote.amountDueNowMinor,
      billingPeriodStart: new Date(),
      billingPeriodEnd: sub.endsAt ?? null,
      billingCoverage: sub.billingCoverage ?? null,
      issuedAt: new Date(),
      dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      note: "Prorated plan change invoice.",
      createdByEmail: perm.actor.email ?? null,
    });
  }

  if (invoice) {
    await recordSubscriptionEvent({
      schoolId: sub.schoolId,
      subscriptionId: sub._id,
      eventType: "subscription_invoice_issued",
      actorEmail: perm.actor.email ?? null,
      summary: `Prorated plan-change invoice ${invoice.invoiceNumber} issued.`,
      metadata: {
        invoiceId: String(invoice._id),
        invoiceNumber: invoice.invoiceNumber,
        quote,
        appliedPricing: {
          studentCountSnapshot: applied.studentCountSnapshot,
          effectivePriceMinor: applied.effectivePriceMinor,
        },
      },
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      quote,
      applied: true,
      invoice: invoice ? { _id: String(invoice._id), invoiceNumber: invoice.invoiceNumber } : null,
    },
  });
}
