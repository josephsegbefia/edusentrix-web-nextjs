import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { randomBytes } from "crypto";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AdmissionApplication } from "@/models/AdmissionApplication";
import { AdmissionEvent } from "@/models/AdmissionEvent";
import { School } from "@/models/School";
import { requireAdmissionsManager } from "@/lib/auth/requireAdmissionsManager";
import { sendAdmissionDocumentRequestEmail } from "@/lib/admissions/applicant-notification-emails";
import { getAppUrl } from "@/lib/utils/getAppUrl";

type Params = Promise<{ applicationId: string }>;

const BodySchema = z.object({
  label: z.string().min(1).max(200),
  message: z.string().max(2000).optional().nullable(),
  sendEmail: z.boolean().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Params }) {
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
    const parsed = BodySchema.safeParse(body);
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

    if (
      app.status === "withdrawn" ||
      app.status === "expired" ||
      app.status === "rejected"
    ) {
      return NextResponse.json(
        { success: false, error: "Cannot request documents for this application." },
        { status: 409 }
      );
    }

    const token = randomBytes(24).toString("base64url");
    app.supplementalDocumentRequests = app.supplementalDocumentRequests ?? [];
    app.supplementalDocumentRequests.push({
      token,
      label: parsed.data.label,
      message: parsed.data.message ?? null,
      requestedAt: new Date(),
      requestedBy: ctx.userId,
      fulfilledAt: null,
    });
    await app.save();

    const uploadUrl = `${getAppUrl()}/apply/supplemental/${token}`;
    const sendEmail = parsed.data.sendEmail !== false;

    const school = await School.findById(ctx.schoolId).select("name").lean<{
      name?: string;
    } | null>();
    const schoolName = school?.name ?? "Your school";

    if (sendEmail) {
      await sendAdmissionDocumentRequestEmail({
        applicationId: String(app._id),
        referenceCode: app.referenceCode,
        guardian: app.guardian,
        documentLabel: parsed.data.label,
        message: parsed.data.message ?? null,
        uploadUrl,
        ctx: {
          schoolId: String(ctx.schoolId),
          schoolName,
          actorId: String(ctx.userId),
          actorRole: ctx.isAdmin ? "school_admin" : "admissions_officer",
        },
      });
    }

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
      metadata: {
        action: "supplemental_document_requested",
        label: parsed.data.label,
        emailSent: sendEmail,
      },
      at: new Date(),
    });

    return NextResponse.json({
      success: true,
      data: {
        uploadUrl,
        token,
        emailSent: sendEmail,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Request supplemental document error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create document request" },
      { status: 500 }
    );
  }
}
