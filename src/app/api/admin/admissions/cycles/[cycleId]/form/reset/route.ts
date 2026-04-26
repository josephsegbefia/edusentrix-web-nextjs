// src/app/api/admin/admissions/cycles/[cycleId]/form/reset/route.ts
// POST reset a cycle's form schema back to platform defaults.
// This bumps the version so historical applications keep their original snapshot.

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAdmissionsManager } from "@/lib/auth/requireAdmissionsManager";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AdmissionCycle } from "@/models/AdmissionCycle";
import { AdmissionForm } from "@/models/AdmissionForm";
import { AdmissionEvent } from "@/models/AdmissionEvent";
import { recordActivity } from "@/lib/audit/recordActivity";
import {
  getDefaultAdmissionFormSchema,
  serializeAdmissionForm,
} from "@/lib/admissions/service";

function toObjectId(value: unknown): mongoose.Types.ObjectId {
  if (value instanceof mongoose.Types.ObjectId) return value;
  return new mongoose.Types.ObjectId(String(value));
}

function isValidObjectId(value: string): boolean {
  return /^[a-f\d]{24}$/i.test(value);
}

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ cycleId: string }> }
) {
  try {
    const ctx = await requireAdmissionsManager();
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

    const userId = toObjectId(ctx.userId);
    const defaults = getDefaultAdmissionFormSchema();
    const latest = await AdmissionForm.findOne({
      cycleId: cycle._id,
    })
      .sort({ version: -1 })
      .select({ version: 1 })
      .lean();
    const nextVersion = (latest?.version ?? 0) + 1;

    const form = await AdmissionForm.create({
      schoolId: ctx.schoolId,
      cycleId: cycle._id,
      version: nextVersion,
      sections: defaults.sections,
      documentRequirements: defaults.documentRequirements,
      consentText: defaults.consentText,
      localeDefault: defaults.localeDefault,
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
      kind: "form.reset_to_defaults",
      metadata: { version: nextVersion },
    });

    await recordActivity({
      schoolId: ctx.schoolId,
      userId,
      type: "admissions.form.reset_to_defaults",
      entityType: "AdmissionForm",
      entityId: form._id,
      description: `Reset admissions form to defaults (v${nextVersion})`,
      metadata: { cycleId: String(cycle._id), version: nextVersion },
    });

    return NextResponse.json({
      success: true,
      data: serializeAdmissionForm(form.toObject() as Record<string, unknown>),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Admissions form reset error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to reset form schema" },
      { status: 500 }
    );
  }
}
