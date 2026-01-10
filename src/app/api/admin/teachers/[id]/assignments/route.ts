/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import mongoose from "mongoose";

import { Teacher } from "@/models/Teacher";
import { ClassGroup } from "@/models/ClassGroup";
import { Subject } from "@/models/Subject";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { AcademicPeriod } from "@/models/AcademicPeriod";

function toObjectIdOrThrow(id: string, label: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    throw new Error(`Invalid ${label}`);
  }
}

function parseTimeToMinutes(hhmm: string) {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  const as = parseTimeToMinutes(aStart);
  const ae = parseTimeToMinutes(aEnd);
  const bs = parseTimeToMinutes(bStart);
  const be = parseTimeToMinutes(bEnd);

  if (as === null || ae === null || bs === null || be === null) return false;
  // Treat as start, end
  return as < be && bs < ae;
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
      model: ClassGroup,
    })
    .populate({
      path: "academicPeriodId",
      select: "name",
      model: AcademicPeriod,
    })
    .lean();

  const data = (items || []).map((a: any) => ({
    id: String(a._id),
    teacherId: String(a.teacherId),
    schoolId: String(a.schoolId),
    academicPeriodId: String(a.academicPeriodId),

    subject: a.subjectId
      ? { id: String(a.subjectId._id), name: String(a.subjectId.name) }
      : null,
    classGroup: a.classGroupId
      ? { id: String(a.classGroupId._id), name: String(a.classGroupId.name) }
      : null,

    schedule: a.schedule
      ? {
          dayOfWeek:
            typeof a.schedule.dayOfWeek === "number"
              ? a.schedule.dayOfWeek
              : null,
          startTime: a.schedule.startTime || null,
          endTime: a.schedule.endTime || null,
          location: a.schedule.location || null,
        }
      : null,

    workloadHours: typeof a.workloadHours === "number" ? a.workloadHours : 0,
    status: String(a.status || "active"),
    notes: a.notes ? String(a.notes) : null,

    assignedBy: a.assignedBy ? String(a.assignedBy) : null,
    assignedAt: a.assignedAt ? new Date(a.assignedAt).toISOString() : null,

    createdAt: new Date(a.createdAt).toISOString(),
    updatedAt: new Date(a.updatedAt).toISOString(),
  }));

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

    const schedule = body.schedule || null;

    // basic validations
    if (
      schedule?.dayOfWeek != null &&
      (schedule.dayOfWeek < 0 || schedule.dayOfWeek > 6)
    ) {
      return Response.json({ error: "dayOfWeek must be 0-6" }, { status: 400 });
    }
    if (schedule?.startTime && !/^\d{2}:\d{2}$/.test(schedule.startTime)) {
      return Response.json(
        { error: "startTime must be HH:MM" },
        { status: 400 }
      );
    }
    if (schedule?.endTime && !/^\d{2}:\d{2}$/.test(schedule.endTime)) {
      return Response.json({ error: "endTime must be HH:MM" }, { status: 400 });
    }
    if (schedule?.startTime && schedule?.endTime) {
      const s = parseTimeToMinutes(schedule.startTime);
      const e = parseTimeToMinutes(schedule.endTime);
      if (s === null || e === null || s >= e) {
        return Response.json(
          { error: "schedule endTime must be after startTime" },
          { status: 400 }
        );
      }
    }

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

    // Schedule conflict check (only if schedule is provided)
    if (
      schedule?.dayOfWeek != null &&
      schedule?.startTime &&
      schedule?.endTime
    ) {
      const existing = await TeacherAssignment.find({
        schoolId: schoolIdObj,
        teacherId: teacherObjId,
        academicPeriodId: academicPeriodObjId,
        status: "active",
        "schedule.dayOfWeek": schedule.dayOfWeek,
      })
        .populate({ path: "subjectId", select: "name", model: Subject })
        .populate({ path: "classGroupId", select: "name", model: ClassGroup })
        .select("schedule subjectId classGroupId")
        .lean();

      const conflict = (existing || []).find((x: any) => {
        if (!x.schedule?.startTime || !x.schedule?.endTime) return false;
        return overlaps(
          schedule.startTime,
          schedule.endTime,
          x.schedule.startTime,
          x.schedule.endTime
        );
      });

      if (conflict) {
        return Response.json(
          {
            error:
              "Schedule conflict: teacher already has an overlapping assignment for that day/time.",
            conflict: {
              id: String((conflict as any)._id),
              subject: (conflict as any).subjectId
                ? {
                    id: String((conflict as any).subjectId._id),
                    name: String((conflict as any).subjectId.name),
                  }
                : null,
              classGroup: (conflict as any).classGroupId
                ? {
                    id: String((conflict as any).classGroupId._id),
                    name: String((conflict as any).classGroupId.name),
                  }
                : null,
              schedule: {
                dayOfWeek: (conflict as any).schedule?.dayOfWeek ?? null,
                startTime: (conflict as any).schedule?.startTime ?? null,
                endTime: (conflict as any).schedule?.endTime ?? null,
                location: (conflict as any).schedule?.location ?? null,
              },
            },
          },
          { status: 409 }
        );
      }
    }

    // Create assignment
    try {
      const created = await TeacherAssignment.create({
        schoolId: schoolIdObj,
        teacherId: teacherObjId,
        academicPeriodId: academicPeriodObjId,
        subjectId: subjectObjId,
        classGroupId: classGroupObjId,
        schedule: schedule || undefined,
        workloadHours:
          typeof body.workloadHours === "number" ? body.workloadHours : 0,
        notes: body.notes ? String(body.notes) : undefined,
        status: body.status === "inactive" ? "inactive" : "active",
        assignedBy: userId ? new mongoose.Types.ObjectId(String(userId)) : null,
        assignedAt: new Date(),
      });

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
