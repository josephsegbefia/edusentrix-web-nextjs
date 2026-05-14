/**
 * Class-group timetable slot APIs (primary creation path).
 * GET: List draft slots for this class.
 * POST: Create slot for this class (gets/creates draft version).
 */
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireClassTimetableEditor } from "@/lib/auth/requireClassTimetableEditor";
import { ClassGroup } from "@/models/ClassGroup";
import { TimetableSlot } from "@/models/TimetableSlot";
import {
  buildTimetableSlotSnapshot,
  recordTimetableChangeLog,
} from "@/lib/timetable/audit";
import { resolveClassroomLabel } from "@/lib/timetable/classroom-label";
import { findOrCreateDraftVersion } from "@/lib/timetable/get-draft-version";
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

function toObjectIdOrNull(value: string | null | undefined): mongoose.Types.ObjectId | null {
  if (!value) return null;
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    return null;
  }
}

const CreateSlotSchema = z.object({
  academicPeriodId: z.string().length(24),
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/),
  endTime: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/),
  subjectOfferingId: z.string().length(24).optional(),
  subjectId: z.string().length(24).optional(),
  /** Required so every dropped lesson can be checked for teacher conflicts before saving. */
  teacherId: z.string().length(24),
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
 * GET /api/admin/classes/:id/timetable/slots?academicPeriodId=...
 * Lists draft slots for this class. Uses draft version for the period.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    if (!isTimetableRebootEnabled() || !isTimetableApiWriteEnabled()) {
      return NextResponse.json(
        { success: false, error: "Timetable admin planner is disabled." },
        { status: 404 }
      );
    }

    const { id } = await ctx.params;
    const editor = await requireClassTimetableEditor(id);
    await connectToDatabase();

    const classObjId = toObjectIdOrNull(id);
    if (!classObjId) {
      return NextResponse.json(
        { success: false, error: "Class ID must be a valid ObjectId." },
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

    const academicPeriodIdParam = req.nextUrl.searchParams.get("academicPeriodId");
    if (!academicPeriodIdParam) {
      return NextResponse.json(
        { success: false, error: "academicPeriodId is required." },
        { status: 400 }
      );
    }
    const academicPeriodId = toObjectIdOrNull(academicPeriodIdParam);
    if (!academicPeriodId) {
      return NextResponse.json(
        { success: false, error: "academicPeriodId must be a valid ObjectId." },
        { status: 400 }
      );
    }

    const classGroup = await ClassGroup.findOne({
      _id: classObjId,
      schoolId: schoolIdObj,
    })
      .select("_id gradeId schoolId subjectIds subjectOfferingIds")
      .lean();

    if (!classGroup) {
      return NextResponse.json(
        { success: false, error: "Class group not found for school." },
        { status: 404 }
      );
    }

    const versionObjId = await findOrCreateDraftVersion({
      schoolId: schoolIdObj,
      academicPeriodId,
      actorId: userIdObj,
    });
    const slots = await TimetableSlot.find({
      schoolId: schoolIdObj,
      versionId: versionObjId,
      classGroupId: classObjId,
    })
      .sort({ dayOfWeek: 1, startTime: 1, _id: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: slots.map((s) =>
        toSlotDto(
          s as {
            _id: mongoose.Types.ObjectId;
            classGroupId: mongoose.Types.ObjectId;
            gradeId: mongoose.Types.ObjectId;
            subjectId: mongoose.Types.ObjectId;
            subjectOfferingId?: mongoose.Types.ObjectId | null;
            teacherId?: mongoose.Types.ObjectId | null;
            dayOfWeek: number;
            startTime: string;
            endTime: string;
            classroomLabel: string;
            source: string;
            versionId: mongoose.Types.ObjectId;
            academicPeriodId: mongoose.Types.ObjectId;
            createdAt: Date;
            updatedAt: Date;
          }
        )
      ),
      meta: { versionId: String(versionObjId) },
    });
  } catch (e: unknown) {
    if (e instanceof Response) throw e;
    console.error("Class timetable slots GET error:", e);
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "Failed to fetch class timetable slots.",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/classes/:id/timetable/slots
 * Create a slot for this class. Gets or creates draft version.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    if (!isTimetableRebootEnabled() || !isTimetableApiWriteEnabled()) {
      return NextResponse.json(
        { success: false, error: "Timetable admin planner is disabled." },
        { status: 404 }
      );
    }

    const { id } = await ctx.params;
    const editor = await requireClassTimetableEditor(id);
    await connectToDatabase();

    const classObjId = toObjectIdOrNull(id);
    if (!classObjId) {
      return NextResponse.json(
        { success: false, error: "Class ID must be a valid ObjectId." },
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
      .select("_id gradeId schoolId")
      .lean();

    if (!classGroup) {
      return NextResponse.json(
        { success: false, error: "Class group not found for school." },
        { status: 404 }
      );
    }

    const body = await req.json();
    const parsed = CreateSlotSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const academicPeriodId = new mongoose.Types.ObjectId(input.academicPeriodId);
    const explicitTeacherId = new mongoose.Types.ObjectId(input.teacherId);
    const gradeId = (classGroup as { gradeId: mongoose.Types.ObjectId }).gradeId;
    let subjectId = input.subjectId ? new mongoose.Types.ObjectId(input.subjectId) : null;
    let subjectOfferingId: mongoose.Types.ObjectId | null = null;
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
    if (!subjectId) {
      return NextResponse.json(
        { success: false, error: "Select a subject offering before creating a timetable slot." },
        { status: 400 }
      );
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
      academicPeriodId,
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

    const resolved = await loadResolvedScheduleForSchoolDay(
      schoolIdObj,
      gradeId,
      input.dayOfWeek,
      classObjId
    );
    if (!resolved) {
      return NextResponse.json(
        {
          success: false,
          error:
            "School schedule is not configured. Add start times, periods, and breaks under School Settings before building a timetable.",
        },
        { status: 400 }
      );
    }
    if (!slotAlignsWithSchoolPeriods(resolved, input.startTime, input.endTime)) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          issues: [
            {
              code: "INVALID_TIME_RANGE",
              field: "startTime",
              message:
                "Lesson times must match a school period for this day (see Settings → daily periods and breaks).",
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
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      classroomLabel,
    });

    if (issues.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          issues,
        },
        { status: 400 }
      );
    }

    const versionId = await findOrCreateDraftVersion({
      schoolId: schoolIdObj,
      academicPeriodId,
      actorId: userIdObj,
    });

    const writeConflicts = await detectSlotWriteConflicts({
      schoolId: schoolIdObj,
      academicPeriodId,
      versionId,
      classGroupId: classObjId,
      gradeId,
      subjectId,
      teacherId,
      roomId,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
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

    const created = await TimetableSlot.create({
      schoolId: schoolIdObj,
      academicPeriodId,
      versionId,
      classGroupId: classObjId,
      gradeId,
      subjectId,
      ...(subjectOfferingId ? { subjectOfferingId } : {}),
      teacherId,
      ...(roomId ? { roomId } : {}),
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      classroomLabel,
      source: "manual",
      createdBy: userIdObj,
      updatedBy: userIdObj,
    });

    await recordTimetableChangeLog({
      schoolId: schoolIdObj,
      academicPeriodId,
      versionId,
      action: "slot_created",
      actorId: userIdObj,
      entityId: created._id,
      after: buildTimetableSlotSnapshot(created),
    });

    await recomputeConflictsForVersion({ schoolId: schoolIdObj, versionId });

    await recordScheduleChangeEvent({
      schoolId: schoolIdObj,
      academicPeriodId,
      entityType: "timetableSlot",
      entityId: created._id,
      action: "created",
      affectedClassGroupIds: [classObjId],
      affectedTeacherIds: [teacherId],
      affectedSubjectIds: [subjectId],
      affectedRoomIds: roomId ? [roomId] : [],
      createdBy: userIdObj,
      message: "Timetable slot created",
    });

    return NextResponse.json({
      success: true,
      data: toSlotDto({
        ...created.toObject(),
        versionId,
        academicPeriodId,
      }),
    });
  } catch (e: unknown) {
    if (e instanceof Response) throw e;
    console.error("Class timetable slot POST error:", e);
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "Failed to create timetable slot.",
      },
      { status: 500 }
    );
  }
}
