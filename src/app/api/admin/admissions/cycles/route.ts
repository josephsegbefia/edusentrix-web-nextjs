// src/app/api/admin/admissions/cycles/route.ts
// GET   list admission cycles for the school
// POST  create a new admission cycle (draft) and seed its default form schema
//
// See docs/ADMISSIONS_DEVELOPMENT_SPEC.md §5.1.

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAdmissionsManager } from "@/lib/auth/requireAdmissionsManager";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AdmissionCycle } from "@/models/AdmissionCycle";
import { AdmissionForm } from "@/models/AdmissionForm";
import { AdmissionEvent } from "@/models/AdmissionEvent";
import { School } from "@/models/School";
import { recordAdmissionsManagerActivity } from "@/lib/admissions/recordAdmissionsManagerActivity";
import { CreateAdmissionCycleSchema } from "@/schemas/admissions";
import {
  serializeAdmissionCycle,
  getDefaultAdmissionFormSchema,
} from "@/lib/admissions/service";
import {
  DEFAULT_ACCEPTANCE_TEMPLATE,
  DEFAULT_REJECTION_TEMPLATE,
} from "@/lib/admissions/defaults";
import { getAdmissionCycleTemplate } from "@/lib/admissions/templates";
import { requireAdmissionsPermission } from "@/lib/admissions/admissions-api-permissions";

function toObjectId(value: unknown): mongoose.Types.ObjectId {
  if (value instanceof mongoose.Types.ObjectId) return value;
  return new mongoose.Types.ObjectId(String(value));
}

export async function GET() {
  try {
    const ctx = await requireAdmissionsManager();
    requireAdmissionsPermission(ctx, "admissions.view");
    await connectToDatabase();

    const cycles = await AdmissionCycle.find({ schoolId: ctx.schoolId })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: cycles.map((cycle) =>
        serializeAdmissionCycle(cycle as Record<string, unknown>)
      ),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Admissions cycles GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load admission cycles" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAdmissionsManager();
    requireAdmissionsPermission(ctx, "admissions.manage_cycle");
    await connectToDatabase();

    const body = await req.json();
    const parsed = CreateAdmissionCycleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const schoolId = toObjectId(ctx.schoolId);
    const userId = toObjectId(ctx.userId);

    const slugClash = await AdmissionCycle.findOne({
      schoolId,
      slug: input.slug,
    })
      .select({ _id: 1 })
      .lean();
    if (slugClash) {
      return NextResponse.json(
        {
          success: false,
          error: "A cycle with this slug already exists. Choose a different slug.",
        },
        { status: 409 }
      );
    }

    const intakeGradeIds = (input.intakeGradeIds ?? [])
      .map((id) => {
        try {
          return new mongoose.Types.ObjectId(id);
        } catch {
          return null;
        }
      })
      .filter(Boolean) as mongoose.Types.ObjectId[];

    if (input.templateId === "standard_shs") {
      const school = await School.findById(schoolId).select({ type: 1 }).lean();
      if (school?.type !== "SHS") {
        return NextResponse.json(
          {
            success: false,
            error: "The SHS admissions template is only available to SHS schools.",
          },
          { status: 400 }
        );
      }
    }

    const template = getAdmissionCycleTemplate(input.templateId ?? null);
    const seededBranding = {
      ...(input.branding ?? {}),
      welcomeMessage:
        input.branding?.welcomeMessage ?? template?.defaults.welcomeMessage ?? null,
    };

    const cycle = await AdmissionCycle.create({
      schoolId,
      name: input.name,
      slug: input.slug,
      intakeGradeIds,
      targetAcademicPeriodId: input.targetAcademicPeriodId
        ? toObjectId(input.targetAcademicPeriodId)
        : null,
      acceptsApplicationsFrom: input.acceptsApplicationsFrom,
      acceptsApplicationsUntil: input.acceptsApplicationsUntil ?? null,
      decisionDueBy: input.decisionDueBy ?? null,
      capacityByGradeId: new Map(
        Object.entries(input.capacityByGradeId ?? {})
      ),
      waitlistEnabled: input.waitlistEnabled,
      applicationFee: input.applicationFee ?? null,
      branding: seededBranding,
      status: "draft",
      acceptanceTemplate: DEFAULT_ACCEPTANCE_TEMPLATE,
      rejectionTemplate: DEFAULT_REJECTION_TEMPLATE,
      analytics: { totalSubmissions: 0, byStatus: {}, byChannel: {} },
      createdBy: userId,
      updatedBy: userId,
    });

    const seedSchema = template ? template.buildSchema() : getDefaultAdmissionFormSchema();
    const form = await AdmissionForm.create({
      schoolId,
      cycleId: cycle._id,
      version: 1,
      sections: seedSchema.sections,
      documentRequirements: seedSchema.documentRequirements,
      consentText: seedSchema.consentText,
      localeDefault: seedSchema.localeDefault,
      createdBy: userId,
      updatedBy: userId,
    });

    cycle.formId = form._id;
    await cycle.save();

    await AdmissionEvent.create({
      schoolId,
      cycleId: cycle._id,
      actor: { userId, role: ctx.isAdmin ? "school_admin" : "admissions_officer", label: "Admissions manager" },
      kind: "cycle.created",
      metadata: {
        name: cycle.name,
        slug: cycle.slug,
        templateId: template?.id ?? null,
      },
    });

    await recordAdmissionsManagerActivity({
      ctx,
      type: "admissions.cycle.created",
      entityType: "AdmissionCycle",
      entityId: cycle._id,
      description: `Created admission cycle: ${cycle.name}`,
      delegationAction: "admissions.cycle.created",
      metadata: {
        cycleId: String(cycle._id),
        slug: cycle.slug,
      },
    });

    return NextResponse.json({
      success: true,
      data: serializeAdmissionCycle(cycle.toObject() as Record<string, unknown>),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Admissions cycles POST error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create admission cycle" },
      { status: 500 }
    );
  }
}
