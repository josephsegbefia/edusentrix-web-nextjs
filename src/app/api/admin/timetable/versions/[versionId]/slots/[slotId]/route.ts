import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { TimetableSlot } from "@/models/TimetableSlot";
import { TimetableVersion } from "@/models/TimetableVersion";
import {
  buildTimetableSlotSnapshot,
  recordTimetableActivity,
  recordTimetableChangeLog,
} from "@/lib/timetable/audit";
import { resolveClassroomLabel } from "@/lib/timetable/classroom-label";
import { recomputeConflictsForVersion } from "@/lib/timetable/recompute-conflicts";
import { validateTimetableSlotReferences } from "@/lib/timetable/validate";
import { isTimetableApiWriteEnabled } from "@/lib/timetable/feature-flags";

type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type SlotSource = "manual" | "imported" | "assignment_sync";

function toObjectIdOrNull(value: string | null | undefined): mongoose.Types.ObjectId | null {
  if (!value) return null;
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    return null;
  }
}

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isDayOfWeek(value: number): value is DayOfWeek {
  return Number.isInteger(value) && value >= 0 && value <= 6;
}

function isSlotSource(value: string): value is SlotSource {
  return value === "manual" || value === "imported" || value === "assignment_sync";
}

function toSlotDto(slot: {
  _id: mongoose.Types.ObjectId;
  schoolId: mongoose.Types.ObjectId;
  academicPeriodId: mongoose.Types.ObjectId;
  versionId: mongoose.Types.ObjectId;
  classGroupId: mongoose.Types.ObjectId;
  gradeId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  classroomLabel: string;
  source: string;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: String(slot._id),
    schoolId: String(slot.schoolId),
    academicPeriodId: String(slot.academicPeriodId),
    versionId: String(slot.versionId),
    classGroupId: String(slot.classGroupId),
    gradeId: String(slot.gradeId),
    subjectId: String(slot.subjectId),
    teacherId: String(slot.teacherId),
    dayOfWeek: slot.dayOfWeek,
    startTime: slot.startTime,
    endTime: slot.endTime,
    classroomLabel: slot.classroomLabel,
    source: slot.source,
    createdBy: String(slot.createdBy),
    updatedBy: String(slot.updatedBy),
    createdAt: new Date(slot.createdAt).toISOString(),
    updatedAt: new Date(slot.updatedAt).toISOString(),
  };
}

interface PatchSlotBody {
  classGroupId?: string;
  gradeId?: string;
  subjectId?: string;
  teacherId?: string;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  classroomLabel?: string | null;
  source?: SlotSource;
}

/**
 * PATCH /api/admin/timetable/versions/:versionId/slots/:slotId
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ versionId: string; slotId: string }> }
) {
  try {
    if (!isTimetableApiWriteEnabled()) {
      return NextResponse.json(
        { success: false, error: "Timetable admin planner is disabled." },
        { status: 404 }
      );
    }

    const { schoolId, userId } = await requireSchoolAdminOrDelegatedAnyPermission([
      "timetable.edit",
    ]);
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const userIdObj = new mongoose.Types.ObjectId(String(userId));
    const { versionId, slotId } = await ctx.params;

    const versionObjId = toObjectIdOrNull(versionId);
    const slotObjId = toObjectIdOrNull(slotId);
    if (!versionObjId || !slotObjId) {
      return NextResponse.json(
        { success: false, error: "versionId and slotId must be valid ObjectIds." },
        { status: 400 }
      );
    }

    const version = await TimetableVersion.findOne({
      _id: versionObjId,
      schoolId: schoolIdObj,
    });
    if (!version) {
      return NextResponse.json(
        { success: false, error: "Timetable version not found for school." },
        { status: 404 }
      );
    }
    if (version.status !== "draft") {
      return NextResponse.json(
        { success: false, error: "Only draft timetable versions can be mutated." },
        { status: 409 }
      );
    }

    const existing = await TimetableSlot.findOne({
      _id: slotObjId,
      schoolId: schoolIdObj,
      versionId: versionObjId,
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Timetable slot not found for version." },
        { status: 404 }
      );
    }

    const body = (await req.json()) as PatchSlotBody;

    const hasAnyField =
      body.classGroupId !== undefined ||
      body.gradeId !== undefined ||
      body.subjectId !== undefined ||
      body.teacherId !== undefined ||
      body.dayOfWeek !== undefined ||
      body.startTime !== undefined ||
      body.endTime !== undefined ||
      body.classroomLabel !== undefined ||
      body.source !== undefined;

    if (!hasAnyField) {
      return NextResponse.json(
        { success: false, error: "No mutation fields provided." },
        { status: 400 }
      );
    }

    if (body.source !== undefined && !isSlotSource(body.source)) {
      return NextResponse.json(
        { success: false, error: "source must be one of: manual, imported, assignment_sync." },
        { status: 400 }
      );
    }

    const classGroupId =
      body.classGroupId !== undefined
        ? toObjectIdOrNull(body.classGroupId)
        : existing.classGroupId;
    const gradeId =
      body.gradeId !== undefined ? toObjectIdOrNull(body.gradeId) : existing.gradeId;
    const subjectId =
      body.subjectId !== undefined
        ? toObjectIdOrNull(body.subjectId)
        : existing.subjectId;
    const teacherId =
      body.teacherId !== undefined
        ? toObjectIdOrNull(body.teacherId)
        : existing.teacherId;

    if (!classGroupId || !gradeId || !subjectId || !teacherId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "classGroupId, gradeId, subjectId, and teacherId must be valid ObjectIds when provided.",
        },
        { status: 400 }
      );
    }

    const dayOfWeekCandidate =
      body.dayOfWeek !== undefined ? body.dayOfWeek : existing.dayOfWeek;
    if (!isDayOfWeek(dayOfWeekCandidate)) {
      return NextResponse.json(
        { success: false, error: "dayOfWeek must be an integer from 0 to 6." },
        { status: 400 }
      );
    }
    const dayOfWeek: DayOfWeek = dayOfWeekCandidate;
    const startTime = body.startTime !== undefined ? body.startTime : existing.startTime;
    const endTime = body.endTime !== undefined ? body.endTime : existing.endTime;

    let classroomLabel = existing.classroomLabel;
    const explicitClassroomProvided = body.classroomLabel !== undefined;
    if (explicitClassroomProvided) {
      classroomLabel = normalizeSpaces(String(body.classroomLabel || ""));
    }
    const classContextChanged =
      body.classGroupId !== undefined || body.gradeId !== undefined;
    if (!classroomLabel || (!explicitClassroomProvided && classContextChanged)) {
      classroomLabel = (
        await resolveClassroomLabel({
          schoolId: schoolIdObj,
          classGroupId,
          gradeId,
        })
      ).classroomLabel;
    }

    const issues = await validateTimetableSlotReferences({
      schoolId: schoolIdObj,
      classGroupId,
      gradeId,
      subjectId,
      teacherId,
      dayOfWeek,
      startTime,
      endTime,
      classroomLabel,
    });
    if (issues.length > 0) {
      return NextResponse.json(
        { success: false, error: "Slot validation failed.", issues },
        { status: 400 }
      );
    }

    const beforeSnapshot = buildTimetableSlotSnapshot(existing);

    existing.classGroupId = classGroupId;
    existing.gradeId = gradeId;
    existing.subjectId = subjectId;
    existing.teacherId = teacherId;
    existing.dayOfWeek = dayOfWeek;
    existing.startTime = startTime;
    existing.endTime = endTime;
    existing.classroomLabel = classroomLabel;
    if (body.source !== undefined) {
      existing.source = body.source;
    }
    existing.updatedBy = userIdObj;

    await existing.save();

    await recordTimetableChangeLog({
      schoolId: schoolIdObj,
      academicPeriodId: version.academicPeriodId,
      versionId: versionObjId,
      action: "slot_updated",
      actorId: userIdObj,
      entityId: existing._id,
      before: beforeSnapshot,
      after: buildTimetableSlotSnapshot(existing),
    });

    await recordTimetableActivity({
      schoolId: schoolIdObj,
      userId: userIdObj,
      type: "timetable.slot.updated",
      description: "Updated timetable slot",
      entityType: "TimetableSlot",
      entityId: existing._id,
      metadata: {
        versionId: String(versionObjId),
      },
    });

    const conflictSummary = await recomputeConflictsForVersion({
      schoolId: schoolIdObj,
      versionId: versionObjId,
    });

    return NextResponse.json({
      success: true,
      data: toSlotDto(
        existing.toObject() as {
          _id: mongoose.Types.ObjectId;
          schoolId: mongoose.Types.ObjectId;
          academicPeriodId: mongoose.Types.ObjectId;
          versionId: mongoose.Types.ObjectId;
          classGroupId: mongoose.Types.ObjectId;
          gradeId: mongoose.Types.ObjectId;
          subjectId: mongoose.Types.ObjectId;
          teacherId: mongoose.Types.ObjectId;
          dayOfWeek: number;
          startTime: string;
          endTime: string;
          classroomLabel: string;
          source: string;
          createdBy: mongoose.Types.ObjectId;
          updatedBy: mongoose.Types.ObjectId;
          createdAt: Date;
          updatedAt: Date;
        }
      ),
      conflicts: conflictSummary,
    });
  } catch (e: unknown) {
    console.error("Failed to patch timetable slot:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to patch slot." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/timetable/versions/:versionId/slots/:slotId
 */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ versionId: string; slotId: string }> }
) {
  try {
    if (!isTimetableApiWriteEnabled()) {
      return NextResponse.json(
        { success: false, error: "Timetable admin planner is disabled." },
        { status: 404 }
      );
    }

    const { schoolId, userId } = await requireSchoolAdminOrDelegatedAnyPermission([
      "timetable.edit",
    ]);
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const userIdObj = new mongoose.Types.ObjectId(String(userId));
    const { versionId, slotId } = await ctx.params;
    const versionObjId = toObjectIdOrNull(versionId);
    const slotObjId = toObjectIdOrNull(slotId);
    if (!versionObjId || !slotObjId) {
      return NextResponse.json(
        { success: false, error: "versionId and slotId must be valid ObjectIds." },
        { status: 400 }
      );
    }

    const version = await TimetableVersion.findOne({
      _id: versionObjId,
      schoolId: schoolIdObj,
    });
    if (!version) {
      return NextResponse.json(
        { success: false, error: "Timetable version not found for school." },
        { status: 404 }
      );
    }
    if (version.status !== "draft") {
      return NextResponse.json(
        { success: false, error: "Only draft timetable versions can be mutated." },
        { status: 409 }
      );
    }

    const existing = await TimetableSlot.findOne({
      _id: slotObjId,
      schoolId: schoolIdObj,
      versionId: versionObjId,
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Timetable slot not found for version." },
        { status: 404 }
      );
    }

    const beforeSnapshot = buildTimetableSlotSnapshot(existing);

    await TimetableSlot.deleteOne({
      _id: slotObjId,
      schoolId: schoolIdObj,
      versionId: versionObjId,
    });

    await recordTimetableChangeLog({
      schoolId: schoolIdObj,
      academicPeriodId: version.academicPeriodId,
      versionId: versionObjId,
      action: "slot_deleted",
      actorId: userIdObj,
      entityId: existing._id,
      before: beforeSnapshot,
      after: null,
    });

    await recordTimetableActivity({
      schoolId: schoolIdObj,
      userId: userIdObj,
      type: "timetable.slot.deleted",
      description: "Deleted timetable slot",
      entityType: "TimetableSlot",
      entityId: existing._id,
      metadata: {
        versionId: String(versionObjId),
      },
    });

    const conflictSummary = await recomputeConflictsForVersion({
      schoolId: schoolIdObj,
      versionId: versionObjId,
    });

    return NextResponse.json({
      success: true,
      data: { id: String(slotObjId) },
      conflicts: conflictSummary,
    });
  } catch (e: unknown) {
    console.error("Failed to delete timetable slot:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to delete slot." },
      { status: 500 }
    );
  }
}
