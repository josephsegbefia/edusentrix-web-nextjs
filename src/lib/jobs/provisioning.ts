/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import mongoose from "mongoose";
import { ProvisioningJob } from "@/models/ProvisioningJob";
import { School } from "@/models/School";
import { createSubaccount, resolvePaystackSettlementBankCode } from "@/lib/paystack";
import { isLikelyPaystackSubaccountCode } from "@/lib/school-payments/paystack-subaccount-code";

/** Config */
const MAX_ATTEMPTS = 10;
const STALE_MINUTES = 20; // consider "running" jobs stale after 20m

function backoffMs(attempts: number) {
  // 2^n minutes, cap at 24h
  const minutes = Math.min(2 ** Math.max(0, attempts), 24 * 60);
  return minutes * 60 * 1000;
}

/** Atomically claim one job (pending/expired failed/stale running). */
export async function claimOneJob(session?: mongoose.ClientSession) {
  const now = new Date();
  const staleCutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000);

  const query = {
    $or: [
      { status: "pending" },
      { status: "failed", nextRunAt: { $lte: now } },
      { status: "running", updatedAt: { $lte: staleCutoff } },
    ],
  };

  const update = {
    $set: { status: "running", lastError: null, nextRunAt: null },
    $inc: { attempts: 1 },
  };

  const opts = { new: true, sort: { updatedAt: 1 } as const, session };

  return ProvisioningJob.findOneAndUpdate(query, update, opts);
}

/**
 * Creates the Paystack settlement subaccount for a school when bank details are present.
 * Idempotent: if `subaccountCode` already exists, aligns billing status and returns.
 * Used by the payment-setup API (immediate path) and by the background job worker.
 */
export async function provisionPaystackSubaccountForSchool(input: {
  schoolId: mongoose.Types.ObjectId | string;
  lastUpdatedBy?: mongoose.Types.ObjectId | string | null;
}) {
  const schoolId =
    typeof input.schoolId === "string"
      ? new mongoose.Types.ObjectId(input.schoolId)
      : input.schoolId;

  const school = await School.findById(schoolId);
  if (!school) {
    throw new Error("School not found");
  }

  const existingCode = school.billing?.paystack?.subaccountCode;
  if (isLikelyPaystackSubaccountCode(existingCode)) {
    await School.findByIdAndUpdate(school._id, {
      $set: {
        "billing.status": "provisioned",
        "billing.paymentSetup.status": "provisioned",
        "billing.paymentSetup.lastUpdatedAt": new Date(),
        ...(input.lastUpdatedBy
          ? { "billing.paymentSetup.lastUpdatedBy": input.lastUpdatedBy }
          : {}),
      },
    });
    return;
  }

  const accountNumber = school.bank?.accountNumber;
  if (!accountNumber?.trim()) {
    throw new Error("Missing account number");
  }

  const bankCode = await resolvePaystackSettlementBankCode(
    school.bank?.bankName
  );

  const result = await createSubaccount({
    businessName: school.name,
    bankCode,
    accountNumber,
    percentageCharge: 0,
    contactEmail: undefined,
  });

  await School.findByIdAndUpdate(school._id, {
    $set: {
      "billing.status": "provisioned",
      "billing.paymentSetup.status": "provisioned",
      "billing.paymentSetup.reviewReason": null,
      "billing.paystack.subaccountCode": result.subaccount_code,
      "billing.paystack.subaccountId": result.id,
      "billing.paystack.lastError": null,
      "billing.paymentSetup.lastUpdatedAt": new Date(),
      ...(input.lastUpdatedBy
        ? { "billing.paymentSetup.lastUpdatedBy": input.lastUpdatedBy }
        : {}),
    },
  });
}

async function processPaystackSubaccount(job: any) {
  const school = await School.findById(job.schoolId);
  if (!school) {
    await ProvisioningJob.findByIdAndUpdate(job._id, {
      $set: { status: "done", lastError: "School not found" },
    });
    return;
  }

  try {
    await provisionPaystackSubaccountForSchool({
      schoolId: job.schoolId,
    });
  } catch (e: any) {
    if (e?.message === "School not found") {
      await ProvisioningJob.findByIdAndUpdate(job._id, {
        $set: { status: "done", lastError: "School not found" },
      });
      return;
    }
    throw e;
  }

  await ProvisioningJob.findByIdAndUpdate(job._id, {
    $set: { status: "done", lastError: null },
  });
}

/** After a successful synchronous provision, mark any queued jobs for this school as done. */
export async function markPaystackSubaccountJobsDoneForSchool(
  schoolId: mongoose.Types.ObjectId | string
) {
  const id =
    typeof schoolId === "string"
      ? new mongoose.Types.ObjectId(schoolId)
      : schoolId;
  await ProvisioningJob.updateMany(
    {
      schoolId: id,
      kind: "paystack_subaccount",
      status: { $in: ["pending", "running", "failed"] },
    },
    { $set: { status: "done", lastError: null, nextRunAt: null } }
  );
}

/** Process a single claimed job safely with error handling/backoff. */
export async function processJob(job: any) {
  try {
    switch (job.kind) {
      case "paystack_subaccount":
        await processPaystackSubaccount(job);
        break;
      default:
        // Unknown kind — mark done to avoid poison queue
        await ProvisioningJob.findByIdAndUpdate(job._id, {
          $set: { status: "done", lastError: "Unknown job kind" },
        });
        break;
    }
  } catch (err: any) {
    const msg = err?.message || String(err);
    const attempts = job.attempts ?? 1;
    const nextRunAt =
      attempts >= MAX_ATTEMPTS
        ? null
        : new Date(Date.now() + backoffMs(attempts));

    await ProvisioningJob.findByIdAndUpdate(job._id, {
      $set: {
        status: attempts >= MAX_ATTEMPTS ? "done" : "failed",
        lastError: msg,
        nextRunAt,
      },
    });

    // Also stamp last error on School for visibility (best-effort)
    if (job.kind === "paystack_subaccount" && job.schoolId) {
      await School.findByIdAndUpdate(job.schoolId, {
        $set: {
          "billing.status": attempts >= MAX_ATTEMPTS ? "failed" : "failed",
          "billing.paymentSetup.status": "failed",
          "billing.paystack.lastError": msg,
          "billing.paymentSetup.lastUpdatedAt": new Date(),
        },
      });
    }
  }
}
