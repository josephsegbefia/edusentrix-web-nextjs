// src/app/api/admin/teachers/reports/workload/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Teacher } from "@/models/Teacher";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { ClassGroup } from "@/models/ClassGroup";
import { AcademicPeriod } from "@/models/AcademicPeriod";
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
 * GET /api/admin/teachers/reports/workload
 * Get workload distribution report for all teachers
 * Query params: periodId (optional, defaults to current active period)
 */
export async function GET(req: NextRequest) {
  const { schoolId } = await requireSchoolAdmin();
  await connectToDatabase();

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  try {
    const { searchParams } = new URL(req.url);
    const periodId = searchParams.get("periodId");

    let academicPeriodId: mongoose.Types.ObjectId | null = null;

    // Get academic period
    if (periodId) {
      academicPeriodId = toObjectIdOrNull(periodId);
      if (!academicPeriodId) {
        return Response.json({ error: "Invalid periodId" }, { status: 400 });
      }

      const period = await AcademicPeriod.findOne({
        _id: academicPeriodId,
        schoolId: schoolIdObj,
      }).lean();

      if (!period) {
        return Response.json({ error: "Academic period not found" }, { status: 404 });
      }
    } else {
      // Get current active period
      const currentPeriod = await AcademicPeriod.findOne({
        schoolId: schoolIdObj,
        isCurrent: true,
      })
        .sort({ startDate: -1 })
        .lean() as { _id: any } | null;

      if (currentPeriod) {
        academicPeriodId = currentPeriod._id instanceof mongoose.Types.ObjectId
          ? currentPeriod._id
          : new mongoose.Types.ObjectId(String(currentPeriod._id));
      }
    }

    // Get all active teachers
    const teachers = await Teacher.find({
      schoolId: schoolIdObj,
      status: "active",
    })
      .populate("userId", "firstName lastName")
      .lean();

    // Get assignments for the period
    const assignmentMatch: any = {
      schoolId: schoolIdObj,
      status: "active",
    };

    if (academicPeriodId) {
      assignmentMatch.academicPeriodId = academicPeriodId;
    }

    const assignments = await TeacherAssignment.find(assignmentMatch)
      .populate("classGroupId", "name")
      .populate("subjectId", "name")
      .lean();

    // Calculate workload for each teacher
    const workloadData = teachers.map((teacher: any) => {
      const teacherAssignments = assignments.filter(
        (a: any) => String(a.teacherId) === String(teacher._id)
      );

      // Count unique classes
      const uniqueClassIdsSet = new Set(
        teacherAssignments.map((a: any) => String(a.classGroupId?._id || "")).filter((id: string) => id !== "")
      );
      const uniqueClassCount = uniqueClassIdsSet.size;

      // Count total students (sum of class capacities)
      const classIds = Array.from(uniqueClassIdsSet).map((id) => toObjectIdOrNull(id as string)).filter((id): id is mongoose.Types.ObjectId => id !== null);
      const classes = classIds.length > 0
        ? (teacherAssignments
            .map((a: any) => a.classGroupId)
            .filter((c: any) => c && classIds.some((id) => String(id) === String(c._id)))
            .reduce((acc: any[], curr: any) => {
              if (!acc.find((c) => String(c._id) === String(curr._id))) {
                acc.push(curr);
              }
              return acc;
            }, []) as any[])
        : [];

      // Estimate students (if capacity is set, use it; otherwise estimate 30 per class)
      const totalStudents = classes.reduce((sum, c: any) => {
        return sum + (c.capacity || 30);
      }, 0);

      // Calculate total workload hours
      const totalWorkloadHours = teacherAssignments.reduce((sum: number, a: any) => {
        return sum + (a.workloadHours || 0);
      }, 0);

      // Get max capacity from teacher record
      const maxClasses = teacher.maxClasses || null;
      const maxStudents = teacher.maxStudents || null;

      // Calculate utilization
      const classUtilization = maxClasses ? (uniqueClassCount / maxClasses) * 100 : null;
      const studentUtilization = maxStudents ? (totalStudents / maxStudents) * 100 : null;

      const user = teacher.userId || {};
      return {
        teacherId: String(teacher._id),
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown",
        email: user.email || null,
        department: teacher.department || null,
        currentClasses: uniqueClassCount,
        currentStudents: totalStudents,
        totalWorkloadHours,
        maxClasses,
        maxStudents,
        classUtilization: classUtilization !== null ? Math.round(classUtilization * 100) / 100 : null,
        studentUtilization: studentUtilization !== null ? Math.round(studentUtilization * 100) / 100 : null,
        assignmentsCount: teacherAssignments.length,
        isOverCapacity: (maxClasses && uniqueClassCount > maxClasses) || (maxStudents && totalStudents > maxStudents),
      };
    });

    // Calculate school averages
    const totalTeachers = workloadData.length;
    const avgClasses = totalTeachers > 0
      ? workloadData.reduce((sum, t) => sum + t.currentClasses, 0) / totalTeachers
      : 0;
    const avgStudents = totalTeachers > 0
      ? workloadData.reduce((sum, t) => sum + t.currentStudents, 0) / totalTeachers
      : 0;
    const avgWorkloadHours = totalTeachers > 0
      ? workloadData.reduce((sum, t) => sum + t.totalWorkloadHours, 0) / totalTeachers
      : 0;

    // Find teachers over capacity
    const overCapacity = workloadData.filter((t) => t.isOverCapacity);

    return Response.json({
      success: true,
      data: {
        periodId: academicPeriodId ? String(academicPeriodId) : null,
        summary: {
          totalTeachers,
          avgClasses: Math.round(avgClasses * 100) / 100,
          avgStudents: Math.round(avgStudents * 100) / 100,
          avgWorkloadHours: Math.round(avgWorkloadHours * 100) / 100,
          overCapacityCount: overCapacity.length,
        },
        teachers: workloadData.sort((a, b) => {
          // Sort by utilization (highest first), then by name
          const aUtil = a.classUtilization || a.studentUtilization || 0;
          const bUtil = b.classUtilization || b.studentUtilization || 0;
          if (aUtil !== bUtil) return bUtil - aUtil;
          return a.name.localeCompare(b.name);
        }),
        overCapacity,
      },
    });
  } catch (error: any) {
    console.error("Workload report error:", error);
    return Response.json(
      {
        error: "Failed to generate workload report",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
