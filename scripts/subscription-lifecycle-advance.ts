#!/usr/bin/env tsx
/**
 * subscription-lifecycle-advance.ts
 *
 * Subscription expiry automation script.
 *
 * Transitions school subscriptions through the lifecycle:
 *   active (endsAt reached) → grace
 *   grace (gracePeriodEndsAt reached) → restricted_read_only
 *   restricted_read_only (manualAdvanceTo=suspended) → suspended
 *
 * Spec §16.4 — Lifecycle Automation.
 *
 * Run: npx tsx scripts/subscription-lifecycle-advance.ts [--dry-run] [--verbose]
 *
 * Options:
 *   --dry-run   Preview changes without writing to DB.
 *   --verbose   Log each school processed.
 *   --suspended Advance restricted_read_only → suspended for schools past the
 *               read-only window (72h default unless --suspend-after=<hours>).
 *   --suspend-after=<hours>  How long after restricted_read_only starts to auto-suspend.
 *
 * The script is idempotent — safe to run multiple times.
 */

import mongoose from "mongoose";

const isDryRun = process.argv.includes("--dry-run");
const isVerbose = process.argv.includes("--verbose");
const autoSuspend = process.argv.includes("--suspended");
const suspendAfterArg = process.argv.find((a) => a.startsWith("--suspend-after="));
const suspendAfterHours = suspendAfterArg
  ? parseInt(suspendAfterArg.split("=")[1] ?? "72", 10)
  : 72;

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("❌  MONGODB_URI not set.");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log("✅  Connected to MongoDB.");
  if (isDryRun) console.log("🟡  DRY-RUN mode — no writes will be performed.\n");

  const { SchoolSubscription } = await import("../src/models/SchoolSubscription");
  const { recordSubscriptionEvent } = await import("../src/lib/subscriptions/record-event");

  const now = new Date();

  let totalProcessed = 0;
  let totalTransitioned = 0;
  const summary: Record<string, number> = {};

  function countTransition(key: string) {
    summary[key] = (summary[key] ?? 0) + 1;
    totalTransitioned++;
  }

  // ---------------------------------------------------------------------------
  // Phase 1: active → grace
  // Subscriptions that have passed endsAt and have a defined grace period.
  // ---------------------------------------------------------------------------
  const expiredActive = await SchoolSubscription.find({
    status: "active",
    endsAt: { $lte: now },
  }).lean<Array<{
    _id: mongoose.Types.ObjectId;
    schoolId: mongoose.Types.ObjectId;
    gracePeriodEndsAt?: Date | null;
    tierName?: string | null;
  }>>();

  for (const sub of expiredActive) {
    totalProcessed++;
    if (isVerbose) console.log(`  [active→grace] ${sub.schoolId} (sub ${sub._id})`);

    if (!isDryRun) {
      await SchoolSubscription.updateOne(
        { _id: sub._id },
        { $set: { status: "grace" } }
      );
      await recordSubscriptionEvent({
        schoolId: sub.schoolId,
        subscriptionId: sub._id,
        eventType: "grace_period_started",
        summary: `Subscription expired — entered grace period. Grace ends: ${
          sub.gracePeriodEndsAt?.toLocaleDateString("en-GH") ?? "unknown"
        }.`,
        metadata: { previousStatus: "active", gracePeriodEndsAt: sub.gracePeriodEndsAt ?? null },
      });
    }

    countTransition("active→grace");
  }

  // ---------------------------------------------------------------------------
  // Phase 2: grace → restricted_read_only
  // Subscriptions past the grace window.
  // ---------------------------------------------------------------------------
  const expiredGrace = await SchoolSubscription.find({
    status: "grace",
    gracePeriodEndsAt: { $lte: now },
  }).lean<Array<{
    _id: mongoose.Types.ObjectId;
    schoolId: mongoose.Types.ObjectId;
    tierName?: string | null;
  }>>();

  for (const sub of expiredGrace) {
    totalProcessed++;
    if (isVerbose) console.log(`  [grace→restricted] ${sub.schoolId} (sub ${sub._id})`);

    if (!isDryRun) {
      await SchoolSubscription.updateOne(
        { _id: sub._id },
        { $set: { status: "restricted_read_only", manualAccessModeOverride: "restricted_read_only" } }
      );
      await recordSubscriptionEvent({
        schoolId: sub.schoolId,
        subscriptionId: sub._id,
        eventType: "grace_period_ended",
        summary: "Grace period ended — moved to restricted read-only access.",
        metadata: { previousStatus: "grace" },
      });
    }

    countTransition("grace→restricted_read_only");
  }

  // ---------------------------------------------------------------------------
  // Phase 3 (optional): restricted_read_only → suspended
  // Schools that have been in read-only for > suspendAfterHours.
  // Only runs when --suspended flag is set.
  // ---------------------------------------------------------------------------
  if (autoSuspend) {
    const suspendThreshold = new Date(now.getTime() - suspendAfterHours * 60 * 60 * 1000);

    const readOnlyLong = await SchoolSubscription.find({
      status: "restricted_read_only",
      updatedAt: { $lte: suspendThreshold },
    }).lean<Array<{
      _id: mongoose.Types.ObjectId;
      schoolId: mongoose.Types.ObjectId;
      tierName?: string | null;
    }>>();

    for (const sub of readOnlyLong) {
      totalProcessed++;
      if (isVerbose) console.log(`  [restricted→suspended] ${sub.schoolId} (sub ${sub._id})`);

      if (!isDryRun) {
        await SchoolSubscription.updateOne(
          { _id: sub._id },
          { $set: { status: "suspended", manualAccessModeOverride: "suspended" } }
        );
        await recordSubscriptionEvent({
          schoolId: sub.schoolId,
          subscriptionId: sub._id,
          eventType: "subscription_suspended",
          summary: `Automatically suspended after ${suspendAfterHours}h in restricted read-only.`,
          metadata: { previousStatus: "restricted_read_only", suspendAfterHours },
        });
      }

      countTransition("restricted_read_only→suspended");
    }
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log("\n─── Lifecycle Advance Summary ────────────────────────");
  console.log(`  Processed:    ${totalProcessed}`);
  console.log(`  Transitioned: ${totalTransitioned}`);
  for (const [transition, count] of Object.entries(summary)) {
    console.log(`    ${transition}: ${count}`);
  }
  if (isDryRun) {
    console.log("\n  ⚠️  DRY-RUN — no changes written. Re-run without --dry-run to apply.");
  }
  console.log("──────────────────────────────────────────────────────\n");

  await mongoose.disconnect();
  console.log("✅  Done.");
}

main().catch((err) => {
  console.error("❌  Error:", err);
  process.exit(1);
});
