// src/app/api/admin/admissions/cycles/[cycleId]/form/route.ts
// GET  read the latest form schema for a cycle
// PUT  replace the form schema, bumping the version (preserves
//      platform-required fields).
//
// See docs/ADMISSIONS_DEVELOPMENT_SPEC.md §5.2.

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAdmissionsManager } from "@/lib/auth/requireAdmissionsManager";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AdmissionCycle } from "@/models/AdmissionCycle";
import { AdmissionForm } from "@/models/AdmissionForm";
import { AdmissionEvent } from "@/models/AdmissionEvent";
import { recordAdmissionsManagerActivity } from "@/lib/admissions/recordAdmissionsManagerActivity";
import { UpdateAdmissionFormSchema } from "@/schemas/admissions";
import {
  serializeAdmissionForm,
  validatePlatformRequiredFields,
} from "@/lib/admissions/service";
import { requireAdmissionsPermission } from "@/lib/admissions/admissions-api-permissions";

function toObjectId(value: unknown): mongoose.Types.ObjectId {
  if (value instanceof mongoose.Types.ObjectId) return value;
  return new mongoose.Types.ObjectId(String(value));
}

function isValidObjectId(value: string): boolean {
  return /^[a-f\d]{24}$/i.test(value);
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ cycleId: string }> }
) {
  try {
    const ctx = await requireAdmissionsManager();
    requireAdmissionsPermission(ctx, "admissions.view");
    const { cycleId } = await context.params;
    if (!isValidObjectId(cycleId)) {
      return NextResponse.json(
        { success: false, error: "Invalid cycle id" },
        { status: 400 }
      );
    }
    await connectToDatabase();

    const cycle = await AdmissionCycle.findOne({
      _id: cycleId,
      schoolId: ctx.schoolId,
    })
      .select({ formId: 1 })
      .lean();
    if (!cycle) {
      return NextResponse.json(
        { success: false, error: "Cycle not found" },
        { status: 404 }
      );
    }

    const form = await AdmissionForm.findOne({
      cycleId: cycle._id,
      schoolId: ctx.schoolId,
    })
      .sort({ version: -1 })
      .lean();
    if (!form) {
      return NextResponse.json(
        { success: false, error: "Form schema not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: serializeAdmissionForm(form as Record<string, unknown>),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Admissions form GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load form schema" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ cycleId: string }> }
) {
  try {
    const ctx = await requireAdmissionsManager();
    requireAdmissionsPermission(ctx, "admissions.manage_form");
    const { cycleId } = await context.params;
    if (!isValidObjectId(cycleId)) {
      return NextResponse.json(
        { success: false, error: "Invalid cycle id" },
        { status: 400 }
      );
    }
    await connectToDatabase();

    const cycle = await AdmissionCycle.findOne({
      _id: cycleId,
      schoolId: ctx.schoolId,
    });
    if (!cycle) {
      return NextResponse.json(
        { success: false, error: "Cycle not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const parsed = UpdateAdmissionFormSchema.safeParse(body);
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

    const validation = validatePlatformRequiredFields(parsed.data);
    if (!validation.ok) {
      return NextResponse.json(
        {
          success: false,
          error: validation.reason,
          missing: validation.missing,
        },
        { status: 400 }
      );
    }

    const userId = toObjectId(ctx.userId);
    const latestVersion = await AdmissionForm.findOne({
      cycleId: cycle._id,
    })
      .sort({ version: -1 })
      .select({ version: 1 })
      .lean();
    const nextVersion = (latestVersion?.version ?? 0) + 1;

    const form = await AdmissionForm.create({
      schoolId: ctx.schoolId,
      cycleId: cycle._id,
      version: nextVersion,
      sections: parsed.data.sections,
      documentRequirements: parsed.data.documentRequirements,
      consentText: parsed.data.consentText,
      localeDefault: parsed.data.localeDefault,
      createdBy: userId,
      updatedBy: userId,
    });

    cycle.formId = form._id;
    cycle.updatedBy = userId;
    await cycle.save();

    await AdmissionEvent.create({
      schoolId: ctx.schoolId,
      cycleId: cycle._id,
      actor: {
        userId,
        role: ctx.isAdmin ? "school_admin" : "admissions_officer",
        label: "Admissions manager",
      },
      kind: "form.updated",
      metadata: { version: nextVersion },
    });

    await recordAdmissionsManagerActivity({
      ctx,
      type: "admissions.form.updated",
      entityType: "AdmissionForm",
      entityId: form._id,
      description: `Updated admissions form schema (v${nextVersion})`,
      delegationAction: "admissions.form.updated",
      metadata: {
        cycleId: String(cycle._id),
        version: nextVersion,
      },
    });

    return NextResponse.json({
      success: true,
      data: serializeAdmissionForm(form.toObject() as Record<string, unknown>),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Admissions form PUT error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save form schema" },
      { status: 500 }
    );
  }
}
