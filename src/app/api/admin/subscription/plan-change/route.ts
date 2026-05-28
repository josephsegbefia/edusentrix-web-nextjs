import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Student } from "@/models/Student";
import { User } from "@/models/User";
import { SchoolSubscription } from "@/models/SchoolSubscription";
import { SubscriptionTier } from "@/models/SubscriptionTier";
import { SubscriptionInvoice } from "@/models/SubscriptionInvoice";
import { PLAN_CODES } from "@/lib/subscriptions/plan-codes";
import { computePlanChangeQuote } from "@/lib/subscriptions/plan-change-quote";
import { recordSubscriptionEvent } from "@/lib/subscriptions/record-event";

const Schema = z.object({
  targetPlanId: z.string().trim().min(1),
  targetBillingCadence: z.enum(["term", "annual"]).optional(),
  note: z.string().trim().max(500).optional(),
});

export async function GET() {
  const auth = await requireSchoolAdmin();

  await connectToDatabase();

  const plans = await SubscriptionTier.find({
    code: { $in: [PLAN_CODES.STARTER, PLAN_CODES.GROWTH, PLAN_CODES.ENTERPRISE] },
    active: true,
    publicVisible: true,
  })
    .sort({ sortOrder: 1 })
    .select("_id code name description pricing priceMinor billingCadence limits")
    .lean();

  return NextResponse.json({
    success: true,
    data: plans.map((plan) => ({ ...plan, _id: String(plan._id) })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireSchoolAdmin();

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  if (!mongoose.Types.ObjectId.isValid(parsed.data.targetPlanId)) {
    return NextResponse.json({ success: false, error: "Invalid target plan." }, { status: 400 });
  }

  await connectToDatabase();

  const [sub, targetPlan, studentCount, actor] = await Promise.all([
    SchoolSubscription.findOne({ schoolId: auth.schoolId }),
    SubscriptionTier.findOne({
      _id: parsed.data.targetPlanId,
      code: { $in: [PLAN_CODES.STARTER, PLAN_CODES.GROWTH, PLAN_CODES.ENTERPRISE] },
      active: true,
    }),
    Student.countDocuments({ schoolId: auth.schoolId, status: "active" }),
    User.findById(auth.userId).select("email").lean<{ email?: string | null } | null>(),
  ]);

  if (!sub) return NextResponse.json({ success: false, error: "No active subscription found." }, { status: 404 });
  if (!targetPlan) return NextResponse.json({ success: false, error: "Plan not found." }, { status: 404 });

  const quote = computePlanChangeQuote({
    currentSubscription: sub,
    targetPlan,
    targetBillingCadence: parsed.data.targetBillingCadence,
    studentCount,
  });

  await recordSubscriptionEvent({
    schoolId: sub.schoolId,
    subscriptionId: sub._id,
    eventType: "plan_change_requested",
    actorEmail: actor?.email ?? null,
    summary: `School requested ${quote.kind} to ${targetPlan.name}.`,
    metadata: {
      targetPlanId: String(targetPlan._id),
      targetPlanCode: targetPlan.code,
      quote,
      note: parsed.data.note ?? null,
    },
  });

  let invoice = null;
  let pendingPlanChange = null;
  if (quote.amountDueNowMinor > 0 && quote.kind === "upgrade") {
    invoice = await SubscriptionInvoice.create({
      schoolId: sub.schoolId,
      subscriptionId: sub._id,
      status: "issued",
      currency: "GHS",
      lines: [
        {
          lineType: "plan_charge",
          description: `Prorated upgrade request to ${targetPlan.name}`,
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
      note: parsed.data.note ?? "School-admin requested plan upgrade.",
      createdByEmail: actor?.email ?? null,
    });

    await recordSubscriptionEvent({
      schoolId: sub.schoolId,
      subscriptionId: sub._id,
      eventType: "subscription_invoice_issued",
      actorEmail: actor?.email ?? null,
      summary: `Upgrade invoice ${invoice.invoiceNumber} issued for ${targetPlan.name}.`,
      metadata: {
        invoiceId: String(invoice._id),
        invoiceNumber: invoice.invoiceNumber,
        totalMinor: invoice.totalMinor,
        targetPlanId: String(targetPlan._id),
        targetPlanCode: targetPlan.code,
      },
    });
  } else if (quote.kind === "downgrade" || (quote.kind === "lateral" && quote.cadenceChange)) {
    const effectiveAt = quote.scheduledAt ? new Date(quote.scheduledAt) : sub.endsAt ?? new Date();
    pendingPlanChange = {
      targetTierId: targetPlan._id,
      targetTierCode: targetPlan.code,
      targetTierName: targetPlan.name,
      targetBillingCadence: quote.cadenceChange ? quote.targetBillingCadence : null,
      changeKind: quote.kind,
      effectiveAt,
      requestedAt: new Date(),
      requestedBy: auth.userId,
      requestedByEmail: actor?.email ?? null,
      note: parsed.data.note ?? null,
      quoteSnapshot: quote,
    };
    sub.pendingPlanChange = pendingPlanChange;
    sub.updatedByEmail = actor?.email ?? null;
    await sub.save();
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        quote,
        invoice: invoice
          ? {
              _id: String(invoice._id),
              invoiceNumber: invoice.invoiceNumber,
              totalMinor: invoice.totalMinor,
              status: invoice.status,
            }
          : null,
        pendingPlanChange: pendingPlanChange
          ? {
              targetTierCode: pendingPlanChange.targetTierCode,
              targetTierName: pendingPlanChange.targetTierName,
              changeKind: pendingPlanChange.changeKind,
              effectiveAt: pendingPlanChange.effectiveAt.toISOString(),
            }
          : null,
      },
    },
    { status: 201 }
  );
}
