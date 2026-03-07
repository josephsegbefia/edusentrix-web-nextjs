import "dotenv/config";
import mongoose from "mongoose";
import { computeSubscriptionPricing } from "../lib/platform-billing/subscription-pricing";
import { ensureDefaultSubscriptionTiers } from "../lib/platform-billing/subscription-tiers";
import { School } from "../models/School";
import { SchoolSubscription } from "../models/SchoolSubscription";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not configured");
  }

  await mongoose.connect(uri);

  try {
    const tiers = await ensureDefaultSubscriptionTiers();
    const defaultTier = tiers[0];
    if (!defaultTier) {
      throw new Error("No subscription tier available for migration.");
    }

    const pricing = computeSubscriptionPricing({
      basePriceMinor: defaultTier.priceMinor,
    });
    const [schools, existingSubscriptions] = await Promise.all([
      School.find({}).select("_id name").lean<Array<{ _id: mongoose.Types.ObjectId; name?: string }>>(),
      SchoolSubscription.find({}).select("schoolId").lean<Array<{ schoolId: mongoose.Types.ObjectId }>>(),
    ]);

    const existingSchoolIds = new Set(
      existingSubscriptions.map((row) => String(row.schoolId))
    );
    const inserts = schools
      .filter((school) => !existingSchoolIds.has(String(school._id)))
      .map((school) => ({
        schoolId: school._id,
        tierId: defaultTier._id,
        tierCode: defaultTier.code,
        tierName: defaultTier.name,
        status: "draft" as const,
        basePriceMinor: defaultTier.priceMinor,
        manualPriceOverrideMinor: null,
        discountMode: "none" as const,
        discountValue: null,
        effectivePriceMinor: pricing.finalPriceMinor,
        note: "Backfilled by migrate-subscriptions.ts",
        pilotEndsAt: null,
        updatedBy: null,
        updatedByEmail: "system:migration",
      }));

    if (inserts.length > 0) {
      await SchoolSubscription.insertMany(inserts, { ordered: false });
    }

    console.log(
      JSON.stringify(
        {
          totalSchools: schools.length,
          existingSubscriptions: existingSubscriptions.length,
          insertedSubscriptions: inserts.length,
          defaultTier: {
            id: String(defaultTier._id),
            code: defaultTier.code,
            name: defaultTier.name,
          },
        },
        null,
        2
      )
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
