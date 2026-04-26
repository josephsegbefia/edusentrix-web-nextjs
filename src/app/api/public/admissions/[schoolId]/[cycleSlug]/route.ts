// src/app/api/public/admissions/[schoolId]/[cycleSlug]/route.ts
// PUBLIC, unauthenticated read endpoint for the application page.
// Returns the cycle metadata + active form schema + intake grade list.
//
// See docs/ADMISSIONS_DEVELOPMENT_SPEC.md §5.6.

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AdmissionCycle } from "@/models/AdmissionCycle";
import { AdmissionForm } from "@/models/AdmissionForm";
import { School } from "@/models/School";
import { Grade } from "@/models/Grade";
import type {
  PublicCycleDTO,
  PublicFormDTO,
  PublicGradeDTO,
} from "@/lib/admissions/public-shape";

type Params = Promise<{ schoolId: string; cycleSlug: string }>;

function isValidObjectId(value: string): boolean {
  return mongoose.Types.ObjectId.isValid(value);
}

export async function GET(
  _req: Request,
  { params }: { params: Params }
) {
  try {
    const { schoolId, cycleSlug } = await params;
    if (!schoolId || !isValidObjectId(schoolId) || !cycleSlug) {
      return NextResponse.json(
        { success: false, error: "Invalid admission link" },
        { status: 404 }
      );
    }

    await connectToDatabase();

    const schoolObjectId = new mongoose.Types.ObjectId(schoolId);
    const cycle = await AdmissionCycle.findOne({
      schoolId: schoolObjectId,
      slug: cycleSlug,
    }).lean();

    if (!cycle) {
      return NextResponse.json(
        { success: false, error: "Application is not available" },
        { status: 404 }
      );
    }

    if (cycle.status === "draft" || cycle.status === "archived") {
      return NextResponse.json(
        { success: false, error: "This admission cycle is not yet live." },
        { status: 404 }
      );
    }

    const school = await School.findById(schoolObjectId)
      .select({ name: 1, logo: 1 })
      .lean();

    const acceptingApplications =
      cycle.status === "published" &&
      (!cycle.acceptsApplicationsUntil ||
        new Date(cycle.acceptsApplicationsUntil).getTime() >= Date.now());

    let closedReason: string | null = null;
    if (cycle.status === "closed") {
      closedReason = "This admission cycle has closed.";
    } else if (cycle.status === "paused") {
      closedReason =
        "Applications are temporarily paused. Please check back soon.";
    } else if (
      cycle.acceptsApplicationsUntil &&
      new Date(cycle.acceptsApplicationsUntil).getTime() < Date.now()
    ) {
      closedReason = "The application deadline has passed.";
    }

    const cycleDTO: PublicCycleDTO = {
      schoolId: String(schoolObjectId),
      schoolName: school?.name ?? "School",
      schoolLogoUrl: (school?.logo as string | undefined) ?? null,
      cycleId: String(cycle._id),
      name: cycle.name,
      slug: cycle.slug,
      status: cycle.status as "published" | "paused" | "closed",
      acceptsApplicationsFrom: new Date(
        cycle.acceptsApplicationsFrom
      ).toISOString(),
      acceptsApplicationsUntil: cycle.acceptsApplicationsUntil
        ? new Date(cycle.acceptsApplicationsUntil).toISOString()
        : null,
      decisionDueBy: cycle.decisionDueBy
        ? new Date(cycle.decisionDueBy).toISOString()
        : null,
      branding: {
        accentColor: cycle.branding?.accentColor ?? null,
        welcomeMessage: cycle.branding?.welcomeMessage ?? null,
        heroImageUrl: cycle.branding?.heroImageUrl ?? null,
      },
      acceptingApplications,
      closedReason,
      applicationFee: cycle.applicationFee?.enabled
        ? {
            amountMinor: cycle.applicationFee.amountMinor,
            currency: cycle.applicationFee.currency || "GHS",
            mode: cycle.applicationFee.mode,
            instructions: cycle.applicationFee.instructions ?? null,
          }
        : null,
    };

    let formDTO: PublicFormDTO | null = null;
    if (cycle.formId) {
      const form = await AdmissionForm.findById(cycle.formId).lean();
      if (form) {
        const intakeIds = (cycle.intakeGradeIds ?? []) as mongoose.Types.ObjectId[];
        const grades = await Grade.find({
          schoolId: schoolObjectId,
          ...(intakeIds.length > 0 ? { _id: { $in: intakeIds } } : { isActive: true }),
        })
          .select({ _id: 1, name: 1, order: 1 })
          .sort({ order: 1, name: 1 })
          .lean();

        const intakeGrades: PublicGradeDTO[] = grades.map((g) => ({
          id: String(g._id),
          name: String(g.name),
        }));

        formDTO = {
          formId: String(form._id),
          version: form.version,
          sections: form.sections.filter((s) => s.fields.some((f) => f.visible !== false)),
          documentRequirements: form.documentRequirements,
          consentText: form.consentText,
          localeDefault: form.localeDefault,
          intakeGrades,
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: { cycle: cycleDTO, form: formDTO },
    });
  } catch (error) {
    console.error("Public admission cycle GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load application" },
      { status: 500 }
    );
  }
}
