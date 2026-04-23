/**
 * Published class-group timetable for an academic period (read + clear for this class).
 */
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  isClassTimetableManagerForReadUser,
  requireClassTimetableEditor,
} from "@/lib/auth/requireClassTimetableEditor";
import { requireSchoolAdminOrTeacherRead } from "@/lib/auth/requireSchoolAdminOrTeacherRead";
import { ClassGroup } from "@/models/ClassGroup";
import { SchoolSettings } from "@/models/SchoolSettings";
import { Subject } from "@/models/Subject";
import { Teacher } from "@/models/Teacher";
import { TimetableSlot } from "@/models/TimetableSlot";
import { TimetableVersion } from "@/models/TimetableVersion";
import { User } from "@/models/User";
import { recordTimetableActivity } from "@/lib/timetable/audit";
import { recomputeConflictsForVersion } from "@/lib/timetable/recompute-conflicts";
import {
  isTimetableRebootEnabled,
  isTimetableApiWriteEnabled,
} from "@/lib/timetable/feature-flags";

function toObjectIdOrNull(value: string | null | undefined): mongoose.Types.ObjectId | null {
  if (!value) return null;
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    return null;
  }
}

function normalizeWorkingDays(days?: number[] | null): number[] {
  const fallback = [1, 2, 3, 4, 5];
  if (!Array.isArray(days) || days.length === 0) return fallback;
  const filtered = Array.from(
    new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))
  ).sort((a, b) => a - b);
  return filtered.length > 0 ? filtered : fallback;
}

function hourLabel24(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

export type PublishedClassSlotDTO = {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  teacherId: string;
  teacherName: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  classroomLabel: string;
};

async function enrichSlots(
  schoolId: mongoose.Types.ObjectId,
  slots: Array<{
    _id: mongoose.Types.ObjectId;
    subjectId: mongoose.Types.ObjectId;
    teacherId?: mongoose.Types.ObjectId | null;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    classroomLabel: string;
  }>
): Promise<PublishedClassSlotDTO[]> {
  const subjectIds = [...new Set(slots.map((s) => String(s.subjectId)))];
  const teacherIds = [
    ...new Set(
      slots.map((s) => s.teacherId).filter(Boolean) as mongoose.Types.ObjectId[]
    ),
  ];

  const [subjects, teachers] = await Promise.all([
    subjectIds.length
      ? Subject.find({
          schoolId,
          _id: { $in: subjectIds.map((id) => new mongoose.Types.ObjectId(id)) },
        })
          .select("name code")
          .lean()
      : [],
    teacherIds.length
      ? Teacher.find({
          schoolId,
          _id: { $in: teacherIds },
        })
          .select("userId")
          .lean()
      : [],
  ]);

  const userIds = teachers
    .map((t) => (t as { userId?: mongoose.Types.ObjectId }).userId)
    .filter(Boolean) as mongoose.Types.ObjectId[];
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } })
        .select("firstName lastName")
        .lean()
    : [];

  const subName = (id: string) => {
    const s = subjects.find(
      (x) => String((x as { _id: mongoose.Types.ObjectId })._id) === id
    ) as { name?: string; code?: string | null } | undefined;
    return {
      name: s?.name || "Subject",
      code: s?.code ?? null,
    };
  };

  const teacherName = (tid: string | undefined) => {
    if (!tid) return "Unassigned";
    const te = teachers.find(
      (x) => String((x as { _id: mongoose.Types.ObjectId })._id) === tid
    ) as { userId?: mongoose.Types.ObjectId } | undefined;
    if (!te?.userId) return "Unassigned";
    const u = users.find(
      (x) => String((x as { _id: mongoose.Types.ObjectId })._id) === String(te.userId)
    ) as { firstName?: string; lastName?: string } | undefined;
    if (!u) return tid;
    const n = `${u.firstName || ""} ${u.lastName || ""}`.trim();
    return n || tid;
  };

  return slots.map((s) => {
    const sid = String(s.subjectId);
    const tid = s.teacherId ? String(s.teacherId) : "";
    const sn = subName(sid);
    return {
      id: String(s._id),
      subjectId: sid,
      subjectName: sn.name,
      subjectCode: sn.code,
      teacherId: tid,
      teacherName: teacherName(s.teacherId ? String(s.teacherId) : undefined),
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      classroomLabel: s.classroomLabel || "",
    };
  });
}

/**
 * GET — published slots for this class. Empty when there is no published version or no lessons.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    if (!isTimetableRebootEnabled()) {
      return NextResponse.json(
        { success: false, error: "Timetable is disabled." },
        { status: 404 }
      );
    }

    const { id } = await ctx.params;
    const read = await requireSchoolAdminOrTeacherRead();
    await connectToDatabase();

    const classObjId = toObjectIdOrNull(id);
    if (!classObjId) {
      return NextResponse.json(
        { success: false, error: "Class ID must be a valid ObjectId." },
        { status: 400 }
      );
    }

    const schoolIdObj =
      read.schoolId instanceof mongoose.Types.ObjectId
        ? read.schoolId
        : new mongoose.Types.ObjectId(String(read.schoolId));

    const classRow = await ClassGroup.findById(classObjId).select("schoolId").lean();
    if (!classRow || String((classRow as { schoolId: mongoose.Types.ObjectId }).schoolId) !== String(schoolIdObj)) {
      return NextResponse.json({ success: false, error: "Class not found." }, { status: 404 });
    }

    const canManage = await isClassTimetableManagerForReadUser(id, read);

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

    const settings = await SchoolSettings.findOne({ schoolId: schoolIdObj })
      .select("workingDays")
      .lean();
    const workingDays = normalizeWorkingDays(
      (settings as { workingDays?: number[] } | null)?.workingDays
    );

    const version = await TimetableVersion.findOne({
      schoolId: schoolIdObj,
      academicPeriodId,
      status: "published",
    })
      .select("_id publishedAt")
      .lean();

    if (!version) {
      return NextResponse.json({
        success: true,
        data: [],
        meta: {
          hasPublishedVersion: false,
          versionId: null,
          publishedAt: null,
          slotCount: 0,
          workingDays,
          timeAxis: { startHour: 6, endHour: 20, hours: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19] },
          canManage,
        },
      });
    }

    const versionObjId = (version as { _id: mongoose.Types.ObjectId })._id;
    const publishedAt = (version as { publishedAt?: Date | null }).publishedAt;
    const rawSlots = await TimetableSlot.find({
      schoolId: schoolIdObj,
      versionId: versionObjId,
      classGroupId: classObjId,
      academicPeriodId,
    })
      .sort({ dayOfWeek: 1, startTime: 1, _id: 1 })
      .lean();

    const data = await enrichSlots(schoolIdObj, rawSlots as never);

    let startHour = 6;
    let endHourExclusive = 20;
    for (const s of data) {
      const [sh] = s.startTime.split(":").map(Number);
      const [eh, em] = s.endTime.split(":").map(Number);
      const endMins = Number.isFinite(eh) ? eh * 60 + (Number.isFinite(em) ? em : 0) : 0;
      if (Number.isFinite(sh)) startHour = Math.min(startHour, sh);
      if (Number.isFinite(eh)) {
        const ceilHour = endMins > 0 ? Math.ceil(endMins / 60) : eh;
        endHourExclusive = Math.max(endHourExclusive, Math.min(24, ceilHour + 1));
      }
    }
    if (endHourExclusive <= startHour) {
      endHourExclusive = Math.min(20, startHour + 8);
    }
    const hours: number[] = [];
    for (let h = startHour; h < endHourExclusive; h++) {
      hours.push(h);
    }
    if (hours.length === 0) {
      for (let h = 6; h < 20; h++) hours.push(h);
    }

    return NextResponse.json({
      success: true,
      data,
      meta: {
        hasPublishedVersion: true,
        versionId: String(versionObjId),
        publishedAt: publishedAt ? new Date(publishedAt).toISOString() : null,
        slotCount: data.length,
        workingDays,
        timeAxis: {
          startHour: hours[0] ?? 6,
          endHour: endHourExclusive,
          hours: hours.length ? hours : [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
        },
        hourLabels: (hours.length ? hours : [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]).map(
          hourLabel24
        ),
        canManage,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Class published timetable GET error:", e);
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "Failed to load published timetable.",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE — remove all published timetable slots for this class in the given academic period.
 */
export async function DELETE(
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

    const version = await TimetableVersion.findOne({
      schoolId: schoolIdObj,
      academicPeriodId,
      status: "published",
    })
      .select("_id")
      .lean();

    if (!version) {
      return NextResponse.json(
        { success: false, error: "No published timetable for this period." },
        { status: 404 }
      );
    }

    const versionObjId = (version as { _id: mongoose.Types.ObjectId })._id;

    const resDel = await TimetableSlot.deleteMany({
      schoolId: schoolIdObj,
      versionId: versionObjId,
      academicPeriodId,
      classGroupId: classObjId,
    });

    await recordTimetableActivity({
      schoolId: schoolIdObj,
      userId: userIdObj,
      type: "timetable.slot.deleted",
      description: `Removed ${resDel.deletedCount} published slot(s) for a class from the published school timetable`,
      entityType: "TimetableVersion",
      entityId: versionObjId,
      metadata: {
        classGroupId: String(classObjId),
        academicPeriodId: String(academicPeriodId),
        deletedCount: resDel.deletedCount,
        bulk: true,
      },
    });

    const conflictSummary = await recomputeConflictsForVersion({
      schoolId: schoolIdObj,
      versionId: versionObjId,
    });

    return NextResponse.json({
      success: true,
      data: { deleted: resDel.deletedCount, conflicts: conflictSummary },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Class published timetable DELETE error:", e);
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "Failed to clear published class timetable.",
      },
      { status: 500 }
    );
  }
}
