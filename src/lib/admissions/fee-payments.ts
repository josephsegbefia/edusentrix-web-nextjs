// src/lib/admissions/fee-payments.ts
// Idempotent reconciliation of admissions application fees paid via Paystack.
//
// Two entry points share this code:
//   1. The webhook handler (/api/webhooks/paystack) — pushes from Paystack.
//   2. The verify endpoint (/api/public/admissions/applications/:token/pay/verify)
//      — pulls from Paystack when the user is redirected back after payment.
//
// Both call `markFeePaidByReference` which is safe to call repeatedly with the
// same reference; it will:
//   - Find the application by `feePayment.reference`.
//   - Promote `feeStatus` to `paid` only when not already paid.
//   - Append a single `application.fee_paid` AdmissionEvent (idempotent on event lookup).
//
// We intentionally key on the Paystack reference (which we stamp at init time)
// rather than relying on metadata at verify time so a misconfigured webhook
// can still be reconciled by the redirect.

import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AdmissionApplication } from "@/models/AdmissionApplication";
import { AdmissionEvent } from "@/models/AdmissionEvent";

export type FeeReconciliationOutcome =
  | { status: "already_paid"; applicationId: string }
  | { status: "marked_paid"; applicationId: string }
  | { status: "not_found" }
  | { status: "skipped"; reason: string };

export type ReconciliationInput = {
  reference: string;
  amountMinor: number;
  currency?: string | null;
  paidAt?: Date | null;
  channel?: string | null;
  paystackMeta?: Record<string, unknown> | null;
};

export async function markFeePaidByReference(
  input: ReconciliationInput
): Promise<FeeReconciliationOutcome> {
  await connectToDatabase();

  const reference = input.reference?.trim();
  if (!reference) {
    return { status: "skipped", reason: "missing reference" };
  }

  const application = await AdmissionApplication.findOne({
    "feePayment.reference": reference,
  });
  if (!application) {
    return { status: "not_found" };
  }

  if (application.feeStatus === "paid") {
    return { status: "already_paid", applicationId: String(application._id) };
  }

  if (application.feeStatus === "waived") {
    // Waived means staff already accepted; do not override with an external charge.
    return { status: "skipped", reason: "fee was waived" };
  }

  application.feeStatus = "paid";
  application.feePayment = {
    ...(application.feePayment ?? {
      reference,
      amountMinor: input.amountMinor,
      currency: input.currency ?? "GHS",
      initiatedAt: new Date(),
    }),
    reference,
    amountMinor: input.amountMinor,
    currency: input.currency ?? application.feePayment?.currency ?? "GHS",
    initiatedAt: application.feePayment?.initiatedAt ?? new Date(),
    paidAt: input.paidAt ?? new Date(),
    failedAt: null,
    channel: input.channel ?? application.feePayment?.channel ?? null,
    paystackMeta: input.paystackMeta ?? application.feePayment?.paystackMeta ?? null,
  };
  await application.save();

  // Idempotent event creation — one fee_paid event per reference.
  const existingEvent = await AdmissionEvent.findOne({
    schoolId: application.schoolId,
    cycleId: application.cycleId,
    applicationId: application._id,
    kind: "application.fee_paid",
    "metadata.reference": reference,
  })
    .select({ _id: 1 })
    .lean();

  if (!existingEvent) {
    await AdmissionEvent.create({
      schoolId: application.schoolId,
      cycleId: application.cycleId,
      applicationId: application._id,
      actor: { label: "Paystack", role: "system" },
      kind: "application.fee_paid",
      metadata: {
        reference,
        amountMinor: input.amountMinor,
        currency: input.currency ?? "GHS",
        channel: input.channel ?? null,
      },
    });
  }

  return { status: "marked_paid", applicationId: String(application._id) };
}

export async function markFeeFailedByReference(
  input: ReconciliationInput & { failureReason?: string | null }
): Promise<FeeReconciliationOutcome> {
  await connectToDatabase();
  const reference = input.reference?.trim();
  if (!reference) return { status: "skipped", reason: "missing reference" };

  const application = await AdmissionApplication.findOne({
    "feePayment.reference": reference,
  });
  if (!application) return { status: "not_found" };

  if (application.feeStatus === "paid" || application.feeStatus === "waived") {
    return { status: "skipped", reason: `fee already ${application.feeStatus}` };
  }

  application.feePayment = {
    ...(application.feePayment ?? {
      reference,
      amountMinor: input.amountMinor,
      currency: input.currency ?? "GHS",
      initiatedAt: new Date(),
    }),
    paidAt: null,
    failedAt: input.paidAt ?? new Date(),
    paystackMeta: input.paystackMeta ?? application.feePayment?.paystackMeta ?? null,
  };
  await application.save();

  await AdmissionEvent.create({
    schoolId: application.schoolId,
    cycleId: application.cycleId,
    applicationId: application._id,
    actor: { label: "Paystack", role: "system" },
    kind: "application.fee_failed",
    metadata: {
      reference,
      reason: input.failureReason ?? "Payment failed",
    },
  });

  return { status: "skipped", reason: "marked failed" };
}

/** Generates a unique Paystack reference for an admissions fee transaction. */
export function buildAdmissionsFeeReference(applicationId: Types.ObjectId | string): string {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  const ts = Date.now().toString(36).toUpperCase();
  return `ADM-${String(applicationId).slice(-8).toUpperCase()}-${ts}-${random}`;
}

/** Returns the canonical metadata payload we attach to Paystack init for admissions. */
export function buildAdmissionsFeeMetadata(input: {
  applicationId: string;
  cycleId: string;
  schoolId: string;
  referenceCode: string;
}): Record<string, unknown> {
  return {
    type: "admissions_fee",
    admissionApplicationId: input.applicationId,
    admissionCycleId: input.cycleId,
    schoolId: input.schoolId,
    referenceCode: input.referenceCode,
  };
}
