// src/app/api/public/admissions/applications/[token]/documents/route.ts
// Attach an already-uploaded file to a submitted application using the
// applicant's tracker token. The actual binary upload is handled by
// UploadThing (admissionDocument route); this endpoint just records the
// metadata against the application.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AdmissionApplication } from "@/models/AdmissionApplication";
import { AdmissionEvent } from "@/models/AdmissionEvent";
import { deleteUploadedFile } from "@/lib/uploads/delete";

type Params = Promise<{ token: string }>;

const AttachSchema = z.object({
  requirementId: z.string().min(1),
  label: z.string().min(1),
  fileUrl: z.string().url(),
  fileName: z.string().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  mimeType: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Params }) {
  let uploadedFileUrl: string | null = null;
  try {
    const { token } = await params;
    if (!token || token.length < 16) {
      return NextResponse.json(
        { success: false, error: "Invalid tracker link" },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = AttachSchema.safeParse(body);
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
    uploadedFileUrl = parsed.data.fileUrl;

    await connectToDatabase();
    const application = await AdmissionApplication.findOne({
      "tracker.token": token,
    });
    if (!application) {
      await deleteUploadedFile(parsed.data.fileUrl);
      uploadedFileUrl = null;
      return NextResponse.json(
        { success: false, error: "Application not found" },
        { status: 404 }
      );
    }

    if (
      application.status === "accepted" ||
      application.status === "rejected" ||
      application.status === "withdrawn" ||
      application.status === "expired"
    ) {
      await deleteUploadedFile(parsed.data.fileUrl);
      uploadedFileUrl = null;
      return NextResponse.json(
        {
          success: false,
          error: "This application is no longer accepting documents.",
        },
        { status: 409 }
      );
    }

    const existingIdx = application.documents.findIndex(
      (doc) => doc.requirementId === parsed.data.requirementId
    );
    const newDoc = {
      requirementId: parsed.data.requirementId,
      label: parsed.data.label,
      fileUrl: parsed.data.fileUrl,
      fileName: parsed.data.fileName,
      sizeBytes: parsed.data.sizeBytes,
      mimeType: parsed.data.mimeType,
      uploadedAt: new Date(),
    };

    if (existingIdx >= 0) {
      application.documents.splice(existingIdx, 1, newDoc);
    } else {
      application.documents.push(newDoc);
    }
    try {
      await application.save();
    } catch (error) {
      const deleted = await deleteUploadedFile(parsed.data.fileUrl);
      if (!deleted) {
        console.error("Rollback failed for admission document upload:", parsed.data.fileUrl);
      }
      throw error;
    }
    uploadedFileUrl = null;

    try {
      await AdmissionEvent.create({
        schoolId: application.schoolId,
        cycleId: application.cycleId,
        applicationId: application._id,
        actor: {
          userId: null,
          role: "applicant",
          label: `${application.guardian.firstName} ${application.guardian.lastName}`.trim() ||
            "Applicant",
        },
        kind: "application.note_added",
        metadata: {
          action: "document_uploaded",
          requirementId: parsed.data.requirementId,
          label: parsed.data.label,
        },
        at: new Date(),
      });
    } catch (eventError) {
      console.error("Admission document event logging failed:", eventError);
    }

    return NextResponse.json({
      success: true,
      data: {
        documents: application.documents,
      },
    });
  } catch (error) {
    if (uploadedFileUrl) {
      const deleted = await deleteUploadedFile(uploadedFileUrl);
      if (!deleted) {
        console.error("Rollback failed for admission document upload:", uploadedFileUrl);
      }
    }
    console.error("Public application document upload error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to attach document" },
      { status: 500 }
    );
  }
}
