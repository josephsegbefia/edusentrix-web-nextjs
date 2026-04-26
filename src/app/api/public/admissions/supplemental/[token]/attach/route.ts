// POST — attach an UploadThing file to a pending supplemental request.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AdmissionApplication } from "@/models/AdmissionApplication";
import { AdmissionEvent } from "@/models/AdmissionEvent";

type Params = Promise<{ token: string }>;

const BodySchema = z.object({
  fileUrl: z.string().url(),
  fileName: z.string().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  mimeType: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Params }) {
  try {
    const { token } = await params;
    if (!token || token.length < 24) {
      return NextResponse.json(
        { success: false, error: "Invalid link" },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid attachment",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const application = await AdmissionApplication.findOne({
      supplementalDocumentRequests: {
        $elemMatch: { token, fulfilledAt: null },
      },
    });
    if (!application) {
      return NextResponse.json(
        { success: false, error: "This upload link is invalid or already used." },
        { status: 404 }
      );
    }

    if (
      application.status === "accepted" ||
      application.status === "rejected" ||
      application.status === "withdrawn" ||
      application.status === "expired"
    ) {
      return NextResponse.json(
        { success: false, error: "This application is closed for uploads." },
        { status: 409 }
      );
    }

    const sub = (application.supplementalDocumentRequests ?? []).find(
      (r) => r.token === token && !r.fulfilledAt
    );
    if (!sub) {
      return NextResponse.json(
        { success: false, error: "This upload link is invalid or already used." },
        { status: 404 }
      );
    }

    const requirementId = `supplemental:${String(sub._id)}`;
    const docLabel = `[Requested] ${sub.label}`;

    application.documents.push({
      requirementId,
      label: docLabel,
      fileUrl: parsed.data.fileUrl,
      fileName: parsed.data.fileName,
      sizeBytes: parsed.data.sizeBytes,
      mimeType: parsed.data.mimeType,
      uploadedAt: new Date(),
    });
    sub.fulfilledAt = new Date();
    await application.save();

    await AdmissionEvent.create({
      schoolId: application.schoolId,
      cycleId: application.cycleId,
      applicationId: application._id,
      actor: {
        userId: null,
        role: "applicant",
        label:
          `${application.guardian.firstName} ${application.guardian.lastName}`.trim() ||
          "Applicant",
      },
      kind: "application.note_added",
      metadata: {
        action: "supplemental_document_uploaded",
        requirementId,
        label: docLabel,
      },
      at: new Date(),
    });

    return NextResponse.json({ success: true, data: { requirementId } });
  } catch (error) {
    console.error("Public supplemental attach error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to attach file" },
      { status: 500 }
    );
  }
}
