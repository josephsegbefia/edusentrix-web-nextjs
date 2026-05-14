/**
 * Class-group timetable slot PATCH and DELETE.
 * Slot must belong to this class; classGroupId cannot be changed via PATCH.
 */
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireClassTimetableEditor } from "@/lib/auth/requireClassTimetableEditor";
import { ClassGroup } from "@/models/ClassGroup";
import { TimetableSlot } from "@/models/TimetableSlot";
import { TimetableVersion } from "@/models/TimetableVersion";
import {
  buildTimetableSlotSnapshot,
  recordTimetableChangeLog,
} from "@/lib/timetable/audit";
import { resolveClassroomLabel } from "@/lib/timetable/classroom-label";
import { recomputeConflictsForVersion } from "@/lib/timetable/recompute-conflicts";
import { validateTimetableSlotReferences } from "@/lib/timetable/validate";
import {
  isTimetableRebootEnabled,
  isTimetableApiWriteEnabled,
} from "@/lib/timetable/feature-flags";
import { loadResolvedScheduleForSchoolDay } from "@/lib/timetable/load-resolved-schedule";
import { slotAlignsWithSchoolPeriods } from "@/lib/timetable/period-alignment";
import { detectSlotWriteConflicts } from "@/lib/timetable/slot-write-conflicts";
import {
  buildTeacherResolutionIssue,
  resolveTeacherForTimetableSlot,
} from "@/lib/timetable/resolve-slot-teacher";
import { recordScheduleChangeEvent } from "@/lib/timetable/schedule-change-events";
import { resolveSubjectOfferingForSchool } from "@/lib/subject-offerings/resolve-subject-offering";
import { z } from "zod";

type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

function toObjectIdOrNull(value: string | null | undefined): mongoose.Types.ObjectId | null {
  if (!value) return null;
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    return null;
  }
}

function isDayOfWeek(value: number): value is DayOfWeek {
  return Number.isInteger(value) && value >= 0 && value <= 6;
}

const PatchSlotSchema = z.object({
  subjectOfferingId: z.string().length(24).optional(),
  subjectId: z.string().length(24).optional(),
  teacherId: z.union([z.string().length(24), z.null()]).optional(),
  dayOfWeek: z.number().min(0).max(6).optional(),
  startTime: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  endTime: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/).optional(),
});

function toSlotDto(slot: {
  _id: mongoose.Types.ObjectId;
  classGroupId: mongoose.Types.ObjectId;
  gradeId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  subjectOfferingId?: mongoose.Types.ObjectId | null;
  teacherId?: mongoose.Types.ObjectId | null;
  roomId?: mongoose.Types.ObjectId | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  classroomLabel: string;
  source: string;
  versionId: mongoose.Types.ObjectId;
  academicPeriodId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: String(slot._id),
    classGroupId: String(slot.classGroupId),
    gradeId: String(slot.gradeId),
    subjectId: String(slot.subjectId),
    subjectOfferingId: slot.subjectOfferingId ? String(slot.subjectOfferingId) : null,
    teacherId: slot.teacherId ? String(slot.teacherId) : "",
    roomId: slot.roomId ? String(slot.roomId) : null,
    dayOfWeek: slot.dayOfWeek,
    startTime: slot.startTime,
    endTime: slot.endTime,
    classroomLabel: slot.classroomLabel,
    source: slot.source,
    versionId: String(slot.versionId),
    academicPeriodId: String(slot.academicPeriodId),
    createdAt: new Date(slot.createdAt).toISOString(),
    updatedAt: new Date(slot.updatedAt).toISOString(),
  };
}

/**
 * PATCH /api/admin/classes/:id/timetable/slots/:slotId
 * Update slot (subject, teacher, day, times). Slot must belong to this class.
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; slotId: string }> }
) {
  try {
    if (!isTimetableRebootEnabled() || !isTimetableApiWriteEnabled()) {
      return NextResponse.json(
        { success: false, error: "Timetable admin planner is disabled." },
        { status: 404 }
      );
    }

    const { id, slotId } = await ctx.params;
    const editor = await requireClassTimetableEditor(id);
    await connectToDatabase();

    const classObjId = toObjectIdOrNull(id);
    const slotObjId = toObjectIdOrNull(slotId);
    if (!classObjId || !slotObjId) {
      return NextResponse.json(
        { success: false, error: "Class ID and slotId must be valid ObjectIds." },
        { status: 400 }
      );
    }

    const schoolIdObj =
      editor.schoolId instanceof mongoose.Types.ObjectId
        ? editor.schoolId
        : new mongoose.Types.ObjectId(String(editor.schoolId));
    const userIdObj =
      editor.userId instanceof mongoose.Types.ObjectId
        ? editor.userId
        : new mongoose.Types.ObjectId(String(editor.userId));

    const classGroup = await ClassGroup.findOne({
      _id: classObjId,
      schoolId: schoolIdObj,
    })
      .select("_id gradeId subjectIds subjectOfferingIds")
      .lean();

    if (!classGroup) {
      return NextResponse.json(
        { success: false, error: "Class group not found for school." },
        { status: 404 }
      );
    }

    const existing = await TimetableSlot.findOne({
      _id: slotObjId,
      schoolId: schoolIdObj,
      classGroupId: classObjId,
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Timetable slot not found for this class." },
        { status: 404 }
      );
    }

    const version = await TimetableVersion.findById(existing.versionId);
    if (!version || version.status !== "draft") {
      return NextResponse.json(
        { success: false, error: "Only draft timetable slots can be edited." },
        { status: 409 }
      );
    }

    const body = await req.json();
    const parsed = PatchSlotSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const hasAnyField =
      input.subjectId !== undefined ||
      input.subjectOfferingId !== undefined ||
      input.teacherId !== undefined ||
      input.dayOfWeek !== undefined ||
      input.startTime !== undefined ||
      input.endTime !== undefined;

    if (!hasAnyField) {
      return NextResponse.json(
        { success: false, error: "No mutation fields provided." },
        { status: 400 }
      );
    }

    let subjectId = input.subjectId
      ? new mongoose.Types.ObjectId(input.subjectId)
      : existing.subjectId;
    let subjectOfferingId =
      (existing as unknown as { subjectOfferingId?: mongoose.Types.ObjectId | null }).subjectOfferingId ?? null;
    const explicitTeacherId =
      input.teacherId !== undefined
        ? input.teacherId === null
          ? null
          : new mongoose.Types.ObjectId(input.teacherId)
        : existing.teacherId ?? null;
    const dayOfWeek = input.dayOfWeek !== undefined ? input.dayOfWeek : existing.dayOfWeek;
    const startTime = input.startTime ?? existing.startTime;
    const endTime = input.endTime ?? existing.endTime;
    const gradeId = (classGroup as { gradeId: mongoose.Types.ObjectId }).gradeId;

    if (input.subjectOfferingId) {
      const offeringResolution = await resolveSubjectOfferingForSchool({
        schoolId: schoolIdObj,
        subjectOfferingId: input.subjectOfferingId,
        gradeId,
        classGroupId: classObjId,
        requireClassAssignment: true,
      });
      if (!offeringResolution.ok) {
        return NextResponse.json(
          { success: false, error: offeringResolution.error },
          { status: offeringResolution.status }
        );
      }
      subjectId = offeringResolution.offering.subjectId;
      subjectOfferingId = offeringResolution.offering._id;
    }

    if (
      !subjectOfferingId &&
      !(classGroup as { subjectIds?: mongoose.Types.ObjectId[] }).subjectIds?.some(
        (id) => String(id) === String(subjectId)
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          code: "SUBJECT_NOT_ASSIGNED_TO_CLASS",
          error: "This subject has not been assigned to the selected class group.",
          issues: [
            {
              code: "SUBJECT_NOT_ASSIGNED_TO_CLASS",
              field: "subjectId",
              message: "Assign this subject to the class group before scheduling it.",
              severity: "error" as const,
            },
          ],
        },
        { status: 409 }
      );
    }

    const teacherResolution = await resolveTeacherForTimetableSlot({
      schoolId: schoolIdObj,
      academicPeriodId: existing.academicPeriodId,
      classGroupId: classObjId,
      subjectId,
      subjectOfferingId,
      explicitTeacherId,
    });

    if (!teacherResolution.ok) {
      return NextResponse.json(
        {
          success: false,
          code: teacherResolution.code,
          error: teacherResolution.message,
          issues: [buildTeacherResolutionIssue(teacherResolution)],
        },
        { status: 409 }
      );
    }

    const teacherId = teacherResolution.teacherId;

    if (!isDayOfWeek(dayOfWeek)) {
      return NextResponse.json(
        { success: false, error: "dayOfWeek must be an integer from 0 to 6." },
        { status: 400 }
      );
    }

    const resolved = await loadResolvedScheduleForSchoolDay(
      schoolIdObj,
      gradeId,
      dayOfWeek,
      classObjId
    );
    if (!resolved) {
      return NextResponse.json(
        {
          success: false,
          error:
            "School schedule is not configured. Configure periods and breaks in School Settings.",
        },
        { status: 400 }
      );
    }
    if (!slotAlignsWithSchoolPeriods(resolved, startTime, endTime)) {
      return NextResponse.json(
        {
          success: false,
          error: "Slot validation failed.",
          issues: [
            {
              code: "INVALID_TIME_RANGE",
              field: "startTime",
              message:
                "Lesson times must match a school period for this day (Settings → periods & breaks).",
              severity: "error" as const,
            },
          ],
        },
        { status: 400 }
      );
    }

    const { classroomLabel, roomId } = await resolveClassroomLabel({
      schoolId: schoolIdObj,
      classGroupId: classObjId,
      gradeId,
    });

    const issues = await validateTimetableSlotReferences({
      schoolId: schoolIdObj,
      classGroupId: classObjId,
      gradeId,
      subjectId,
      teacherId,
      roomId,
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

    const writeConflicts = await detectSlotWriteConflicts({
      schoolId: schoolIdObj,
      academicPeriodId: existing.academicPeriodId,
      versionId: existing.versionId,
      classGroupId: classObjId,
      gradeId,
      subjectId,
      teacherId,
      roomId,
      dayOfWeek,
      startTime,
      endTime,
      excludeSlotId: existing._id,
    });

    if (writeConflicts.length > 0) {
      return NextResponse.json(
        {
          success: false,
          code: writeConflicts[0].code,
          error: writeConflicts[0].message,
          conflict: writeConflicts[0],
          conflicts: writeConflicts,
          issues: writeConflicts.map((conflict) => ({
            code: conflict.code,
            field:
              conflict.code === "TEACHER_OVERLAP"
                ? "teacherId"
                : conflict.code === "ROOM_OVERLAP"
                  ? "roomId"
                  : "startTime",
            message: conflict.message,
            severity: "error" as const,
          })),
        },
        { status: 409 }
      );
    }

    const beforeSnapshot = buildTimetableSlotSnapshot(existing);

    existing.subjectId = subjectId;
    existing.subjectOfferingId = subjectOfferingId;
    existing.teacherId = teacherId;
    existing.roomId = roomId;
    existing.dayOfWeek = dayOfWeek;
    existing.startTime = startTime;
    existing.endTime = endTime;
    existing.classroomLabel = classroomLabel;
    existing.updatedBy = userIdObj;

    await existing.save();

    await recordTimetableChangeLog({
      schoolId: schoolIdObj,
      academicPeriodId: existing.academicPeriodId,
      versionId: existing.versionId,
      action: "slot_updated",
      actorId: userIdObj,
      entityId: existing._id,
      before: beforeSnapshot,
      after: buildTimetableSlotSnapshot(existing),
    });

    const conflictSummary = await recomputeConflictsForVersion({
      schoolId: schoolIdObj,
      versionId: existing.versionId,
    });

    await recordScheduleChangeEvent({
      schoolId: schoolIdObj,
      academicPeriodId: existing.academicPeriodId,
      entityType: "timetableSlot",
      entityId: existing._id,
      action: "updated",
      affectedClassGroupIds: [classObjId],
      affectedTeacherIds: [teacherId],
      affectedSubjectIds: [subjectId],
      affectedRoomIds: roomId ? [roomId] : [],
      createdBy: userIdObj,
      message: "Timetable slot updated",
    });

    return NextResponse.json({
      success: true,
      data: toSlotDto({
        ...existing.toObject(),
        versionId: existing.versionId,
        academicPeriodId: existing.academicPeriodId,
      }),
      conflicts: conflictSummary,
    });
  } catch (e: unknown) {
    if (e instanceof Response) throw e;
    console.error("Class timetable slot PATCH error:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to update slot." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/classes/:id/timetable/slots/:slotId
 * Delete slot. Slot must belong to this class.
 */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; slotId: string }> }
) {
  try {
    if (!isTimetableRebootEnabled() || !isTimetableApiWriteEnabled()) {
      return NextResponse.json(
        { success: false, error: "Timetable admin planner is disabled." },
        { status: 404 }
      );
    }

    const { id, slotId } = await ctx.params;
    const editor = await requireClassTimetableEditor(id);
    await connectToDatabase();

    const classObjId = toObjectIdOrNull(id);
    const slotObjId = toObjectIdOrNull(slotId);
    if (!classObjId || !slotObjId) {
      return NextResponse.json(
        { success: false, error: "Class ID and slotId must be valid ObjectIds." },
        { status: 400 }
      );
    }

    const schoolIdObj =
      editor.schoolId instanceof mongoose.Types.ObjectId
        ? editor.schoolId
        : new mongoose.Types.ObjectId(String(editor.schoolId));
    const userIdObj =
      editor.userId instanceof mongoose.Types.ObjectId
        ? editor.userId
        : new mongoose.Types.ObjectId(String(editor.userId));

    const existing = await TimetableSlot.findOne({
      _id: slotObjId,
      schoolId: schoolIdObj,
      classGroupId: classObjId,
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Timetable slot not found for this class." },
        { status: 404 }
      );
    }

    const version = await TimetableVersion.findById(existing.versionId);
    if (!version || version.status !== "draft") {
      return NextResponse.json(
        { success: false, error: "Only draft timetable slots can be deleted." },
        { status: 409 }
      );
    }

    const beforeSnapshot = buildTimetableSlotSnapshot(existing);

    await TimetableSlot.deleteOne({
      _id: slotObjId,
      schoolId: schoolIdObj,
      academicPeriodId: existing.academicPeriodId,
      versionId: existing.versionId,
      classGroupId: classObjId,
    });

    await recordTimetableChangeLog({
      schoolId: schoolIdObj,
      academicPeriodId: existing.academicPeriodId,
      versionId: existing.versionId,
      action: "slot_deleted",
      actorId: userIdObj,
      entityId: existing._id,
      before: beforeSnapshot,
      after: null,
    });

    const conflictSummary = await recomputeConflictsForVersion({
      schoolId: schoolIdObj,
      versionId: existing.versionId,
    });

    await recordScheduleChangeEvent({
      schoolId: schoolIdObj,
      academicPeriodId: existing.academicPeriodId,
      entityType: "timetableSlot",
      entityId: existing._id,
      action: "deleted",
      affectedClassGroupIds: [classObjId],
      affectedTeacherIds: existing.teacherId ? [existing.teacherId] : [],
      affectedSubjectIds: [existing.subjectId],
      affectedRoomIds: existing.roomId ? [existing.roomId] : [],
      createdBy: userIdObj,
      message: "Timetable slot deleted",
    });

    return NextResponse.json({
      success: true,
      data: {
        id: String(slotObjId),
        academicPeriodId: String(existing.academicPeriodId),
        versionId: String(existing.versionId),
        teacherId: existing.teacherId ? String(existing.teacherId) : "",
        subjectId: String(existing.subjectId),
      },
      conflicts: conflictSummary,
    });
  } catch (e: unknown) {
    if (e instanceof Response) throw e;
    console.error("Class timetable slot DELETE error:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to delete slot." },
      { status: 500 }
    );
  }
}
