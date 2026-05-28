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
import { PLAN_CODES } from "../src/lib/subscriptions/plan-codes";
import {
  getCanonicalSubscriptionPlanSeeds,
  syncCanonicalSubscriptionPlans,
} from "../src/lib/subscriptions/default-plan-seeds";

const isDryRun = process.argv.includes("--dryRun");
const isDrop = process.argv.includes("--drop");

loadEnv({ path: ".env.local" });

async function run() {
  await connectToDatabase();
  console.log(`\n🌱  seed:subscription-plans${isDryRun ? " (dry run)" : ""}\n`);

  const seeds = getCanonicalSubscriptionPlanSeeds();
  const result = await syncCanonicalSubscriptionPlans({
    dryRun: isDryRun,
    dropExisting: isDrop,
  });

  if (result.droppedExisting) {
    console.log("  Dropped existing canonical plan records before seeding.\n");
  }

  for (const row of result.results) {
    const seed = seeds.find((plan) => plan.code === row.code);
    console.log(
      `  ${row.action === "dry_run" ? "[DRY]" : "OK"} ${row.code.padEnd(10)} - ${seed?.name ?? row.code} (${row.featureCount} features${row.id ? `, id: ${row.id}` : ""})`
    );
  }

  if (!isDryRun) {
    console.log(`\nSeeded canonical codes: ${Object.values(PLAN_CODES).join(", ")}\n`);
  } else {
    console.log("\nDry run complete. No changes made.\n");
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
