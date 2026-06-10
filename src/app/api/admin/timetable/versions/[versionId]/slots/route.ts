import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  requireSchoolAdminOrDelegatedAnyPermission,
  requireSchoolAdminOrDelegatedModuleView,
} from "@/lib/delegations/requireDelegatedModulePermission";
import { TimetableSlot, type ITimetableSlot } from "@/models/TimetableSlot";
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
import { resolveSubjectOfferingForSchool } from "@/lib/subject-offerings/resolve-subject-offering";

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

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}

function parsePositiveInt(value: string | null, defaultValue: number, max = 200): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
  return Math.min(parsed, max);
}

function parseDayOfWeek(value: string | null): number | null {
  if (value === null) return null;
  const parsed = parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 6) return null;
  return parsed;
}

function isDayOfWeek(value: number): value is DayOfWeek {
  return Number.isInteger(value) && value >= 0 && value <= 6;
}

function isSlotSource(value: string): value is SlotSource {
  return value === "manual" || value === "imported" || value === "assignment_sync";
}

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function toSlotDto(slot: {
  _id: mongoose.Types.ObjectId;
  schoolId: mongoose.Types.ObjectId;
  academicPeriodId: mongoose.Types.ObjectId;
  versionId: mongoose.Types.ObjectId;
  classGroupId: mongoose.Types.ObjectId;
  gradeId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  subjectOfferingId?: mongoose.Types.ObjectId | null;
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
    subjectOfferingId: slot.subjectOfferingId ? String(slot.subjectOfferingId) : null,
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

/**
 * GET /api/admin/timetable/versions/:versionId/slots
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ versionId: string }> }
) {
  try {
    if (!isTimetableApiWriteEnabled()) {
      return NextResponse.json(
        { success: false, error: "Timetable admin planner is disabled." },
        { status: 404 }
      );
    }

    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("timetable");
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const { versionId } = await ctx.params;
    const versionObjId = toObjectIdOrNull(versionId);
    if (!versionObjId) {
      return NextResponse.json(
        { success: false, error: "versionId must be a valid ObjectId." },
        { status: 400 }
      );
    }

    const version = await TimetableVersion.findOne({
      _id: versionObjId,
      schoolId: schoolIdObj,
    })
      .select("_id status academicPeriodId")
      .lean();

    if (!version) {
      return NextResponse.json(
        { success: false, error: "Timetable version not found for school." },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = parsePositiveInt(searchParams.get("page"), 1, 5000);
    const limit = parsePositiveInt(searchParams.get("limit"), 100, 500);
    const dayOfWeek = parseDayOfWeek(searchParams.get("dayOfWeek"));
    if (searchParams.get("dayOfWeek") !== null && dayOfWeek === null) {
      return NextResponse.json(
        { success: false, error: "dayOfWeek must be an integer from 0 to 6." },
        { status: 400 }
      );
    }

    const filter: Record<string, unknown> = {
      schoolId: schoolIdObj,
      versionId: versionObjId,
    };

    if (dayOfWeek !== null) filter.dayOfWeek = dayOfWeek;

    const objectFilterKeys = ["teacherId", "subjectId", "classGroupId", "gradeId"] as const;
    for (const key of objectFilterKeys) {
      const value = searchParams.get(key);
      if (!value) continue;
      const objId = toObjectIdOrNull(value);
      if (!objId) {
        return NextResponse.json(
          { success: false, error: `${key} must be a valid ObjectId.` },
          { status: 400 }
        );
      }
      filter[key] = objId;
    }

    const [items, total] = await Promise.all([
      TimetableSlot.find(filter)
        .sort({ dayOfWeek: 1, startTime: 1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      TimetableSlot.countDocuments(filter),
    ]);

    return NextResponse.json({
      success: true,
      data: items.map((item) =>
        toSlotDto(
          item as unknown as {
            _id: mongoose.Types.ObjectId;
            schoolId: mongoose.Types.ObjectId;
            academicPeriodId: mongoose.Types.ObjectId;
            versionId: mongoose.Types.ObjectId;
            classGroupId: mongoose.Types.ObjectId;
            gradeId: mongoose.Types.ObjectId;
            subjectId: mongoose.Types.ObjectId;
            subjectOfferingId?: mongoose.Types.ObjectId | null;
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
        )
      ),
      meta: {
        version: {
          id: String((version as { _id: mongoose.Types.ObjectId })._id),
          status: String((version as { status: string }).status),
          academicPeriodId: String(
            (version as { academicPeriodId: mongoose.Types.ObjectId }).academicPeriodId
          ),
        },
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    });
  } catch (e: unknown) {
    console.error("Failed to list timetable slots:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to list slots." },
      { status: 500 }
    );
  }
}

interface CreateSlotBody {
  classGroupId?: string;
  gradeId?: string;
  subjectOfferingId?: string;
  subjectId?: string;
  teacherId?: string;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  classroomLabel?: string | null;
  source?: SlotSource;
}

/**
 * POST /api/admin/timetable/versions/:versionId/slots
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ versionId: string }> }
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
    const { versionId } = await ctx.params;
    const versionObjId = toObjectIdOrNull(versionId);
    if (!versionObjId) {
      return NextResponse.json(
        { success: false, error: "versionId must be a valid ObjectId." },
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

    const body = (await req.json()) as CreateSlotBody;

    const classGroupId = toObjectIdOrNull(body.classGroupId);
    const gradeId = toObjectIdOrNull(body.gradeId);
    let subjectId = toObjectIdOrNull(body.subjectId);
    let subjectOfferingId = toObjectIdOrNull(body.subjectOfferingId);
    const teacherId = toObjectIdOrNull(body.teacherId);

    if (!classGroupId || !gradeId || !teacherId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "classGroupId, gradeId, and teacherId are required and must be valid ObjectIds.",
        },
        { status: 400 }
      );
    }
    if (body.subjectOfferingId) {
      const offeringResolution = await resolveSubjectOfferingForSchool({
        schoolId: schoolIdObj,
        subjectOfferingId: body.subjectOfferingId,
        gradeId,
        classGroupId,
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
        { success: false, error: "subjectOfferingId is required for timetable slots." },
        { status: 400 }
      );
    }

    if (typeof body.dayOfWeek !== "number" || !isDayOfWeek(body.dayOfWeek)) {
      return NextResponse.json(
        { success: false, error: "dayOfWeek is required and must be an integer from 0 to 6." },
        { status: 400 }
      );
    }
    const dayOfWeek: DayOfWeek = body.dayOfWeek;

    if (!body.startTime || !body.endTime) {
      return NextResponse.json(
        { success: false, error: "startTime and endTime are required." },
        { status: 400 }
      );
    }

    if (body.source !== undefined && !isSlotSource(body.source)) {
      return NextResponse.json(
        { success: false, error: "source must be one of: manual, imported, assignment_sync." },
        { status: 400 }
      );
    }

    const resolvedClassroomLabel =
      typeof body.classroomLabel === "string" && normalizeSpaces(body.classroomLabel)
        ? normalizeSpaces(body.classroomLabel)
        : (
            await resolveClassroomLabel({
              schoolId: schoolIdObj,
              classGroupId,
              gradeId,
            })
          ).classroomLabel;

    const issues = await validateTimetableSlotReferences({
      schoolId: schoolIdObj,
      classGroupId,
      gradeId,
      subjectId,
      ...(subjectOfferingId ? { subjectOfferingId } : {}),
      teacherId,
      dayOfWeek,
      startTime: body.startTime,
      endTime: body.endTime,
      classroomLabel: resolvedClassroomLabel,
    });

    if (issues.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Slot validation failed.",
          issues,
        },
        { status: 400 }
      );
    }

    const existingClassPeriodSlot = await TimetableSlot.findOne({
      schoolId: schoolIdObj,
      academicPeriodId: version.academicPeriodId,
      versionId: versionObjId,
      classGroupId,
      dayOfWeek,
      startTime: body.startTime,
      endTime: body.endTime,
    })
      .select("_id")
      .lean();

    if (existingClassPeriodSlot) {
      return NextResponse.json(
        {
          success: false,
          code: "CLASS_PERIOD_ALREADY_SCHEDULED",
          error:
            "This class already has a lesson in that period. Move or update the existing lesson instead of creating another one.",
        },
        { status: 409 }
      );
    }

    let created: mongoose.HydratedDocument<ITimetableSlot>;
    try {
      created = await TimetableSlot.create({
        schoolId: schoolIdObj,
        academicPeriodId: version.academicPeriodId,
        versionId: versionObjId,
        classGroupId,
        gradeId,
        subjectId,
        ...(subjectOfferingId ? { subjectOfferingId } : {}),
        teacherId,
        dayOfWeek,
        startTime: body.startTime,
        endTime: body.endTime,
        classroomLabel: resolvedClassroomLabel,
        source: body.source ?? "manual",
        createdBy: userIdObj,
        updatedBy: userIdObj,
      });
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      return NextResponse.json(
        {
          success: false,
          code: "CLASS_PERIOD_ALREADY_SCHEDULED",
          error:
            "This class already has a lesson in that period. Move or update the existing lesson instead of creating another one.",
        },
        { status: 409 }
      );
    }

    await recordTimetableChangeLog({
      schoolId: schoolIdObj,
      academicPeriodId: version.academicPeriodId,
      versionId: versionObjId,
      action: "slot_created",
      actorId: userIdObj,
      entityId: created._id,
      before: null,
      after: buildTimetableSlotSnapshot(created),
    });

    await recordTimetableActivity({
      schoolId: schoolIdObj,
      userId: userIdObj,
      type: "timetable.slot.created",
      description: "Created timetable slot",
      entityType: "TimetableSlot",
      entityId: created._id,
      metadata: {
        versionId: String(versionObjId),
        dayOfWeek: created.dayOfWeek,
        startTime: created.startTime,
        endTime: created.endTime,
      },
    });

    const conflictSummary = await recomputeConflictsForVersion({
      schoolId: schoolIdObj,
      versionId: versionObjId,
    });

    return NextResponse.json(
      {
        success: true,
        data: toSlotDto(
          created.toObject() as {
            _id: mongoose.Types.ObjectId;
            schoolId: mongoose.Types.ObjectId;
            academicPeriodId: mongoose.Types.ObjectId;
            versionId: mongoose.Types.ObjectId;
            classGroupId: mongoose.Types.ObjectId;
            gradeId: mongoose.Types.ObjectId;
            subjectId: mongoose.Types.ObjectId;
            subjectOfferingId?: mongoose.Types.ObjectId | null;
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
      },
      { status: 201 }
    );
  } catch (e: unknown) {
    console.error("Failed to create timetable slot:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to create slot." },
      { status: 500 }
    );
  }
}
