// src/app/api/admin/admissions/applications/[applicationId]/withdraw/route.ts
// POST – Mark an application as withdrawn (admin / officer side). Records
// an AdmissionEvent and adjusts cycle.analytics.byStatus.

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";

import { connectToDatabase } from "@/db/connectToDatabase";
import { AdmissionApplication } from "@/models/AdmissionApplication";
import { AdmissionCycle } from "@/models/AdmissionCycle";
import { AdmissionEvent } from "@/models/AdmissionEvent";
import { requireAdmissionsManager } from "@/lib/auth/requireAdmissionsManager";
import { requireAdmissionsPermission } from "@/lib/admissions/admissions-api-permissions";
import { recordAdmissionsManagerActivity } from "@/lib/admissions/recordAdmissionsManagerActivity";
import { auditClientMetaFromRequest } from "@/lib/audit/auditClientMetaFromRequest";

type Params = Promise<{ applicationId: string }>;

const Body = z.object({
  reason: z.string().max(2000).optional().nullable(),
});

export async function POST(req: NextRequest, { params }: { params: Params }) {
  try {
    const ctx = await requireAdmissionsManager();
    requireAdmissionsPermission(ctx, "admissions.change_status");
    const { applicationId } = await params;
    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      return NextResponse.json(
        { success: false, error: "Invalid application id" },
        { status: 400 }
      );
    }

    const json = await req.json().catch(() => ({}));
    const parsed = Body.safeParse(json ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const app = await AdmissionApplication.findOne({
      _id: applicationId,
      schoolId: ctx.schoolId,
    });
    if (!app) {
      return NextResponse.json(
        { success: false, error: "Application not found" },
        { status: 404 }
      );
    }

    if (app.provisioned) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Application has already been provisioned and cannot be withdrawn here. Withdraw the student record instead.",
        },
        { status: 409 }
      );
    }

    if (app.status === "withdrawn") {
      return NextResponse.json({ success: true, data: { alreadyWithdrawn: true } });
    }

    const previousStatus = app.status;
    app.status = "withdrawn";
    await app.save();

    void (async () => {
      const cycle = await AdmissionCycle.findById(app.cycleId);
      if (!cycle) return;
      const byStatus = (cycle.analytics?.byStatus ?? {}) as Record<string, number>;
      byStatus[previousStatus] = Math.max(0, (byStatus[previousStatus] ?? 1) - 1);
      byStatus["withdrawn"] = (byStatus["withdrawn"] ?? 0) + 1;
      cycle.analytics.byStatus = byStatus;
      cycle.markModified("analytics");
      await cycle.save();
    })();

    await AdmissionEvent.create({
      schoolId: ctx.schoolId,
      cycleId: app.cycleId,
      applicationId: app._id,
      actor: {
        userId: ctx.userId,
        role: ctx.isAdmin ? "school_admin" : "admissions_officer",
        label: "Admissions reviewer",
      },
      kind: "application.withdrawn",
      metadata: {
        from: previousStatus,
        reason: parsed.data.reason ?? null,
      },
      at: new Date(),
    });

    const client = auditClientMetaFromRequest(req);
    await recordAdmissionsManagerActivity({
      ctx,
      type: "admissions.application.withdrawn",
      entityId: app._id,
      description: `Application withdrawn (was ${previousStatus})`,
      delegationAction: "admissions.application.withdrawn",
      metadata: {
        from: previousStatus,
        reason: parsed.data.reason ?? null,
      },
      ipAddress: client.ipAddress,
      userAgent: client.userAgent,
    });

    return NextResponse.json({
      success: true,
      data: {
        applicationId: String(app._id),
        status: "withdrawn",
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Admissions withdraw error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to withdraw application" },
      { status: 500 }
    );
  }
}
