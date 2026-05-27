/**
 * POST /api/platform/subscriptions/lifecycle-advance
 *
 * Trigger subscription lifecycle advancement for all schools:
 *   active (expired) → grace
 *   grace (expired) → restricted_read_only
 *   restricted_read_only (long-standing, opt-in) → suspended
 *
 * This is the same logic as scripts/subscription-lifecycle-advance.ts
 * but invocable from the platform admin UI.
 *
 * Spec §16.4.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { SchoolSubscription } from "@/models/SchoolSubscription";
import { recordSubscriptionEvent } from "@/lib/subscriptions/record-event";
import mongoose from "mongoose";

const BodySchema = z.object({
  dryRun: z.boolean().default(false),
  autoSuspend: z.boolean().default(false),
  suspendAfterHours: z.number().int().min(1).max(8760).default(72),
});

export async function POST(req: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  const perm = await requirePlatformPermission(auth.userId, "platform.subscriptions.manage");
  if (!perm.success) return NextResponse.json({ success: false, error: perm.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const { dryRun, autoSuspend, suspendAfterHours } = parsed.data;

  await connectToDatabase();

  const now = new Date();
  const summary: Record<string, number> = {};
  const affected: Array<{ schoolId: string; transition: string }> = [];

  function countTransition(schoolId: mongoose.Types.ObjectId, key: string) {
    summary[key] = (summary[key] ?? 0) + 1;
    affected.push({ schoolId: String(schoolId), transition: key });
  }

  // Phase 1: active → grace
  const expiredActive = await SchoolSubscription.find({
    status: "active",
    endsAt: { $lte: now },
  }).lean<Array<{ _id: mongoose.Types.ObjectId; schoolId: mongoose.Types.ObjectId; gracePeriodEndsAt?: Date | null }>>();

  for (const sub of expiredActive) {
    if (!dryRun) {
      await SchoolSubscription.updateOne({ _id: sub._id }, { $set: { status: "grace" } });
      await recordSubscriptionEvent({
        schoolId: sub.schoolId,
        subscriptionId: sub._id,
        eventType: "grace_period_started",
        summary: `Subscription expired — entered grace period. Grace ends: ${sub.gracePeriodEndsAt?.toLocaleDateString("en-GH") ?? "unknown"}.`,
        actorEmail: auth.email ?? null,
        metadata: { previousStatus: "active", trigger: "platform_lifecycle_advance" },
      });
    }
    countTransition(sub.schoolId, "active→grace");
  }

  // Phase 2: grace → restricted_read_only
  const expiredGrace = await SchoolSubscription.find({
    status: "grace",
    gracePeriodEndsAt: { $lte: now },
  }).lean<Array<{ _id: mongoose.Types.ObjectId; schoolId: mongoose.Types.ObjectId }>>();

  for (const sub of expiredGrace) {
    if (!dryRun) {
      await SchoolSubscription.updateOne(
        { _id: sub._id },
        { $set: { status: "restricted_read_only", manualAccessModeOverride: "restricted_read_only" } }
      );
      await recordSubscriptionEvent({
        schoolId: sub.schoolId,
        subscriptionId: sub._id,
        eventType: "grace_period_ended",
        summary: "Grace period ended — moved to restricted read-only access.",
        actorEmail: auth.email ?? null,
        metadata: { previousStatus: "grace", trigger: "platform_lifecycle_advance" },
      });
    }
    countTransition(sub.schoolId, "grace→restricted_read_only");
  }

  // Phase 3 (optional): restricted_read_only → suspended
  if (autoSuspend) {
    const suspendThreshold = new Date(now.getTime() - suspendAfterHours * 60 * 60 * 1000);
    const readOnlyLong = await SchoolSubscription.find({
      status: "restricted_read_only",
      updatedAt: { $lte: suspendThreshold },
    }).lean<Array<{ _id: mongoose.Types.ObjectId; schoolId: mongoose.Types.ObjectId }>>();

    for (const sub of readOnlyLong) {
      if (!dryRun) {
        await SchoolSubscription.updateOne(
          { _id: sub._id },
          { $set: { status: "suspended", manualAccessModeOverride: "suspended" } }
        );
        await recordSubscriptionEvent({
          schoolId: sub.schoolId,
          subscriptionId: sub._id,
          eventType: "subscription_suspended",
          summary: `Auto-suspended after ${suspendAfterHours}h in restricted read-only.`,
          actorEmail: auth.email ?? null,
          metadata: { previousStatus: "restricted_read_only", suspendAfterHours, trigger: "platform_lifecycle_advance" },
        });
      }
      countTransition(sub.schoolId, "restricted_read_only→suspended");
    }
  }

  const total = Object.values(summary).reduce((a, b) => a + b, 0);

  return NextResponse.json({
    success: true,
    dryRun,
    total,
    summary,
    affected: dryRun ? affected : undefined,
  });
}
