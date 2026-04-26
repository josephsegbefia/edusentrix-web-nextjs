// src/app/api/admin/admissions/cycles/[cycleId]/route.ts
// GET   read a single cycle
// PATCH update editable fields on a cycle
// DELETE hard-delete an empty draft, or set status to archived
//
// See docs/ADMISSIONS_DEVELOPMENT_SPEC.md §5.1.

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAdmissionsManager } from "@/lib/auth/requireAdmissionsManager";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AdmissionApplication } from "@/models/AdmissionApplication";
import { AdmissionCycle } from "@/models/AdmissionCycle";
import { AdmissionEvent } from "@/models/AdmissionEvent";
import { AdmissionForm } from "@/models/AdmissionForm";
import { AdmissionInviteLink } from "@/models/AdmissionInviteLink";
import { recordActivity } from "@/lib/audit/recordActivity";
import { UpdateAdmissionCycleSchema } from "@/schemas/admissions";
import { serializeAdmissionCycle } from "@/lib/admissions/service";

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
    }).lean();
    if (!cycle) {
      return NextResponse.json(
        { success: false, error: "Cycle not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: serializeAdmissionCycle(cycle as Record<string, unknown>),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Admissions cycle GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load cycle" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
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

    if (cycle.status === "archived") {
      return NextResponse.json(
        {
          success: false,
          error: "Archived cycles cannot be edited",
        },
        { status: 409 }
      );
    }

    const body = await req.json();
    const parsed = UpdateAdmissionCycleSchema.safeParse(body);
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
    const userId = toObjectId(ctx.userId);

    if (typeof input.slug === "string" && input.slug !== cycle.slug) {
      const slugClash = await AdmissionCycle.findOne({
        schoolId: ctx.schoolId,
        slug: input.slug,
        _id: { $ne: cycle._id },
      })
        .select({ _id: 1 })
        .lean();
      if (slugClash) {
        return NextResponse.json(
          {
            success: false,
            error:
              "A cycle with this slug already exists. Choose a different slug.",
          },
          { status: 409 }
        );
      }
      cycle.slug = input.slug;
    }

    if (typeof input.name === "string") cycle.name = input.name;
    if (Array.isArray(input.intakeGradeIds)) {
      cycle.intakeGradeIds = input.intakeGradeIds.map(toObjectId);
    }
    if (input.targetAcademicPeriodId !== undefined) {
      cycle.targetAcademicPeriodId = input.targetAcademicPeriodId
        ? toObjectId(input.targetAcademicPeriodId)
        : null;
    }
    if (input.acceptsApplicationsFrom)
      cycle.acceptsApplicationsFrom = input.acceptsApplicationsFrom;
    if (input.acceptsApplicationsUntil !== undefined)
      cycle.acceptsApplicationsUntil = input.acceptsApplicationsUntil ?? null;
    if (input.decisionDueBy !== undefined)
      cycle.decisionDueBy = input.decisionDueBy ?? null;
    if (input.capacityByGradeId) {
      cycle.capacityByGradeId = new Map(
        Object.entries(input.capacityByGradeId)
      );
    }
    if (typeof input.waitlistEnabled === "boolean") {
      cycle.waitlistEnabled = input.waitlistEnabled;
    }
    if (input.applicationFee !== undefined) {
      cycle.applicationFee = input.applicationFee ?? null;
    }
    if (input.branding) {
      cycle.branding = { ...(cycle.branding ?? {}), ...input.branding };
    }
    if (input.acceptanceTemplate) {
      cycle.acceptanceTemplate = {
        ...cycle.acceptanceTemplate,
        ...input.acceptanceTemplate,
      };
    }
    if (input.rejectionTemplate) {
      cycle.rejectionTemplate = {
        ...cycle.rejectionTemplate,
        ...input.rejectionTemplate,
      };
    }

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
      kind: "cycle.updated",
      metadata: { fields: Object.keys(input) },
    });

    await recordActivity({
      schoolId: ctx.schoolId,
      userId,
      type: "admissions.cycle.updated",
      entityType: "AdmissionCycle",
      entityId: cycle._id,
      description: `Updated admission cycle: ${cycle.name}`,
      metadata: { cycleId: String(cycle._id), fields: Object.keys(input) },
    });

    return NextResponse.json({
      success: true,
      data: serializeAdmissionCycle(
        cycle.toObject() as unknown as Record<string, unknown>
      ),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Admissions cycle PATCH error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update cycle" },
      { status: 500 }
    );
  }
}

/**
 * Remove a cycle:
 * - Empty `draft` → hard-delete (forms, events, invites) in a transaction.
 * - Any other case (applications, or published/closed, etc.) → set status to
 *   `archived` so data and history stay intact.
 */
export async function DELETE(
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

    const schoolId = toObjectId(ctx.schoolId);
    const userId = toObjectId(ctx.userId);
    const cycleObjectId = new mongoose.Types.ObjectId(cycleId);

    const cycle = await AdmissionCycle.findOne({
      _id: cycleObjectId,
      schoolId,
    });
    if (!cycle) {
      return NextResponse.json(
        { success: false, error: "Cycle not found" },
        { status: 404 }
      );
    }

    if (cycle.status === "archived") {
      return NextResponse.json(
        { success: false, error: "This cycle is already archived" },
        { status: 409 }
      );
    }

    const appCount = await AdmissionApplication.countDocuments({
      schoolId,
      cycleId: cycle._id,
    });

    const shouldArchive = appCount > 0 || cycle.status !== "draft";

    if (shouldArchive) {
      const priorStatus = cycle.status;
      cycle.status = "archived";
      cycle.updatedBy = userId;
      await cycle.save();

      await AdmissionEvent.create({
        schoolId,
        cycleId: cycle._id,
        actor: {
          userId,
          role: ctx.isAdmin ? "school_admin" : "admissions_officer",
          label: "Admissions manager",
        },
        kind: "cycle.archived",
        metadata: { applicationCount: appCount, priorStatus },
      });

      await recordActivity({
        schoolId,
        userId,
        type: "admissions.cycle.archived",
        entityType: "AdmissionCycle",
        entityId: cycle._id,
        description: `Archived admission cycle: ${cycle.name}`,
        metadata: { cycleId: String(cycle._id), applicationCount: appCount },
      });

      return NextResponse.json({
        success: true,
        data: {
          action: "archived" as const,
          cycle: serializeAdmissionCycle(
            cycle.toObject() as unknown as Record<string, unknown>
          ),
        },
      });
    }

    const nameSnapshot = cycle.name;
    const slugSnapshot = cycle.slug;
    const deletedCycleId = cycle._id;

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await AdmissionEvent.deleteMany({
          schoolId,
          cycleId: deletedCycleId,
        }).session(session);
        await AdmissionInviteLink.deleteMany({
          schoolId,
          cycleId: deletedCycleId,
        }).session(session);
        await AdmissionForm.deleteMany({
          schoolId,
          cycleId: deletedCycleId,
        }).session(session);
        const gone = await AdmissionCycle.findOneAndDelete(
          { _id: deletedCycleId, schoolId, status: "draft" },
          { session }
        );
        if (!gone) {
          throw new Error("CONFLICT");
        }
      });
    } finally {
      await session.endSession();
    }

    await recordActivity({
      schoolId,
      userId,
      type: "admissions.cycle.deleted",
      entityType: "AdmissionCycle",
      entityId: deletedCycleId,
      description: `Deleted draft admission cycle: ${nameSnapshot}`,
      metadata: { cycleId: String(deletedCycleId), slug: slugSnapshot },
    });

    return NextResponse.json({
      success: true,
      data: { action: "deleted" as const, cycleId: String(deletedCycleId) },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error && error.message === "CONFLICT") {
      return NextResponse.json(
        {
          success: false,
          error: "Could not delete cycle. Refresh and try again.",
        },
        { status: 409 }
      );
    }
    console.error("Admissions cycle DELETE error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to remove cycle" },
      { status: 500 }
    );
  }
}
