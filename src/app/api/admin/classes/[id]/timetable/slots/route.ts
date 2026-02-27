/**
 * Class-group timetable slot APIs (primary creation path).
 * GET: List draft slots for this class.
 * POST: Create slot for this class (gets/creates draft version).
 */
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { ClassGroup } from "@/models/ClassGroup";
import { TimetableSlot } from "@/models/TimetableSlot";
import { TimetableVersion } from "@/models/TimetableVersion";
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
  subjectId: z.string().length(24),
  teacherId: z.string().length(24),
});

function toSlotDto(slot: {
  _id: mongoose.Types.ObjectId;
  classGroupId: mongoose.Types.ObjectId;
  gradeId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
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
    teacherId: String(slot.teacherId),
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

    const { schoolId, userId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { id } = await ctx.params;
    const classObjId = toObjectIdOrNull(id);
    if (!classObjId) {
      return NextResponse.json(
        { success: false, error: "Class ID must be a valid ObjectId." },
        { status: 400 }
      );
    }

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

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
      .select("_id gradeId schoolId")
      .lean();

    if (!classGroup) {
      return NextResponse.json(
        { success: false, error: "Class group not found for school." },
        { status: 404 }
      );
    }

    const version = await TimetableVersion.findOne({
      schoolId: schoolIdObj,
      academicPeriodId,
      status: "draft",
    })
      .sort({ updatedAt: -1 })
      .select("_id")
      .lean();

    if (!version) {
      return NextResponse.json({
        success: true,
        data: [],
        meta: { versionId: null },
      });
    }

    const versionObjId = (version as { _id: mongoose.Types.ObjectId })._id;
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
            teacherId: mongoose.Types.ObjectId;
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

    const { schoolId, userId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { id } = await ctx.params;
    const classObjId = toObjectIdOrNull(id);
    if (!classObjId) {
      return NextResponse.json(
        { success: false, error: "Class ID must be a valid ObjectId." },
        { status: 400 }
      );
    }

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));
    const userIdObj =
      userId instanceof mongoose.Types.ObjectId
        ? userId
        : new mongoose.Types.ObjectId(String(userId));

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
    const subjectId = new mongoose.Types.ObjectId(input.subjectId);
    const teacherId = new mongoose.Types.ObjectId(input.teacherId);
    const gradeId = (classGroup as { gradeId: mongoose.Types.ObjectId }).gradeId;

    const { classroomLabel } = await resolveClassroomLabel({
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

    const created = await TimetableSlot.create({
      schoolId: schoolIdObj,
      academicPeriodId,
      versionId,
      classGroupId: classObjId,
      gradeId,
      subjectId,
      teacherId,
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

    return NextResponse.json({
      success: true,
      data: toSlotDto({
        ...created.toObject(),
        versionId,
        academicPeriodId,
      }),
    });
  } catch (e: unknown) {
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
