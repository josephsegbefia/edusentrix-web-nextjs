#!/usr/bin/env tsx
/**
 * seed-subscription-plans.ts
 *
 * Seeds the four canonical EduSentrix subscription plans into the
 * SubscriptionTier collection.
 *
 * Run:  npx tsx scripts/seed-subscription-plans.ts
 * Dry:  npx tsx scripts/seed-subscription-plans.ts --dryRun
 * Drop: npx tsx scripts/seed-subscription-plans.ts --drop
 *
 * Upsert behaviour: existing records with matching `code` are updated,
 * not duplicated. Safe to re-run.
 */

import mongoose from "mongoose";
import { config as loadEnv } from "dotenv";
import { connectToDatabase } from "../src/db/connectToDatabase";
import { SubscriptionTier } from "../src/models/SubscriptionTier";
import {
  PLAN_CODES,
  PLAN_META,
} from "../src/lib/subscriptions/plan-codes";
import {
  PLAN_ENTITLEMENTS,
} from "../src/lib/subscriptions/plan-entitlements";
import {
  DEFAULT_PLAN_LIMITS,
  ONE_GB,
} from "../src/lib/subscriptions/limit-keys";
import { FEATURE_KEYS } from "../src/lib/subscriptions/feature-keys";

const isDryRun = process.argv.includes("--dryRun");
const isDrop = process.argv.includes("--drop");

loadEnv({ path: ".env.local" });

function featuresForPlan(code: keyof typeof PLAN_CODES): string[] {
  const planCode = PLAN_CODES[code];
  const entries = PLAN_ENTITLEMENTS[planCode];
  return (Object.entries(entries) as [string, string][])
    .filter(([, level]) => level === "YES" || level === "LIMITED")
    .map(([key]) => key);
}

const PLAN_SEEDS = [
  {
    code: PLAN_CODES.PILOT,
    name: PLAN_META.pilot.label,
    description: PLAN_META.pilot.description,
    publicVisible: PLAN_META.pilot.publicVisible,
    priceMinor: 0,
    billingCadence: "custom" as const,
    pricing: {
      currency: "GHS",
      pricePerStudentPerTermMinor: null,
      minimumTermFeeMinor: null,
      annualDiscountPercent: null,
      onboardingFeeMinor: null,
    },
    features: [],    // Pilot features are per-school; none guaranteed
    limits: DEFAULT_PLAN_LIMITS.pilot,
    pilotDefaults: {
      defaultDurationDays: 30,
      gracePeriodDays: 7,
    },
    version: 1,
    active: true,
    provisional: false,
    sortOrder: PLAN_META.pilot.sortOrder,
  },
  {
    code: PLAN_CODES.STARTER,
    name: PLAN_META.starter.label,
    description: PLAN_META.starter.description,
    publicVisible: PLAN_META.starter.publicVisible,
    priceMinor: 800_00,       // GHS 800 minimum per term (in pesewas)
    billingCadence: "term" as const,
    pricing: {
      currency: "GHS",
      pricePerStudentPerTermMinor: 8_00,     // GHS 8 per student per term
      minimumTermFeeMinor: 800_00,           // GHS 800 minimum
      annualDiscountPercent: 10,
      onboardingFeeMinor: null,
    },
    features: featuresForPlan("STARTER"),
    limits: DEFAULT_PLAN_LIMITS.starter,
    version: 1,
    active: true,
    provisional: false,
    sortOrder: PLAN_META.starter.sortOrder,
  },
  {
    code: PLAN_CODES.GROWTH,
    name: PLAN_META.growth.label,
    description: PLAN_META.growth.description,
    publicVisible: PLAN_META.growth.publicVisible,
    priceMinor: 1500_00,
    billingCadence: "term" as const,
    pricing: {
      currency: "GHS",
      pricePerStudentPerTermMinor: 15_00,    // GHS 15
      minimumTermFeeMinor: 1500_00,          // GHS 1,500
      annualDiscountPercent: 10,
      onboardingFeeMinor: null,
    },
    features: featuresForPlan("GROWTH"),
    limits: DEFAULT_PLAN_LIMITS.growth,
    version: 1,
    active: true,
    provisional: false,
    sortOrder: PLAN_META.growth.sortOrder,
  },
  {
    code: PLAN_CODES.ENTERPRISE,
    name: PLAN_META.enterprise.label,
    description: PLAN_META.enterprise.description,
    publicVisible: PLAN_META.enterprise.publicVisible,
    priceMinor: 2500_00,
    billingCadence: "term" as const,
    pricing: {
      currency: "GHS",
      pricePerStudentPerTermMinor: 25_00,    // GHS 25
      minimumTermFeeMinor: 2500_00,          // GHS 2,500
      annualDiscountPercent: 10,
      onboardingFeeMinor: null,
    },
    features: featuresForPlan("ENTERPRISE"),
    limits: DEFAULT_PLAN_LIMITS.enterprise,
    version: 1,
    active: true,
    provisional: false,
    sortOrder: PLAN_META.enterprise.sortOrder,
  },
];

async function run() {
  await connectToDatabase();
  console.log(`\n🌱  seed:subscription-plans${isDryRun ? " (dry run)" : ""}\n`);

  if (isDrop && !isDryRun) {
    const deleted = await SubscriptionTier.deleteMany({
      code: { $in: Object.values(PLAN_CODES) },
    });
    console.log(`🗑   Dropped ${deleted.deletedCount} existing plan record(s).\n`);
  }

  for (const plan of PLAN_SEEDS) {
    const { code, ...data } = plan;

    if (isDryRun) {
      console.log(`  [DRY] Would upsert plan: ${code} — ${data.name}`);
      continue;
    }

    const result = await SubscriptionTier.findOneAndUpdate(
      { code },
      { $set: data },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`  ✅  ${code.padEnd(10)} — ${data.name} (id: ${result._id})`);
  }

  if (!isDryRun) {
    console.log(`\n✅  ${PLAN_SEEDS.length} plan(s) seeded successfully.\n`);
  } else {
    console.log(`\n✅  Dry run complete. No changes made.\n`);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
