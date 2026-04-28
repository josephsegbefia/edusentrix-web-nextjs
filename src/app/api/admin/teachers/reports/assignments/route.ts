// src/app/api/admin/teachers/reports/assignments/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Teacher } from "@/models/Teacher";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { Subject } from "@/models/Subject";
import { ClassGroup } from "@/models/ClassGroup";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import {
  assignmentScheduleKey,
  buildTeacherScheduleMap,
  resolveEffectiveWorkloadHours,
} from "@/lib/teachers/timetable-workload";
import mongoose from "mongoose";

function toObjectIdOrNull(id: string): mongoose.Types.ObjectId | null {
  if (!id || !id.trim()) return null;
  try {
    return new mongoose.Types.ObjectId(String(id.trim()));
  } catch {
    return null;
  }
}

/**
 * GET /api/admin/teachers/reports/assignments
 * Get assignment distribution report
 * Query params: periodId (optional), subjectId (optional), status (optional)
 */
export async function GET(req: NextRequest) {
  const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("reports");
  await connectToDatabase();

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  try {
    const { searchParams } = new URL(req.url);
    const periodId = searchParams.get("periodId");
    const subjectId = searchParams.get("subjectId");
    const status = searchParams.get("status") || "active";

    // Build match query
    const match: any = {
      schoolId: schoolIdObj,
      status: status === "active" ? "active" : "inactive",
    };

    if (periodId) {
      const periodObjId = toObjectIdOrNull(periodId);
      if (!periodObjId) {
        return Response.json({ error: "Invalid periodId" }, { status: 400 });
      }
      match.academicPeriodId = periodObjId;
    }

    if (subjectId) {
      const subjectObjId = toObjectIdOrNull(subjectId);
      if (!subjectObjId) {
        return Response.json({ error: "Invalid subjectId" }, { status: 400 });
      }
      match.subjectId = subjectObjId;
    }

    // Get assignments
    const assignments = await TeacherAssignment.find(match)
      .populate("teacherId", "department")
      .populate("subjectId", "name")
      .populate("classGroupId", "name gradeId")
      .populate("academicPeriodId", "name startDate endDate")
      .populate({
        path: "teacherId",
        populate: { path: "userId", select: "firstName lastName email" },
      })
      .lean();

    const assignmentPeriodIds = Array.from(
      new Set(
        assignments
          .map((assignment: any) =>
            String(assignment.academicPeriodId?._id || assignment.academicPeriodId || "")
          )
          .filter(Boolean)
      )
    ).map((value) => new mongoose.Types.ObjectId(value));

    const teacherIds = Array.from(
      new Set(
        assignments
          .map((assignment: any) =>
            String(assignment.teacherId?._id || assignment.teacherId || "")
          )
          .filter(Boolean)
      )
    ).map((value) => new mongoose.Types.ObjectId(value));

    const scheduleMapsByTeacher = new Map<string, Awaited<ReturnType<typeof buildTeacherScheduleMap>>>();
    await Promise.all(
      teacherIds.map(async (teacherIdObj) => {
        const scheduleMap = await buildTeacherScheduleMap({
          schoolId: schoolIdObj,
          teacherId: teacherIdObj,
          periodIds: assignmentPeriodIds,
        });
        scheduleMapsByTeacher.set(String(teacherIdObj), scheduleMap);
      })
    );

    // Group by subject
    const bySubject: Record<string, any> = {};
    const byTeacher: Record<string, any> = {};
    const byClass: Record<string, any> = {};

    assignments.forEach((assignment: any) => {
      const teacher = assignment.teacherId;
      const subject = assignment.subjectId;
      const classGroup = assignment.classGroupId;
      const period = assignment.academicPeriodId;

      const teacherId = String(teacher?._id || "");
      const subjectId = String(subject?._id || "");
      const classId = String(classGroup?._id || "");

      // Group by subject
      if (!bySubject[subjectId]) {
        bySubject[subjectId] = {
          subjectId,
          subjectName: subject?.name || "Unknown",
          assignments: [],
          teacherCount: new Set(),
          classCount: new Set(),
        };
      }
      bySubject[subjectId].assignments.push(assignment);
      bySubject[subjectId].teacherCount.add(teacherId);
      bySubject[subjectId].classCount.add(classId);

      // Group by teacher
      if (!byTeacher[teacherId]) {
        const user = teacher?.userId || {};
        byTeacher[teacherId] = {
          teacherId,
          teacherName: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown",
          email: user.email || null,
          department: teacher?.department || null,
          assignments: [],
          subjectCount: new Set(),
          classCount: new Set(),
          totalWorkloadHours: 0,
        };
      }
      byTeacher[teacherId].assignments.push(assignment);
      byTeacher[teacherId].subjectCount.add(subjectId);
      byTeacher[teacherId].classCount.add(classId);
      byTeacher[teacherId].totalWorkloadHours += resolveEffectiveWorkloadHours({
        schedules:
          scheduleMapsByTeacher
            .get(teacherId)
            ?.get(
              assignmentScheduleKey({
                academicPeriodId:
                  assignment.academicPeriodId?._id || assignment.academicPeriodId,
                classGroupId: assignment.classGroupId?._id || assignment.classGroupId,
                subjectId: assignment.subjectId?._id || assignment.subjectId,
              })
            ) || [],
        contactHoursPerWeek: assignment.contactHoursPerWeek,
        workloadHours: assignment.workloadHours,
      });

      // Group by class
      if (!byClass[classId]) {
        byClass[classId] = {
          classId,
          className: classGroup?.name || "Unknown",
          assignments: [],
          teacherCount: new Set(),
          subjectCount: new Set(),
        };
      }
      byClass[classId].assignments.push(assignment);
      byClass[classId].teacherCount.add(teacherId);
      byClass[classId].subjectCount.add(subjectId);
    });

    // Format results
    const subjectStats = Object.values(bySubject).map((s: any) => ({
      subjectId: s.subjectId,
      subjectName: s.subjectName,
      assignmentCount: s.assignments.length,
      teacherCount: s.teacherCount.size,
      classCount: s.classCount.size,
    }));

    const teacherStats = Object.values(byTeacher).map((t: any) => ({
      teacherId: t.teacherId,
      teacherName: t.teacherName,
      email: t.email,
      department: t.department,
      assignmentCount: t.assignments.length,
      subjectCount: t.subjectCount.size,
      classCount: t.classCount.size,
      totalWorkloadHours: t.totalWorkloadHours,
    }));

    const classStats = Object.values(byClass).map((c: any) => ({
      classId: c.classId,
      className: c.className,
      assignmentCount: c.assignments.length,
      teacherCount: c.teacherCount.size,
      subjectCount: c.subjectCount.size,
    }));

    return Response.json({
      success: true,
      data: {
        summary: {
          totalAssignments: assignments.length,
          totalTeachers: Object.keys(byTeacher).length,
          totalSubjects: Object.keys(bySubject).length,
          totalClasses: Object.keys(byClass).length,
        },
        bySubject: subjectStats.sort((a, b) => b.assignmentCount - a.assignmentCount),
        byTeacher: teacherStats.sort((a, b) => b.assignmentCount - a.assignmentCount),
        byClass: classStats.sort((a, b) => b.assignmentCount - a.assignmentCount),
      },
    });
  } catch (error: any) {
    console.error("Assignments report error:", error);
    return Response.json(
      {
        error: "Failed to generate assignments report",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
