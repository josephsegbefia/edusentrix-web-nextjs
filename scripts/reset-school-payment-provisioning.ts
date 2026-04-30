/**
 * Clear Paystack subaccount linkage and provisioning jobs so the school can run setup again.
 * Always removes billing.paystack.subaccountCode / subaccountId (not only when empty).
 *
 * Usage:
 *   tsx scripts/reset-school-payment-provisioning.ts "St Anthony's School"
 *
 * Env: MONGODB_URI (via .env.local)
 */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import mongoose from "mongoose";
import { connectToDatabase, disconnectDatabase } from "../src/db/connectToDatabase";
import { School } from "../src/models/School";
import { ProvisioningJob } from "../src/models/ProvisioningJob";
import { hasCompleteSchoolBankDetails } from "../src/lib/school-payments/payment-setup";

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function main() {
  const nameArg =
    process.argv[2]?.trim() ||
    process.env.SCHOOL_NAME?.trim() ||
    "St Anthony's School";

  if (!nameArg) {
    throw new Error("Pass school name as first argument or SCHOOL_NAME env.");
  }

  await connectToDatabase();

  let school = await School.findOne({
    name: new RegExp(`^${escapeRegex(nameArg)}$`, "i"),
  });

  if (!school) {
    const tokens = nameArg
      .replace(/\./g, "")
      .split(/\s+/)
      .filter((t) => t.length >= 3)
      .slice(0, 4);
    const loose =
      tokens.length >= 2
        ? new RegExp(tokens.map((t) => escapeRegex(t)).join(".*"), "i")
        : new RegExp(escapeRegex(nameArg), "i");
    const candidates = await School.find({ name: loose })
      .select("name")
      .limit(15)
      .lean();

    if (candidates.length === 1) {
      school = await School.findById(candidates[0]._id);
    } else if (candidates.length > 1) {
      console.error(
        `Multiple matches for "${nameArg}". Pass the exact name or narrow the search:`
      );
      for (const c of candidates) {
        console.error(`  - ${c.name}`);
      }
      process.exitCode = 1;
      await disconnectDatabase();
      return;
    }
  }

  if (!school) {
    console.error(`No school found matching "${nameArg}".`);
    process.exitCode = 1;
    await disconnectDatabase();
    return;
  }

  const now = new Date();

  await ProvisioningJob.updateMany(
    {
      schoolId: school._id,
      kind: "paystack_subaccount",
    },
    {
      $set: {
        status: "done",
        lastError: null,
        nextRunAt: null,
      },
    }
  );

  const nextStatus = hasCompleteSchoolBankDetails(school)
    ? "details_submitted"
    : "not_started";

  await School.findByIdAndUpdate(school._id, {
    $set: {
      "billing.status": "unprovisioned",
      "billing.paymentSetup.status": nextStatus,
      "billing.paystack.subaccountCode": null,
      "billing.paystack.subaccountId": null,
      "billing.paystack.lastError": null,
      "billing.paystack.lastErrorDetail": null,
      "billing.paystack.lastErrorAt": null,
      "billing.paymentSetup.pendingPlatformPayout": null,
      "billing.paymentSetup.reviewReason": null,
      "billing.paymentSetup.lastUpdatedAt": now,
    },
  });

  console.log(
    `OK: ${school.name} — cleared Paystack linkage, paymentSetup.status=${nextStatus}, jobs closed. Re-save payout details if needed, then run "Start setup".`
  );

  await disconnectDatabase();
}

main().catch(async (e) => {
  console.error(e);
  process.exitCode = 1;
  if (mongoose.connection.readyState === 1) {
    await disconnectDatabase();
  }
});
