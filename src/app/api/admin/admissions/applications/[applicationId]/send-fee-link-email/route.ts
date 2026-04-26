import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AdmissionApplication } from "@/models/AdmissionApplication";
import { AdmissionCycle } from "@/models/AdmissionCycle";
import { AdmissionEvent } from "@/models/AdmissionEvent";
import { School } from "@/models/School";
import { requireAdmissionsManager } from "@/lib/auth/requireAdmissionsManager";
import { sendAdmissionFeePaymentLinkEmail } from "@/lib/admissions/applicant-notification-emails";

type Params = Promise<{ applicationId: string }>;

export async function POST(_req: NextRequest, { params }: { params: Params }) {
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

    if (app.feeStatus !== "pending") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Fee is not pending for this application (already paid, waived, or not required).",
        },
        { status: 409 }
      );
    }

    const cycle = await AdmissionCycle.findById(app.cycleId)
      .select("applicationFee")
      .lean();
    const fee = cycle?.applicationFee;
    if (!fee?.enabled) {
      return NextResponse.json(
        {
          success: false,
          error: "This cycle does not have an application fee configured.",
        },
        { status: 400 }
      );
    }

    const school = await School.findById(ctx.schoolId).select("name").lean<{
      name?: string;
    } | null>();
    const schoolName = school?.name ?? "Your school";

    await sendAdmissionFeePaymentLinkEmail({
      applicationId: String(app._id),
      referenceCode: app.referenceCode,
      guardian: app.guardian,
      trackerToken: app.tracker.token,
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
      metadata: { type: "fee_payment_link", to: app.guardian.email },
      at: new Date(),
    });

    return NextResponse.json({
      success: true,
      data: { sentTo: app.guardian.email },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Fee link email error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send email" },
      { status: 500 }
    );
  }
}
