import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AdmissionApplication } from "@/models/AdmissionApplication";
import { AdmissionEvent } from "@/models/AdmissionEvent";
import { School } from "@/models/School";
import { requireAdmissionsManager } from "@/lib/auth/requireAdmissionsManager";
import { requireAdmissionsPermission } from "@/lib/admissions/admissions-api-permissions";
import { sendAdmissionInterviewScheduledEmail } from "@/lib/admissions/applicant-notification-emails";
import { recordAdmissionsManagerActivity } from "@/lib/admissions/recordAdmissionsManagerActivity";
import { auditClientMetaFromRequest } from "@/lib/audit/auditClientMetaFromRequest";

type Params = Promise<{ applicationId: string }>;

export async function POST(req: NextRequest, { params }: { params: Params }) {
  try {
    const ctx = await requireAdmissionsManager();
    requireAdmissionsPermission(ctx, "admissions.send_email");
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

    if (!app.interviewAt) {
      return NextResponse.json(
        {
          success: false,
          error: "Set an interview date on the application before sending this email.",
        },
        { status: 400 }
      );
    }

    const school = await School.findById(ctx.schoolId).select("name").lean<{
      name?: string;
    } | null>();
    const schoolName = school?.name ?? "Your school";

    await sendAdmissionInterviewScheduledEmail({
      applicationId: String(app._id),
      referenceCode: app.referenceCode,
      guardian: app.guardian,
      trackerToken: app.tracker.token,
      interviewAt: new Date(app.interviewAt),
      interviewEndsAt: app.interviewEndsAt
        ? new Date(app.interviewEndsAt)
        : null,
      ctx: {
        schoolId: String(ctx.schoolId),
        schoolName,
        actorId: String(ctx.userId),
        actorRole: ctx.isAdmin ? "school_admin" : "admissions_officer",
      },
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
      metadata: { type: "interview_resend", to: app.guardian.email },
      at: new Date(),
    });

    const client = auditClientMetaFromRequest(req);
    await recordAdmissionsManagerActivity({
      ctx,
      type: "admissions.application.email_sent",
      entityId: app._id,
      description: "Resent interview scheduled email",
      delegationAction: "admissions.application.email_sent",
      metadata: { emailType: "interview_resend", to: app.guardian.email },
      ipAddress: client.ipAddress,
      userAgent: client.userAgent,
    });

    return NextResponse.json({
      success: true,
      data: { sentTo: app.guardian.email },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Interview email error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send email" },
      { status: 500 }
    );
  }
}
