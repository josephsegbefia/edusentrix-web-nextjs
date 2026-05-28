/**
 * PATCH /api/platform/schools/[id]/subscription/access-mode
 *
 * Set or clear a manual access mode override for a school's subscription.
 *
 * Access mode override options:
 *   - "full"                  — forcibly restore full access (e.g. after payment confirmed)
 *   - "grace"                 — manually move to grace period
 *   - "restricted_read_only"  — read-only restriction (past grace, unpaid)
 *   - "suspended"             — suspended (severe non-payment)
 *   - null                    — clear the override, let the system resolve access mode naturally
 *
 * This allows platform ops to take action on individual schools before
 * global enforcement is turned on.
 *
 * Spec §7.3.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { School } from "@/models/School";
import { SchoolSubscription } from "@/models/SchoolSubscription";
import { recordSubscriptionEvent } from "@/lib/subscriptions/record-event";

type Params = { params: Promise<{ id: string }> };

const ACCESS_MODE_VALUES = [
  "full",
  "pilot_limited",
  "grace",
  "restricted_read_only",
  "suspended",
  null,
] as const;

const PatchAccessModeSchema = z.object({
  accessMode: z.enum(["full", "pilot_limited", "grace", "restricted_read_only", "suspended"]).nullable(),
  reason: z.string().trim().max(500).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const perm = await requirePlatformPermission("platform.subscriptions.manage");
  if (!perm.ok) return perm.res;

  const { id: schoolId } = await params;
  if (!mongoose.Types.ObjectId.isValid(schoolId)) {
    return NextResponse.json({ success: false, error: "Invalid school ID." }, { status: 400 });
  }

  const body = await req.json();
  const parsed = PatchAccessModeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  await connectToDatabase();

  const school = await School.findById(schoolId).select("name").lean<{ _id: mongoose.Types.ObjectId; name?: string } | null>();
  if (!school) {
    return NextResponse.json({ success: false, error: "School not found." }, { status: 404 });
  }

  const sub = await SchoolSubscription.findOne({ schoolId: new mongoose.Types.ObjectId(schoolId) });
  if (!sub) {
    return NextResponse.json(
      { success: false, error: "This school has no subscription record. Assign a subscription first." },
      { status: 404 }
    );
  }

  const { accessMode, reason } = parsed.data;

  // Also update status to match the new access mode when applicable
  const statusMap: Record<string, string> = {
    grace: "grace",
    restricted_read_only: "restricted_read_only",
    suspended: "suspended",
  };

  const updates: Record<string, unknown> = {
    manualAccessModeOverride: accessMode,
    updatedByEmail: perm.actor.email ?? null,
  };

  if (accessMode && statusMap[accessMode]) {
    updates.status = statusMap[accessMode];
  } else if (accessMode === "full") {
    updates.status = "active";
  }

  if (reason) {
    updates.note = reason;
  }

  await SchoolSubscription.findByIdAndUpdate(sub._id, { $set: updates });

  // Determine event type
  const eventType =
    accessMode === "grace"
      ? "grace_period_started"
      : accessMode === "suspended"
        ? "subscription_suspended"
        : accessMode === "restricted_read_only"
          ? "subscription_suspended"
          : accessMode === "full"
            ? "subscription_reactivated"
            : "access_mode_override";

  await recordSubscriptionEvent({
    schoolId: new mongoose.Types.ObjectId(schoolId),
    subscriptionId: sub._id,
    eventType,
    actorEmail: perm.actor.email ?? null,
    summary: accessMode
      ? `Access mode manually set to "${accessMode}" by platform admin.${reason ? ` Reason: ${reason}` : ""}`
      : `Manual access mode override cleared by platform admin.`,
    metadata: {
      accessMode,
      previousOverride: sub.manualAccessModeOverride ?? null,
      reason: reason ?? null,
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      schoolId,
      schoolName: school.name,
      accessMode,
      subscriptionId: String(sub._id),
      updatedAt: new Date().toISOString(),
    },
  });
}
