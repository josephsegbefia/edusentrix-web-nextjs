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
import {
  sendAdmissionInterviewScheduledEmail,
  sendAdmissionStatusUpdateEmail,
} from "@/lib/admissions/applicant-notification-emails";
import { School } from "@/models/School";
import {
  enforceApplicationPatchPermissions,
  requireAdmissionsPermission,
} from "@/lib/admissions/admissions-api-permissions";
import { recordAdmissionsManagerActivity } from "@/lib/admissions/recordAdmissionsManagerActivity";
import { auditClientMetaFromRequest } from "@/lib/audit/auditClientMetaFromRequest";

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
  interviewAt: z.union([z.string(), z.null()]).optional(),
  interviewEndsAt: z.union([z.string(), z.null()]).optional(),
  /** When false, status/interview change emails are not sent for this update. */
  notifyApplicant: z.boolean().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  try {
    const ctx = await requireAdmissionsManager();
    requireAdmissionsPermission(ctx, "admissions.view");
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

    enforceApplicationPatchPermissions(ctx, parsed.data);

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

    const client = auditClientMetaFromRequest(req);
    const previousStatus = app.status;
    const previousAssignedReviewerId =
      app.assignedReviewerId?.toString() ?? null;
    const beforeInterviewStart = app.interviewAt
      ? new Date(app.interviewAt).getTime()
      : null;
    const beforeInterviewEnd = app.interviewEndsAt
      ? new Date(app.interviewEndsAt).getTime()
      : null;

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
    if (parsed.data.interviewAt !== undefined) {
      app.interviewAt =
        parsed.data.interviewAt === null
          ? null
          : new Date(parsed.data.interviewAt);
      if (parsed.data.interviewAt === null) {
        app.interviewEndsAt = null;
      }
    }
    if (parsed.data.interviewEndsAt !== undefined) {
      app.interviewEndsAt =
        parsed.data.interviewEndsAt === null
          ? null
          : new Date(parsed.data.interviewEndsAt);
    }

    const afterInterviewStart = app.interviewAt
      ? new Date(app.interviewAt).getTime()
      : null;
    const afterInterviewEnd = app.interviewEndsAt
      ? new Date(app.interviewEndsAt).getTime()
      : null;
    const interviewFieldsTouched =
      parsed.data.interviewAt !== undefined ||
      parsed.data.interviewEndsAt !== undefined;
    const interviewChanged =
      interviewFieldsTouched &&
      (beforeInterviewStart !== afterInterviewStart ||
        beforeInterviewEnd !== afterInterviewEnd);
    const statusChanged = Boolean(
      parsed.data.status && parsed.data.status !== previousStatus
    );
    const notifyApplicant = parsed.data.notifyApplicant !== false;

    await app.save();

    if (notifyApplicant) {
      const school = await School.findById(ctx.schoolId).select("name").lean<{
        name?: string;
      } | null>();
      const schoolName = school?.name ?? "Your school";
      const emailCtx = {
        schoolId: String(ctx.schoolId),
        schoolName,
        actorId: String(ctx.userId),
        actorRole: (ctx.isAdmin ? "school_admin" : "admissions_officer") as
          | "school_admin"
          | "admissions_officer",
      };
      try {
        if (statusChanged && parsed.data.status) {
          await sendAdmissionStatusUpdateEmail({
            applicationId: String(app._id),
            referenceCode: app.referenceCode,
            guardian: app.guardian,
            trackerToken: app.tracker.token,
            fromStatus: previousStatus,
            toStatus: parsed.data.status,
            interviewAt: app.interviewAt ?? null,
            interviewEndsAt: app.interviewEndsAt ?? null,
            ctx: emailCtx,
          });
          await AdmissionEvent.create({
            schoolId: ctx.schoolId,
            cycleId: app.cycleId,
            applicationId: app._id,
            actor: {
              userId: ctx.userId,
              role: ctx.isAdmin ? "school_admin" : "admissions_officer",
              label: "Admissions reviewer",
            },
            kind: "application.email_sent",
            metadata: {
              type: "status_update",
              to: app.guardian.email,
            },
            at: new Date(),
          });
          await recordAdmissionsManagerActivity({
            ctx,
            type: "admissions.application.email_sent",
            entityId: app._id,
            description: "Sent admissions status update email",
            delegationAction: "admissions.application.email_sent",
            metadata: {
              emailType: "status_update",
              to: app.guardian.email,
              fromStatus: previousStatus,
              toStatus: parsed.data.status,
            },
            ipAddress: client.ipAddress,
            userAgent: client.userAgent,
          });
        } else if (
          interviewChanged &&
          app.interviewAt &&
          !statusChanged
        ) {
          await sendAdmissionInterviewScheduledEmail({
            applicationId: String(app._id),
            referenceCode: app.referenceCode,
            guardian: app.guardian,
            trackerToken: app.tracker.token,
            interviewAt: app.interviewAt,
            interviewEndsAt: app.interviewEndsAt ?? null,
            ctx: emailCtx,
          });
          await AdmissionEvent.create({
            schoolId: ctx.schoolId,
            cycleId: app.cycleId,
            applicationId: app._id,
            actor: {
              userId: ctx.userId,
              role: ctx.isAdmin ? "school_admin" : "admissions_officer",
              label: "Admissions reviewer",
            },
            kind: "application.email_sent",
            metadata: {
              type: "interview_scheduled",
              to: app.guardian.email,
            },
            at: new Date(),
          });
          await recordAdmissionsManagerActivity({
            ctx,
            type: "admissions.application.email_sent",
            entityId: app._id,
            description: "Sent interview scheduled email",
            delegationAction: "admissions.application.email_sent",
            metadata: {
              emailType: "interview_scheduled",
              to: app.guardian.email,
            },
            ipAddress: client.ipAddress,
            userAgent: client.userAgent,
          });
        }
      } catch (err) {
        console.error("Admission applicant notification email failed:", err);
      }
    }

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
      await recordAdmissionsManagerActivity({
        ctx,
        type: "admissions.application.status_changed",
        entityId: app._id,
        description: "Changed admissions application status",
        delegationAction: "admissions.application.status_changed",
        metadata: { from: previousStatus, to: parsed.data.status },
        ipAddress: client.ipAddress,
        userAgent: client.userAgent,
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
      await recordAdmissionsManagerActivity({
        ctx,
        type: "admissions.application.note_added",
        entityId: app._id,
        description: "Updated private notes on admissions application",
        delegationAction: "admissions.application.note_added",
        ipAddress: client.ipAddress,
        userAgent: client.userAgent,
      });
    }

    if (parsed.data.assignedReviewerId !== undefined) {
      const nextAssignedReviewerId =
        app.assignedReviewerId?.toString() ?? null;
      if (previousAssignedReviewerId !== nextAssignedReviewerId) {
        await recordAdmissionsManagerActivity({
          ctx,
          type: "admissions.application.reviewer_assigned",
          entityId: app._id,
          description: "Assigned admissions application reviewer",
          delegationAction: "admissions.application.reviewer_assigned",
          metadata: {
            from: previousAssignedReviewerId,
            to: nextAssignedReviewerId,
          },
          ipAddress: client.ipAddress,
          userAgent: client.userAgent,
        });
      }
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
