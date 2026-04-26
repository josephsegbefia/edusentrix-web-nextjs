// src/app/api/public/admissions/applications/[token]/route.ts
// PUBLIC tracker endpoint. Anyone holding the unguessable tracker token can
// see the status of their application. We deliberately keep the payload thin
// (no internal notes, no admin actions, no full submitted answers).
//
// See docs/ADMISSIONS_DEVELOPMENT_SPEC.md §5.7.

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AdmissionApplication } from "@/models/AdmissionApplication";
import { AdmissionCycle } from "@/models/AdmissionCycle";
import { AdmissionForm } from "@/models/AdmissionForm";
import { Grade } from "@/models/Grade";
import { School } from "@/models/School";
import type { PublicApplicationDTO } from "@/lib/admissions/public-shape";

type Params = Promise<{ token: string }>;

function clientIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null
  );
}

export async function GET(req: NextRequest, { params }: { params: Params }) {
  try {
    const { token } = await params;
    if (!token || token.length < 16) {
      return NextResponse.json(
        { success: false, error: "Invalid tracker link" },
        { status: 404 }
      );
    }

    await connectToDatabase();

    const application = await AdmissionApplication.findOne({
      "tracker.token": token,
    });
    if (!application) {
      return NextResponse.json(
        { success: false, error: "Application not found" },
        { status: 404 }
      );
    }

    application.tracker.lastViewedAt = new Date();
    application.tracker.lastViewedIp = clientIp(req);
    await application.save();

    const [cycle, school, form, grade] = await Promise.all([
      AdmissionCycle.findById(application.cycleId)
        .select({ name: 1, schoolId: 1, formId: 1, applicationFee: 1 })
        .lean(),
      School.findById(application.schoolId).select({ name: 1 }).lean(),
      application.cycleId
        ? AdmissionForm.findOne({ cycleId: application.cycleId })
            .sort({ version: -1 })
            .select({ documentRequirements: 1 })
            .lean()
        : null,
      application.applicant.intendedGradeId
        ? Grade.findById(application.applicant.intendedGradeId)
            .select({ name: 1 })
            .lean()
        : null,
    ]);

    const providedDocs = new Set(
      (application.documents ?? []).map((doc) => doc.requirementId)
    );
    const missingDocuments =
      form?.documentRequirements
        ?.filter((req) => req.required && !providedDocs.has(req.id))
        .map((req) => ({ id: req.id, label: req.label })) ?? [];

    const cycleFee =
      (cycle as { applicationFee?: { enabled?: boolean; amountMinor?: number; currency?: string; mode?: "manual_record" | "online_paystack"; instructions?: string | null } | null } | null)
        ?.applicationFee ?? null;

    const dto: PublicApplicationDTO = {
      applicationId: String(application._id),
      referenceCode: application.referenceCode,
      trackerUrl: req.url,
      status: application.status,
      submittedAt: application.submittedAt
        ? new Date(application.submittedAt).toISOString()
        : null,
      applicant: {
        firstName: application.applicant.firstName,
        lastName: application.applicant.lastName,
        intendedGradeName: grade ? String((grade as { name: string }).name) : null,
      },
      cycle: {
        name: cycle?.name ?? "Admission cycle",
        schoolName: (school as { name?: string } | null)?.name ?? "School",
      },
      missingDocuments,
      fee: {
        status: application.feeStatus,
        amountMinor: cycleFee?.enabled ? cycleFee.amountMinor ?? null : null,
        currency: cycleFee?.enabled ? cycleFee.currency ?? "GHS" : null,
        mode: cycleFee?.enabled ? cycleFee.mode ?? "manual_record" : null,
        instructions: cycleFee?.enabled ? cycleFee.instructions ?? null : null,
        paidAt: application.feePayment?.paidAt
          ? new Date(application.feePayment.paidAt).toISOString()
          : null,
      },
      interviewAt: application.interviewAt
        ? new Date(application.interviewAt).toISOString()
        : null,
      interviewEndsAt: application.interviewEndsAt
        ? new Date(application.interviewEndsAt).toISOString()
        : null,
    };

    return NextResponse.json({ success: true, data: dto });
  } catch (error) {
    console.error("Public application tracker GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load application status" },
      { status: 500 }
    );
  }
}
