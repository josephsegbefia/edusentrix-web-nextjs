/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import mongoose from "mongoose";

import { Teacher } from "@/models/Teacher";
import { ClassGroup } from "@/models/ClassGroup";
import { Subject } from "@/models/Subject";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { Grade } from "@/models/Grade";
import { TimetableVersion } from "@/models/TimetableVersion";
import { TimetableSlot } from "@/models/TimetableSlot";

function toObjectIdOrThrow(id: string, label: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    throw new Error(`Invalid ${label}`);
  }
}

function toObjectIdString(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof mongoose.Types.ObjectId) return String(value);
  if (typeof value === "object" && value && "_id" in value) {
    return String((value as { _id: unknown })._id);
  }
  try {
    return String(value);
  } catch {
    return null;
  }
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { schoolId } = await requireSchoolAdmin();

  await connectToDatabase();

  const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
  const { id } = await ctx.params;
  const teacherId = String(id || "");
  const teacherIdObj = toObjectIdOrThrow(teacherId, "teacher");

  const { searchParams } = new URL(req.url);
  const academicPeriodId = searchParams.get("academicPeriodId");
  const status = (searchParams.get("status") || "active").trim(); // active/inactive/all

  const query: Record<string, any> = {
    schoolId: schoolIdObj,
    teacherId: teacherIdObj,
  };

  if (academicPeriodId)
    query.academicPeriodId = toObjectIdOrThrow(
      academicPeriodId,
      "academic period"
    );
  if (status !== "all") query.status = status;

  const items = await TeacherAssignment.find(query)
    .sort({ status: 1, assignedAt: -1 })
    .populate({ path: "subjectId", select: "name", model: Subject })
    .populate({
      path: "classGroupId",
      select: "name gradeId",
      populate: { path: "gradeId", select: "name", model: Grade },
      model: ClassGroup,
    })
    .lean();

  const periodIds = Array.from(
    new Set(
      (items || [])
        .map((item: any) => toObjectIdString(item.academicPeriodId))
        .filter((value): value is string => Boolean(value))
    )
  );

  const periodObjIds = periodIds.map((value) => new mongoose.Types.ObjectId(value));
  const versionsRaw =
    periodObjIds.length > 0
      ? await TimetableVersion.find({
          schoolId: schoolIdObj,
          academicPeriodId: { $in: periodObjIds },
          status: { $in: ["draft", "published"] },
        })
          .sort({ academicPeriodId: 1, status: 1, updatedAt: -1, createdAt: -1 })
          .select("_id academicPeriodId status")
          .lean()
      : [];

  const preferredVersionByPeriodId = new Map<string, string>();
  for (const version of versionsRaw as Array<{
    _id: mongoose.Types.ObjectId;
    academicPeriodId: mongoose.Types.ObjectId;
    status: "draft" | "published";
  }>) {
    const periodKey = String(version.academicPeriodId);
    if (!preferredVersionByPeriodId.has(periodKey)) {
      preferredVersionByPeriodId.set(periodKey, String(version._id));
    }
  }

  const preferredVersionIds = Array.from(new Set(preferredVersionByPeriodId.values()));
  const versionObjIds = preferredVersionIds.map(
    (value) => new mongoose.Types.ObjectId(value)
  );

  const timetableSlotsRaw =
    versionObjIds.length > 0
      ? await TimetableSlot.find({
          schoolId: schoolIdObj,
          teacherId: teacherIdObj,
          versionId: { $in: versionObjIds },
        })
          .sort({ dayOfWeek: 1, startTime: 1, endTime: 1, _id: 1 })
          .select(
            "versionId classGroupId subjectId dayOfWeek startTime endTime classroomLabel"
          )
          .lean()
      : [];

  const slotScheduleMap = new Map<
    string,
    Array<{
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      location: string | null;
    }>
  >();

  for (const slot of timetableSlotsRaw as Array<{
    versionId: mongoose.Types.ObjectId;
    classGroupId: mongoose.Types.ObjectId;
    subjectId: mongoose.Types.ObjectId;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    classroomLabel?: string;
  }>) {
    const key = [
      String(slot.versionId),
      String(slot.classGroupId),
      String(slot.subjectId),
    ].join("|");

    if (!slotScheduleMap.has(key)) {
      slotScheduleMap.set(key, []);
    }

    const list = slotScheduleMap.get(key)!;
    list.push({
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      location: slot.classroomLabel || null,
    });
  }

  for (const [key, list] of slotScheduleMap) {
    const seen = new Set<string>();
    const deduped = list
      .filter((s) => {
        const hash = `${s.dayOfWeek}|${s.startTime}|${s.endTime}|${s.location || ""}`;
        if (seen.has(hash)) return false;
        seen.add(hash);
        return true;
      })
      .sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
        if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
        return a.endTime.localeCompare(b.endTime);
      });
    slotScheduleMap.set(key, deduped);
  }

  const data = (items || []).map((a: any) => {
    const periodId = toObjectIdString(a.academicPeriodId);
    const classGroupId = toObjectIdString(a.classGroupId);
    const subjectId = toObjectIdString(a.subjectId);

    const preferredVersionId = periodId
      ? preferredVersionByPeriodId.get(periodId) || null
      : null;

    const slotKey =
      preferredVersionId && classGroupId && subjectId
        ? [preferredVersionId, classGroupId, subjectId].join("|")
        : null;

    const timetableSchedules =
      String(a.status || "active") === "active" && slotKey
        ? slotScheduleMap.get(slotKey) || []
        : [];
    const effectiveSchedules = timetableSchedules;
    const primarySchedule = effectiveSchedules[0] || null;

    return {
      id: String(a._id),
      teacherId: String(a.teacherId),
      schoolId: String(a.schoolId),
      academicPeriodId: periodId || "",

      subject: a.subjectId
        ? { id: String(a.subjectId._id), name: String(a.subjectId.name) }
        : null,
      classGroup: a.classGroupId
        ? {
            id: String(a.classGroupId._id),
            name: String(a.classGroupId.name),
            label:
              a.classGroupId.gradeId?.name
                ? `${a.classGroupId.gradeId.name} ${a.classGroupId.name}`.trim()
                : a.classGroupId.name,
          }
        : null,

      schedule: primarySchedule
        ? {
            dayOfWeek:
              typeof primarySchedule.dayOfWeek === "number"
                ? primarySchedule.dayOfWeek
                : null,
            startTime: primarySchedule.startTime || null,
            endTime: primarySchedule.endTime || null,
            location: primarySchedule.location || null,
          }
        : null,
      schedules:
        effectiveSchedules.length > 0
          ? effectiveSchedules.map((s) => ({
              dayOfWeek: typeof s.dayOfWeek === "number" ? s.dayOfWeek : null,
              startTime: s.startTime || null,
              endTime: s.endTime || null,
              location: s.location || null,
            }))
          : null,
      scheduleSource: timetableSchedules.length > 0 ? "timetable" : "none",
      scheduleVersionId: timetableSchedules.length > 0 ? preferredVersionId : null,

      workloadHours: typeof a.workloadHours === "number" ? a.workloadHours : 0,
      status: String(a.status || "active"),
      notes: a.notes ? String(a.notes) : null,

      assignedBy: a.assignedBy ? String(a.assignedBy) : null,
      assignedAt: a.assignedAt ? new Date(a.assignedAt).toISOString() : null,

      createdAt: new Date(a.createdAt).toISOString(),
      updatedAt: new Date(a.updatedAt).toISOString(),
    };
  });

  return Response.json({ success: true, data });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireSchoolAdmin();
  const schoolId = auth.schoolId;
  const userId = (auth as any).userId || null;

  await connectToDatabase();

  try {
    const { id } = await ctx.params;
    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const teacherObjId = toObjectIdOrThrow(String(id), "teacherId");

    const body = await req.json();

    const academicPeriodObjId = toObjectIdOrThrow(
      body.academicPeriodId,
      "academicPeriodId"
    );
    const subjectObjId = toObjectIdOrThrow(body.subjectId, "subjectId");
    const classGroupObjId = toObjectIdOrThrow(
      body.classGroupId,
      "classGroupId"
    );

    const scheduleWriteAttempted =
      Object.prototype.hasOwnProperty.call(body, "schedule") ||
      Object.prototype.hasOwnProperty.call(body, "schedules");

    // Ensure teacher belongs to school
    const teacher = await Teacher.findOne({
      _id: teacherObjId,
      schoolId: schoolIdObj,
    }).lean();
    if (!teacher)
      return Response.json({ error: "Teacher not found" }, { status: 404 });

    // Ensure class group belongs to school
    const classGroup = await ClassGroup.findOne({
      _id: classGroupObjId,
      schoolId: schoolIdObj,
    })
      .select("_id schoolId subjectIds name")
      .lean();
    if (!classGroup)
      return Response.json({ error: "Class group not found" }, { status: 404 });

    // Ensure subject belongs to school (assuming Subject has schoolId)
    const subject = await Subject.findOne({
      _id: subjectObjId,
      schoolId: schoolIdObj,
    })
      .select("_id schoolId name")
      .lean();
    if (!subject)
      return Response.json({ error: "Subject not found" }, { status: 404 });

    const warnings: string[] = [];
    if (scheduleWriteAttempted) {
      warnings.push(
        "Assignment-level schedule writes are disabled. Manage schedules in the Master Timetable planner."
      );
    }

    // Optional: warn if subject not in class group’s configured subjects
    const cgSubjects = Array.isArray((classGroup as any).subjectIds)
      ? (classGroup as any).subjectIds.map(String)
      : [];
    if (cgSubjects.length && !cgSubjects.includes(String(subjectObjId))) {
      warnings.push(
        "This subject is not currently assigned to the selected class group."
      );
    }

    // Optional: auto-add subject to teacher "capabilities" if missing
    const teacherSubjects = Array.isArray((teacher as any).subjectIds)
      ? (teacher as any).subjectIds.map(String)
      : [];
    if (!teacherSubjects.includes(String(subjectObjId))) {
      await Teacher.updateOne(
        { _id: teacherObjId, schoolId: schoolIdObj },
        { $addToSet: { subjectIds: subjectObjId } }
      );
      warnings.push("Subject was added to teacher’s subject list.");
    }

    // Create assignment
    try {
      const assignmentData: any = {
        schoolId: schoolIdObj,
        teacherId: teacherObjId,
        academicPeriodId: academicPeriodObjId,
        subjectId: subjectObjId,
        classGroupId: classGroupObjId,
        workloadHours:
          typeof body.workloadHours === "number" ? body.workloadHours : 0,
        notes: body.notes ? String(body.notes) : undefined,
        status: body.status === "inactive" ? "inactive" : "active",
        assignedBy: userId ? new mongoose.Types.ObjectId(String(userId)) : null,
        assignedAt: new Date(),
      };

      const created = await TeacherAssignment.create(assignmentData);

      return Response.json({
        success: true,
        data: { id: String(created._id) },
        warnings,
      });
    } catch (err: any) {
      // duplicate key (unique indexes)
      if (err?.code === 11000) {
        return Response.json(
          {
            error:
              "This assignment already exists (or another teacher is already assigned to this subject for the class group in this period).",
          },
          { status: 409 }
        );
      }
      throw err;
    }
  } catch (e: any) {
    console.error("Create assignment error:", e);
    return Response.json(
      { error: e?.message || "Failed to create assignment" },
      { status: 500 }
    );
  }
}
