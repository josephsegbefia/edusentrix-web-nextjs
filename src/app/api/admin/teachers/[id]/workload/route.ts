// src/app/api/admin/teachers/[id]/workload/route.ts
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
 * GET /api/admin/teachers/:id/workload
 * Get workload metrics for a specific teacher
 * Query params: periodId (optional, defaults to current active period)
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { schoolId } = await requireSchoolAdmin();
  await connectToDatabase();

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  const { id } = await ctx.params;
  const teacherId = toObjectIdOrNull(String(id));

  if (!teacherId) {
    return Response.json({ error: "Invalid teacher id" }, { status: 400 });
  }

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

    // Find teacher
    const teacher = await Teacher.findOne({
      _id: teacherId,
      schoolId: schoolIdObj,
    }).lean();

    if (!teacher) {
      return Response.json({ error: "Teacher not found" }, { status: 404 });
    }

    // Get assignments for the period (or all if no period specified)
    const assignmentMatch: any = {
      schoolId: schoolIdObj,
      teacherId: teacherId,
      status: "active",
    };

    if (academicPeriodId) {
      assignmentMatch.academicPeriodId = academicPeriodId;
    }

    const assignments = await TeacherAssignment.find(assignmentMatch)
      .populate("classGroupId", "name capacity")
      .lean();

    // Calculate current workload
    const uniqueClassIdStrings = new Set(
      assignments.map((a: any) => String(a.classGroupId?._id || "")).filter((id) => id !== "")
    );
    const uniqueClassCount = uniqueClassIdStrings.size;

    // Get class capacities to estimate students
    const classIds = Array.from(uniqueClassIdStrings)
      .map((id) => toObjectIdOrNull(id))
      .filter((id): id is mongoose.Types.ObjectId => id !== null);

    const classes = classIds.length > 0
      ? await ClassGroup.find({
          _id: { $in: classIds },
          schoolId: schoolIdObj,
        })
          .select("capacity")
          .lean()
      : [];

    // Estimate students (if capacity is set, use it; otherwise estimate 30 per class)
    const totalStudents = classes.reduce((sum: number, c: any) => {
      return sum + (c.capacity || 30);
    }, 0);

    // Calculate total workload hours
    const totalWorkloadHours = assignments.reduce((sum: number, a: any) => {
      return sum + (a.workloadHours || 0);
    }, 0);

    // Get max capacity from teacher record
    const maxClasses = (teacher as any).maxClasses || null;
    const maxStudents = (teacher as any).maxStudents || null;

    // Calculate utilization
    const classUtilization = maxClasses ? (uniqueClassCount / maxClasses) * 100 : null;
    const studentUtilization = maxStudents ? (totalStudents / maxStudents) * 100 : null;

    // Calculate school averages for comparison
    const allTeachers = await Teacher.find({
      schoolId: schoolIdObj,
      status: "active",
    }).lean();

    const allAssignments = academicPeriodId
      ? await TeacherAssignment.find({
          schoolId: schoolIdObj,
          academicPeriodId,
          status: "active",
        }).lean()
      : await TeacherAssignment.find({
          schoolId: schoolIdObj,
          status: "active",
        }).lean();

    // Group assignments by teacher
    const assignmentsByTeacher = new Map<string, any[]>();
    allAssignments.forEach((a: any) => {
      const tid = String(a.teacherId);
      if (!assignmentsByTeacher.has(tid)) {
        assignmentsByTeacher.set(tid, []);
      }
      assignmentsByTeacher.get(tid)!.push(a);
    });

    // Calculate averages
    const teacherWorkloads = allTeachers.map((t: any) => {
      const tAssignments = assignmentsByTeacher.get(String(t._id)) || [];
      const tClasses = new Set(tAssignments.map((a: any) => String(a.classGroupId))).size;
      return {
        classes: tClasses,
        maxClasses: t.maxClasses || null,
      };
    });

    const avgClasses = teacherWorkloads.length > 0
      ? teacherWorkloads.reduce((sum, t) => sum + t.classes, 0) / teacherWorkloads.length
      : 0;

    // Check if over capacity or significantly above average
    const isOverCapacity = (maxClasses && uniqueClassCount > maxClasses) || (maxStudents && totalStudents > maxStudents);
    const isAboveAverage = uniqueClassCount > avgClasses * 1.2; // 20% above average

    return Response.json({
      success: true,
      data: {
        periodId: academicPeriodId ? String(academicPeriodId) : null,
        current: {
          classes: uniqueClassCount,
          students: totalStudents,
          workloadHours: totalWorkloadHours,
          assignments: assignments.length,
        },
        capacity: {
          maxClasses,
          maxStudents,
          classUtilization: classUtilization !== null ? Math.round(classUtilization * 100) / 100 : null,
          studentUtilization: studentUtilization !== null ? Math.round(studentUtilization * 100) / 100 : null,
        },
        comparison: {
          schoolAvgClasses: Math.round(avgClasses * 100) / 100,
          isAboveAverage,
          differenceFromAverage: Math.round((uniqueClassCount - avgClasses) * 100) / 100,
        },
        warnings: {
          isOverCapacity,
          isAboveAverage,
        },
      },
    });
  } catch (error: any) {
    console.error("Workload calculation error:", error);
    return Response.json(
      {
        error: "Failed to calculate workload",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
