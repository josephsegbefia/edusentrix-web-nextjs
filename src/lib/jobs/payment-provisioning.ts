import mongoose from "mongoose";
import { ProvisioningJob } from "@/models/ProvisioningJob";
import { School } from "@/models/School";

export async function enqueueSchoolPaymentProvisioning(input: {
  schoolId: mongoose.Types.ObjectId | string;
  requestedBy?: mongoose.Types.ObjectId | string | null;
  /** When set, keep this error on the school (e.g. immediate Paystack attempt failed; queued for retry). */
  queueAfterSyncFailureMessage?: string | null;
  /** Longer technical message for platform operators (stack traces, response bodies). */
  queueAfterSyncFailureDetail?: string | null;
}) {
  const schoolId =
    typeof input.schoolId === "string"
      ? new mongoose.Types.ObjectId(input.schoolId)
      : input.schoolId;
  const now = new Date();

  const existing = await ProvisioningJob.findOne({
    schoolId,
    kind: "paystack_subaccount",
    status: { $in: ["pending", "running", "failed"] },
  }).sort({ updatedAt: -1 });

  if (existing) {
    existing.status = "pending";
    existing.lastError = null;
    existing.nextRunAt = null;
    existing.payload = {
      ...(typeof existing.payload === "object" && existing.payload ? existing.payload : {}),
      requestedBy: input.requestedBy ? String(input.requestedBy) : null,
      requestedAt: now.toISOString(),
    };
    await existing.save();
  } else {
    await ProvisioningJob.create({
      kind: "paystack_subaccount",
      schoolId,
      payload: {
        requestedBy: input.requestedBy ? String(input.requestedBy) : null,
        requestedAt: now.toISOString(),
      },
      status: "pending",
      attempts: 0,
    });
  }

  const detail =
    input.queueAfterSyncFailureDetail ??
    input.queueAfterSyncFailureMessage ??
    null;

  await School.findByIdAndUpdate(schoolId, {
    $set: {
      "billing.status": "unprovisioned",
      "billing.paymentSetup.status": "pending_provisioning",
      "billing.paymentSetup.reviewReason": null,
      "billing.paystack.lastError":
        input.queueAfterSyncFailureMessage ?? null,
      "billing.paystack.lastErrorDetail": detail,
      "billing.paystack.lastErrorAt":
        (input.queueAfterSyncFailureMessage || detail) ? now : null,
      "billing.paymentSetup.lastUpdatedAt": now,
      "billing.paymentSetup.lastUpdatedBy": input.requestedBy || null,
    },
  });
}
