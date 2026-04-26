// src/app/api/admin/admissions/applications/[applicationId]/route.ts
// GET   Application detail for the review screen.
// PATCH Update status, assignedReviewerId, or notesPrivate.

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AdmissionApplication } from "@/models/AdmissionApplication";
import { AdmissionEvent } from "@/models/AdmissionEvent";
import { AdmissionCycle } from "@/models/AdmissionCycle";
import { Grade } from "@/models/Grade";
import { requireAdmissionsManager } from "@/lib/auth/requireAdmissionsManager";
import { serializeApplicationDetail } from "@/lib/admissions/application-service";

type Params = Promise<{ applicationId: string }>;

const PatchSchema = z.object({
  status: z
    .enum([
      "submitted",
      "under_review",
      "interview_scheduled",
      "waitlisted",
      "withdrawn",
      "expired",
    ])
    .optional(),
  assignedReviewerId: z.string().optional().nullable(),
  notesPrivate: z.string().max(5000).optional().nullable(),
  feeStatus: z
    .enum(["not_required", "pending", "paid", "waived"])
    .optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  try {
    const ctx = await requireAdmissionsManager();
    const { applicationId } = await params;
    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      return NextResponse.json(
        { success: false, error: "Invalid application id" },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const app = await AdmissionApplication.findOne({
      _id: applicationId,
      schoolId: ctx.schoolId,
    }).lean();
    if (!app) {
      return NextResponse.json(
        { success: false, error: "Application not found" },
        { status: 404 }
      );
    }

    const grade = app.applicant?.intendedGradeId
      ? await Grade.findById(app.applicant.intendedGradeId).select("name").lean()
      : null;

    const detail = serializeApplicationDetail({
      ...app,
      _gradeName: grade ? String((grade as { name: string }).name) : null,
    } as never);

    // Fire-and-forget audit
    void AdmissionEvent.create({
      schoolId: ctx.schoolId,
      cycleId: app.cycleId,
      applicationId: app._id,
      actor: { userId: ctx.userId, role: ctx.isAdmin ? "school_admin" : "admissions_officer", label: "Admissions reviewer" },
      kind: "application.viewed_by_admin",
      at: new Date(),
    });

    return NextResponse.json({ success: true, data: detail });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Admin admissions detail error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load application" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  try {
    const ctx = await requireAdmissionsManager();
    const { applicationId } = await params;
    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      return NextResponse.json(
        { success: false, error: "Invalid application id" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid update",
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

    const previousStatus = app.status;
    if (parsed.data.status && parsed.data.status !== previousStatus) {
      app.status = parsed.data.status;
      // keep cycle.analytics.byStatus consistent
      void (async () => {
        const cycle = await AdmissionCycle.findById(app.cycleId);
        if (!cycle) return;
        const byStatus = (cycle.analytics?.byStatus ?? {}) as Record<string, number>;
        byStatus[previousStatus] = Math.max(0, (byStatus[previousStatus] ?? 1) - 1);
        byStatus[app.status] = (byStatus[app.status] ?? 0) + 1;
        cycle.analytics.byStatus = byStatus;
        cycle.markModified("analytics");
        await cycle.save();
      })();
    }
    if (parsed.data.assignedReviewerId !== undefined) {
      app.assignedReviewerId = parsed.data.assignedReviewerId
        ? new mongoose.Types.ObjectId(parsed.data.assignedReviewerId)
        : null;
    }
    if (parsed.data.notesPrivate !== undefined) {
      app.notesPrivate = parsed.data.notesPrivate;
    }
    if (parsed.data.feeStatus !== undefined) {
      app.feeStatus = parsed.data.feeStatus;
    }

    await app.save();

    if (parsed.data.status && parsed.data.status !== previousStatus) {
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
        metadata: { from: previousStatus, to: parsed.data.status },
        at: new Date(),
      });
    } else if (parsed.data.notesPrivate !== undefined) {
      await AdmissionEvent.create({
        schoolId: ctx.schoolId,
        cycleId: app.cycleId,
        applicationId: app._id,
        actor: {
          userId: ctx.userId,
          role: ctx.isAdmin ? "school_admin" : "admissions_officer",
          label: "Admissions reviewer",
        },
        kind: "application.note_added",
        at: new Date(),
      });
    }

    const grade = app.applicant?.intendedGradeId
      ? await Grade.findById(app.applicant.intendedGradeId).select("name").lean()
      : null;

    return NextResponse.json({
      success: true,
      data: serializeApplicationDetail({
        ...app.toObject(),
        _gradeName: grade ? String((grade as { name: string }).name) : null,
      } as never),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Admin admissions PATCH error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update application" },
      { status: 500 }
    );
  }
}
