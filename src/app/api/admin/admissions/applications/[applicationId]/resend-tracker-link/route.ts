// src/app/api/admin/admissions/applications/[applicationId]/resend-tracker-link/route.ts
// POST – Re-send the tracker URL to the applicant's guardian email. Useful
// when a parent loses their original confirmation email.

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import { connectToDatabase } from "@/db/connectToDatabase";
import { AdmissionApplication } from "@/models/AdmissionApplication";
import { AdmissionEvent } from "@/models/AdmissionEvent";
import { School } from "@/models/School";
import { requireAdmissionsManager } from "@/lib/auth/requireAdmissionsManager";
import { requireAdmissionsPermission } from "@/lib/admissions/admissions-api-permissions";
import { sendTrackedBrevoEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/utils/getAppUrl";
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

    const school = await School.findById(ctx.schoolId).select("name").lean<{
      name?: string;
    } | null>();
    const schoolName = school?.name ?? "your school";

    const trackerUrl = `${getAppUrl()}/apply/track/${app.tracker.token}`;
    const guardianFullName =
      `${app.guardian.firstName ?? ""} ${app.guardian.lastName ?? ""}`.trim() ||
      "Guardian";

    const subject = `Your ${schoolName} admissions tracker link`;
    const htmlContent = `
      <p>Hi ${guardianFullName},</p>
      <p>Here is your tracker link for application
      <strong>${app.referenceCode}</strong> at <strong>${schoolName}</strong>:</p>
      <p><a href="${trackerUrl}">${trackerUrl}</a></p>
      <p>Bookmark this link to check the status of the application at any time.</p>
    `;

    await sendTrackedBrevoEmail({
      to: app.guardian.email,
      toName: guardianFullName,
      subject,
      htmlContent,
      templateKey: "ADMISSIONS_TRACKER_LINK",
      schoolId: String(ctx.schoolId),
      schoolName,
      actorId: String(ctx.userId),
      actorRole: ctx.isAdmin ? "school_admin" : "admissions_officer",
      relatedEntityType: "admission_application",
      relatedEntityId: String(app._id),
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
      metadata: { type: "tracker_link_resend", to: app.guardian.email },
      at: new Date(),
    });

    const client = auditClientMetaFromRequest(req);
    await recordAdmissionsManagerActivity({
      ctx,
      type: "admissions.application.email_sent",
      entityId: app._id,
      description: "Resent admissions tracker link email",
      delegationAction: "admissions.application.email_sent",
      metadata: { emailType: "tracker_link_resend", to: app.guardian.email },
      ipAddress: client.ipAddress,
      userAgent: client.userAgent,
    });

    return NextResponse.json({
      success: true,
      data: { sentTo: app.guardian.email, trackerUrl },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Admissions resend tracker error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to resend tracker link" },
      { status: 500 }
    );
  }
}
