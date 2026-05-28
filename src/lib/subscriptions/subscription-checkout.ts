import "server-only";

import { Types } from "mongoose";
import { SubscriptionCheckoutIntent } from "@/models/SubscriptionCheckoutIntent";
import { SubscriptionInvoice } from "@/models/SubscriptionInvoice";
import { SubscriptionTier } from "@/models/SubscriptionTier";
import { recordSubscriptionEvent } from "./record-event";
import { sendSubscriptionReceiptForInvoice } from "./subscription-receipts";
import { applyPlanToSubscription } from "./apply-plan-change";
import { SchoolSubscription } from "@/models/SchoolSubscription";

type VerificationPayload = {
  id?: number;
  reference?: string;
  status?: string;
  amount?: number;
  currency?: string;
  channel?: string;
  paid_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function fulfillSubscriptionCheckoutSuccess(input: {
  reference: string;
  verification: VerificationPayload;
  actorType: "webhook" | "verify";
}) {
  const reference = input.reference.trim();
  if (!reference) return { ok: false, message: "Missing reference." };

  const intent = await SubscriptionCheckoutIntent.findOne({ paystackReference: reference });
  if (!intent) return { ok: false, message: "Subscription checkout intent not found." };

  if (intent.status === "succeeded") {
    return { ok: true, message: "Already fulfilled.", invoiceId: intent.invoiceId ? String(intent.invoiceId) : null };
  }

  const invoice = intent.invoiceId
    ? await SubscriptionInvoice.findById(intent.invoiceId)
    : null;
  if (!invoice) {
    await SubscriptionCheckoutIntent.findByIdAndUpdate(intent._id, {
      $set: { status: "failed", failureReason: "Subscription invoice not found." },
    });
    return { ok: false, message: "Subscription invoice not found." };
  }

  if (String(invoice.schoolId) !== String(intent.schoolId)) {
    await SubscriptionCheckoutIntent.findByIdAndUpdate(intent._id, {
      $set: { status: "failed", failureReason: "Invoice school mismatch." },
    });
    return { ok: false, message: "Invoice school mismatch." };
  }

  const paidAmountMinor = Math.round(Number(input.verification.amount ?? 0));
  if (paidAmountMinor > 0 && paidAmountMinor < invoice.totalMinor) {
    await SubscriptionCheckoutIntent.findByIdAndUpdate(intent._id, {
      $set: { status: "failed", failureReason: "Paid amount is below invoice total." },
    });
    return { ok: false, message: "Paid amount is below invoice total." };
  }

  const paidAt = input.verification.paid_at ? new Date(input.verification.paid_at) : new Date();
  invoice.status = "paid";
  invoice.paidAt = paidAt;
  invoice.paidReference = reference;
  await invoice.save();

  let appliedPlan = null;
  if (intent.subscriptionId && intent.targetTierId) {
    const [sub, targetPlan] = await Promise.all([
      SchoolSubscription.findById(intent.subscriptionId),
      SubscriptionTier.findById(intent.targetTierId),
    ]);
    if (sub && targetPlan && String(sub.tierId) !== String(targetPlan._id)) {
      appliedPlan = await applyPlanToSubscription({
        subscription: sub,
        targetPlan,
        actorEmail: intent.requestedByEmail ?? "subscription-checkout",
        eventType: "subscription_upgraded",
        eventSummary: `Subscription changed to ${targetPlan.name} after online payment.`,
      });
    }
  }

  await SubscriptionCheckoutIntent.findByIdAndUpdate(intent._id, {
    $set: {
      status: "succeeded",
      appliedAt: new Date(),
      failureReason: null,
    },
  });

  await recordSubscriptionEvent({
    schoolId: intent.schoolId as Types.ObjectId,
    subscriptionId: intent.subscriptionId ?? null,
    eventType: "payment_recorded",
    actorEmail: intent.requestedByEmail ?? input.actorType,
    summary: `Subscription invoice ${invoice.invoiceNumber} paid online.`,
    metadata: {
      invoiceId: String(invoice._id),
      invoiceNumber: invoice.invoiceNumber,
      checkoutIntentId: String(intent._id),
      paystackReference: reference,
      amountMinor: invoice.totalMinor,
      gateway: "paystack",
      actorType: input.actorType,
      appliedPlan: appliedPlan
        ? {
            targetTierCode: intent.targetTierCode,
            effectivePriceMinor: appliedPlan.effectivePriceMinor,
          }
        : null,
    },
  });

  try {
    await sendSubscriptionReceiptForInvoice(invoice._id);
  } catch (error) {
    console.error("[subscription-checkout] Receipt send failed", error);
  }

  return { ok: true, message: "Subscription checkout fulfilled.", invoiceId: String(invoice._id) };
}
