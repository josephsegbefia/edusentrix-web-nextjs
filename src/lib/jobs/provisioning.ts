/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import mongoose from "mongoose";
import { ProvisioningJob } from "@/models/ProvisioningJob";
import { School } from "@/models/School";
import { createSubaccount } from "@/lib/paystack";

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

async function processPaystackSubaccount(job: any) {
  const school = await School.findById(job.schoolId);
  if (!school) {
    // Nothing to do; mark done to avoid loops
    await ProvisioningJob.findByIdAndUpdate(job._id, {
      $set: { status: "done", lastError: "School not found" },
    });
    return;
  }

  // Idempotency: if school already has subaccount, we’re done
  if (school.billing?.paystack?.subaccountCode) {
    await ProvisioningJob.findByIdAndUpdate(job._id, {
      $set: { status: "done", lastError: null },
    });
    return;
  }

  const bankCode = school.bank?.sortCode; // Paystack bank "code"
  const accountNumber = school.bank?.accountNumber;
  if (!bankCode || !accountNumber) {
    // Missing prerequisites; fail with backoff
    throw new Error("Missing bank code or account number");
  }

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
      "billing.paystack.subaccountCode": result.subaccount_code,
      "billing.paystack.subaccountId": result.id,
      "billing.paystack.lastError": null,
    },
  });

  await ProvisioningJob.findByIdAndUpdate(job._id, {
    $set: { status: "done", lastError: null },
  });
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
          "billing.paystack.lastError": msg,
        },
      });
    }
  }
}
