// src/app/api/public/admissions/[schoolId]/[cycleSlug]/applications/route.ts
// PUBLIC, unauthenticated submission endpoint.
//
// POST  Create a new application submission for a published cycle.
//
// See docs/ADMISSIONS_DEVELOPMENT_SPEC.md §5.7.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AdmissionCycle } from "@/models/AdmissionCycle";
import { AdmissionForm } from "@/models/AdmissionForm";
import { AdmissionApplication } from "@/models/AdmissionApplication";
import { AdmissionEvent } from "@/models/AdmissionEvent";
import { School } from "@/models/School";
import { sendAdmissionApplicationReceivedEmail } from "@/lib/admissions/applicant-notification-emails";
import {
  generateReferenceCode,
  generateTrackerToken,
} from "@/lib/admissions/tokens";
import { validateAndNormalizeSubmission } from "@/lib/admissions/submission";
import type { AdmissionFormSchema } from "@/lib/admissions/types";
import { deleteUploadedFiles } from "@/lib/uploads/delete";

type Params = Promise<{ schoolId: string; cycleSlug: string }>;

const ChannelEnum = z.enum([
  "public_link",
  "embed",
  "qr",
  "direct_invite",
  "whatsapp",
  "internal",
]);

const SubmissionSchema = z.object({
  answers: z.record(z.string(), z.unknown()).default({}),
  documents: z
    .array(
      z.object({
        requirementId: z.string().min(1),
        label: z.string().min(1).optional(),
        fileUrl: z.string().url(),
        fileName: z.string().optional(),
        sizeBytes: z.number().int().nonnegative().optional(),
        mimeType: z.string().optional(),
      })
    )
    .default([]),
  channel: ChannelEnum.default("public_link"),
  referrer: z.string().max(500).optional(),
  inviteCode: z.string().max(64).optional(),
});

function originFromRequest(req: NextRequest): string {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(req: NextRequest, { params }: { params: Params }) {
  let uploadedDocumentUrls: string[] = [];
  try {
    const { schoolId, cycleSlug } = await params;
    if (!schoolId || !mongoose.Types.ObjectId.isValid(schoolId) || !cycleSlug) {
      return NextResponse.json(
        { success: false, error: "Invalid admission link" },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = SubmissionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid submission",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }
    uploadedDocumentUrls = parsed.data.documents.map((document) => document.fileUrl);

    await connectToDatabase();

    const schoolObjectId = new mongoose.Types.ObjectId(schoolId);
    const cycle = await AdmissionCycle.findOne({
      schoolId: schoolObjectId,
      slug: cycleSlug,
    });
    if (!cycle) {
      await deleteUploadedFiles(uploadedDocumentUrls);
      uploadedDocumentUrls = [];
      return NextResponse.json(
        { success: false, error: "Cycle not found" },
        { status: 404 }
      );
    }
    if (cycle.status !== "published") {
      await deleteUploadedFiles(uploadedDocumentUrls);
      uploadedDocumentUrls = [];
      return NextResponse.json(
        {
          success: false,
          error:
            cycle.status === "paused"
              ? "Applications are temporarily paused."
              : "This admission cycle is not accepting applications.",
        },
        { status: 409 }
      );
    }
    if (
      cycle.acceptsApplicationsUntil &&
      new Date(cycle.acceptsApplicationsUntil).getTime() < Date.now()
    ) {
      await deleteUploadedFiles(uploadedDocumentUrls);
      uploadedDocumentUrls = [];
      return NextResponse.json(
        { success: false, error: "The application deadline has passed." },
        { status: 409 }
      );
    }
    if (!cycle.formId) {
      await deleteUploadedFiles(uploadedDocumentUrls);
      uploadedDocumentUrls = [];
      return NextResponse.json(
        { success: false, error: "Application form is not configured." },
        { status: 500 }
      );
    }

    const form = await AdmissionForm.findById(cycle.formId).lean();
    if (!form) {
      await deleteUploadedFiles(uploadedDocumentUrls);
      uploadedDocumentUrls = [];
      return NextResponse.json(
        { success: false, error: "Application form not found." },
        { status: 500 }
      );
    }

    const schema: AdmissionFormSchema = {
      sections: form.sections,
      documentRequirements: form.documentRequirements,
      consentText: form.consentText,
      localeDefault: form.localeDefault,
    };

    const validation = validateAndNormalizeSubmission(schema, {
      answers: parsed.data.answers as Record<string, never>,
      documents: parsed.data.documents,
    });
    if (!validation.ok) {
      await deleteUploadedFiles(uploadedDocumentUrls);
      uploadedDocumentUrls = [];
      return NextResponse.json(
        {
          success: false,
          error: "Some fields need attention",
          fieldErrors: validation.errors,
        },
        { status: 422 }
      );
    }

    const data = validation.data;
    if (!data.consentGiven) {
      await deleteUploadedFiles(uploadedDocumentUrls);
      uploadedDocumentUrls = [];
      return NextResponse.json(
        { success: false, error: "Consent is required" },
        { status: 422 }
      );
    }

    // Reference code uniqueness retry — 3 attempts is plenty given 6^31 entropy.
    let referenceCode = "";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = generateReferenceCode("APP");
      const clash = await AdmissionApplication.findOne({
        schoolId: schoolObjectId,
        referenceCode: candidate,
      }).select({ _id: 1 }).lean();
      if (!clash) {
        referenceCode = candidate;
        break;
      }
    }
    if (!referenceCode) {
      await deleteUploadedFiles(uploadedDocumentUrls);
      uploadedDocumentUrls = [];
      return NextResponse.json(
        { success: false, error: "Could not generate a reference code. Please retry." },
        { status: 500 }
      );
    }

    const trackerToken = generateTrackerToken();
    const additionalEntries = Object.entries(data.additional);
    const documentLabelByRequirement = new Map(
      schema.documentRequirements.map((requirement) => [
        requirement.id,
        requirement.label,
      ])
    );
    const submittedDocuments = parsed.data.documents.map((document) => ({
      ...document,
      label:
        document.label ??
        documentLabelByRequirement.get(document.requirementId) ??
        "Uploaded document",
    }));

    const application = await AdmissionApplication.create({
      schoolId: schoolObjectId,
      cycleId: cycle._id,
      formVersion: form.version,
      referenceCode,
      submittedAt: new Date(),
      channel: parsed.data.channel,
      referrer: parsed.data.referrer ?? null,
      inviteCode: parsed.data.inviteCode ?? null,
      applicant: {
        firstName: data.applicant.firstName,
        lastName: data.applicant.lastName,
        sex: data.applicant.sex,
        dateOfBirth: data.applicant.dateOfBirth,
        intendedGradeId: data.applicant.intendedGradeId
          ? new mongoose.Types.ObjectId(data.applicant.intendedGradeId)
          : null,
        photoUrl: data.applicant.photoUrl,
        address: data.applicant.address,
      },
      guardian: {
        firstName: data.guardian.firstName,
        lastName: data.guardian.lastName,
        relationship: data.guardian.relationship,
        email: data.guardian.email,
        phone: data.guardian.phone,
        address: data.guardian.address,
        occupation: data.guardian.occupation,
      },
      additional: new Map(additionalEntries),
      documents: submittedDocuments,
      status: "submitted",
      tracker: { token: trackerToken },
      feeStatus: cycle.applicationFee?.enabled ? "pending" : "not_required",
    });
    uploadedDocumentUrls = [];

    // Update cycle analytics in-place. Inexpensive while submission volume is
    // small; we'll move to background aggregation if needed.
    cycle.analytics = cycle.analytics ?? {
      totalSubmissions: 0,
      byStatus: {},
      byChannel: {},
    };
    cycle.analytics.totalSubmissions =
      (cycle.analytics.totalSubmissions ?? 0) + 1;
    const byStatus = (cycle.analytics.byStatus ?? {}) as Record<string, number>;
    byStatus.submitted = (byStatus.submitted ?? 0) + 1;
    cycle.analytics.byStatus = byStatus;
    const byChannel = (cycle.analytics.byChannel ?? {}) as Record<string, number>;
    byChannel[parsed.data.channel] = (byChannel[parsed.data.channel] ?? 0) + 1;
    cycle.analytics.byChannel = byChannel;
    cycle.markModified("analytics");
    await cycle.save();

    try {
      await AdmissionEvent.create({
        schoolId: schoolObjectId,
        cycleId: cycle._id,
        applicationId: application._id,
        actor: {
          userId: null,
          role: "applicant",
          label: `${data.guardian.firstName} ${data.guardian.lastName}`.trim() || "Applicant",
        },
        kind: "application.submitted",
        metadata: {
          channel: parsed.data.channel,
          referenceCode,
          intendedGradeId: data.applicant.intendedGradeId,
        },
        at: new Date(),
      });
    } catch (eventError) {
      console.error("Admission submission event logging failed:", eventError);
    }

    const school = await School.findById(schoolObjectId).select("name").lean<{
      name?: string;
    } | null>();
    const schoolName = school?.name ?? "Our school";
    try {
      await sendAdmissionApplicationReceivedEmail({
        applicationId: String(application._id),
        referenceCode,
        guardian: {
          firstName: application.guardian.firstName,
          lastName: application.guardian.lastName,
          email: application.guardian.email,
        },
        trackerToken,
        ctx: {
          schoolId: String(schoolObjectId),
          schoolName,
        },
        systemOrigin: true,
      });
    } catch (emailErr) {
      console.error("Admission confirmation email failed:", emailErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        applicationId: String(application._id),
        referenceCode,
        trackerToken,
        trackerUrl: `${originFromRequest(req)}/apply/track/${trackerToken}`,
      },
    });
  } catch (error) {
    if (uploadedDocumentUrls.length > 0) {
      const result = await deleteUploadedFiles(uploadedDocumentUrls);
      if (result.failed > 0) {
        console.error("Rollback failed for some admission submission uploads:", result);
      }
    }
    console.error("Public admission submission error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit application" },
      { status: 500 }
    );
  }
}
