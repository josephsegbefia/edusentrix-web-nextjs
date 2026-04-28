// src/app/api/admin/admissions/applications/bulk/route.ts
// POST — apply a bulk action to many applications in one go.
// Supported actions:
//   - { action: "set_status", status: <one of submitted/under_review/...> }
//   - { action: "assign_reviewer", reviewerId: <userId | null> }
// All applications must belong to the requester's school. Decisions /
// provisioning / withdrawal are *not* bulk-applied — those still go through
// their dedicated endpoints to keep the side effects safe.

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireAdmissionsManager } from "@/lib/auth/requireAdmissionsManager";
import { requireAdmissionsPermission } from "@/lib/admissions/admissions-api-permissions";
import { AdmissionApplication } from "@/models/AdmissionApplication";
import { AdmissionCycle } from "@/models/AdmissionCycle";
import { AdmissionEvent } from "@/models/AdmissionEvent";
import { recordAdmissionsManagerActivity } from "@/lib/admissions/recordAdmissionsManagerActivity";
import { auditClientMetaFromRequest } from "@/lib/audit/auditClientMetaFromRequest";

const objectIdString = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

const SetStatusSchema = z.object({
  ids: z.array(objectIdString).min(1).max(500),
  action: z.literal("set_status"),
  status: z.enum([
    "submitted",
    "under_review",
    "interview_scheduled",
    "waitlisted",
    "expired",
  ]),
});

const AssignReviewerSchema = z.object({
  ids: z.array(objectIdString).min(1).max(500),
  action: z.literal("assign_reviewer"),
  reviewerId: objectIdString.nullable(),
});

const BodySchema = z.discriminatedUnion("action", [
  SetStatusSchema,
  AssignReviewerSchema,
]);

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAdmissionsManager();
    requireAdmissionsPermission(ctx, "admissions.change_status");
    await connectToDatabase();

    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid bulk request",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const client = auditClientMetaFromRequest(req);
    const ids = parsed.data.ids.map((id) => new mongoose.Types.ObjectId(id));
    const apps = await AdmissionApplication.find({
      _id: { $in: ids },
      schoolId: ctx.schoolId,
    });

    if (apps.length === 0) {
      return NextResponse.json({
        success: true,
        data: { updated: 0, skipped: 0, total: parsed.data.ids.length },
      });
    }

    let updated = 0;
    let skipped = 0;
    const cycleStatusDeltas = new Map<
      string,
      Record<string, number>
    >();

    for (const app of apps) {
      // Never bulk-mutate decision/withdrawn/provisioned items.
      if (
        app.status === "withdrawn" ||
        app.provisioned ||
        app.decision != null
      ) {
        skipped++;
        continue;
      }

      if (parsed.data.action === "set_status") {
        const previous = app.status;
        if (previous === parsed.data.status) {
          skipped++;
          continue;
        }
        app.status = parsed.data.status;
        await app.save();

        const cycleKey = String(app.cycleId);
        const delta = cycleStatusDeltas.get(cycleKey) ?? {};
        delta[previous] = (delta[previous] ?? 0) - 1;
        delta[app.status] = (delta[app.status] ?? 0) + 1;
        cycleStatusDeltas.set(cycleKey, delta);

        await AdmissionEvent.create({
          schoolId: ctx.schoolId,
          cycleId: app.cycleId,
          applicationId: app._id,
          actor: {
            userId: ctx.userId,
            role: ctx.isAdmin ? "school_admin" : "admissions_officer",
            label: "Admissions reviewer",
          },
          kind: "application.status_changed",
          metadata: { from: previous, to: app.status, bulk: true },
        });
        await recordAdmissionsManagerActivity({
          ctx,
          type: "admissions.application.status_changed",
          entityId: app._id,
          description: "Bulk status change on admissions application",
          delegationAction: "admissions.application.status_changed",
          metadata: { from: previous, to: app.status, bulk: true },
          ipAddress: client.ipAddress,
          userAgent: client.userAgent,
        });
        updated++;
      } else {
        const previousReviewerId =
          app.assignedReviewerId?.toString() ?? null;
        const next = parsed.data.reviewerId
          ? new mongoose.Types.ObjectId(parsed.data.reviewerId)
          : null;
        const same =
          (app.assignedReviewerId?.toString() ?? null) ===
          (next?.toString() ?? null);
        if (same) {
          skipped++;
          continue;
        }
        app.assignedReviewerId = next;
        await app.save();
        const nextReviewerId = app.assignedReviewerId?.toString() ?? null;
        await recordAdmissionsManagerActivity({
          ctx,
          type: "admissions.application.reviewer_assigned",
          entityId: app._id,
          description: "Bulk reviewer assignment on admissions application",
          delegationAction: "admissions.application.reviewer_assigned",
          metadata: {
            bulk: true,
            from: previousReviewerId,
            to: nextReviewerId,
          },
          ipAddress: client.ipAddress,
          userAgent: client.userAgent,
        });
        updated++;
      }
    }

    // Apply cycle.analytics delta in one pass per cycle.
    for (const [cycleId, delta] of cycleStatusDeltas) {
      const cycle = await AdmissionCycle.findById(cycleId);
      if (!cycle) continue;
      const byStatus = (cycle.analytics?.byStatus ?? {}) as Record<string, number>;
      for (const [k, v] of Object.entries(delta)) {
        byStatus[k] = Math.max(0, (byStatus[k] ?? 0) + v);
      }
      cycle.analytics.byStatus = byStatus;
      cycle.markModified("analytics");
      await cycle.save();
    }

    return NextResponse.json({
      success: true,
      data: {
        updated,
        skipped,
        total: parsed.data.ids.length,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Admissions bulk POST error:", error);
    return NextResponse.json(
      { success: false, error: "Bulk update failed" },
      { status: 500 }
    );
  }
}
