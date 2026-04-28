// src/app/api/admin/teachers/reports/performance/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Teacher } from "@/models/Teacher";
import { TeacherPerformance } from "@/models/TeacherPerformance";
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
 * GET /api/admin/teachers/reports/performance
 * Get performance summary report for all teachers
 * Query params: periodId (optional, defaults to current active period)
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

    if (!academicPeriodId) {
      return Response.json(
        { error: "No active academic period found. Please specify a periodId." },
        { status: 400 }
      );
    }

    // Get all active teachers
    const teachers = await Teacher.find({
      schoolId: schoolIdObj,
      status: "active",
    })
      .populate("userId", "firstName lastName")
      .lean();

    // Get performance records for the period
    const performanceRecords = await TeacherPerformance.find({
      schoolId: schoolIdObj,
      academicPeriodId,
    })
      .populate("teacherId", "department")
      .populate({
        path: "teacherId",
        populate: { path: "userId", select: "firstName lastName email" },
      })
      .lean();

    // Create a map of teacher performance
    const performanceMap = new Map<string, any>();
    performanceRecords.forEach((perf: any) => {
      const teacherId = String(perf.teacherId?._id || "");
      performanceMap.set(teacherId, perf);
    });

    // Calculate performance metrics for each teacher
    const performanceData = teachers.map((teacher: any) => {
      const teacherId = String(teacher._id);
      const perf = performanceMap.get(teacherId);
      const user = teacher.userId || {};

      return {
        teacherId,
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown",
        email: user.email || null,
        department: teacher.department || null,
        averageStudentGrade: perf?.averageStudentGrade || null,
        studentPassRate: perf?.studentPassRate || null,
        classAttendanceRate: perf?.classAttendanceRate || null,
        teacherAttendanceRate: perf?.teacherAttendanceRate || null,
        evaluationCount: perf?.evaluations?.length || 0,
        averageRating: perf?.evaluations?.length > 0
          ? perf.evaluations.reduce((sum: number, e: any) => sum + (e.overallRating || 0), 0) / perf.evaluations.length
          : null,
        pdHours: perf?.pdCompleted?.reduce((sum: number, pd: any) => sum + (pd.hours || 0), 0) || 0,
        hasPerformanceData: !!perf,
      };
    });

    // Calculate school averages
    const teachersWithData = performanceData.filter((p) => p.hasPerformanceData);
    const totalTeachers = performanceData.length;

    const avgGrade = teachersWithData.length > 0
      ? teachersWithData.reduce((sum, p) => sum + (p.averageStudentGrade || 0), 0) / teachersWithData.length
      : null;

    const avgPassRate = teachersWithData.length > 0
      ? teachersWithData.reduce((sum, p) => sum + (p.studentPassRate || 0), 0) / teachersWithData.length
      : null;

    const avgClassAttendance = teachersWithData.length > 0
      ? teachersWithData.reduce((sum, p) => sum + (p.classAttendanceRate || 0), 0) / teachersWithData.length
      : null;

    const avgTeacherAttendance = teachersWithData.length > 0
      ? teachersWithData.reduce((sum, p) => sum + (p.teacherAttendanceRate || 0), 0) / teachersWithData.length
      : null;

    const avgRating = teachersWithData.length > 0
      ? teachersWithData
          .filter((p) => p.averageRating !== null)
          .reduce((sum, p) => sum + (p.averageRating || 0), 0) / teachersWithData.filter((p) => p.averageRating !== null).length
      : null;

    return Response.json({
      success: true,
      data: {
        periodId: String(academicPeriodId),
        summary: {
          totalTeachers,
          teachersWithData: teachersWithData.length,
          avgGrade: avgGrade !== null ? Math.round(avgGrade * 100) / 100 : null,
          avgPassRate: avgPassRate !== null ? Math.round(avgPassRate * 100) / 100 : null,
          avgClassAttendance: avgClassAttendance !== null ? Math.round(avgClassAttendance * 100) / 100 : null,
          avgTeacherAttendance: avgTeacherAttendance !== null ? Math.round(avgTeacherAttendance * 100) / 100 : null,
          avgRating: avgRating !== null ? Math.round(avgRating * 100) / 100 : null,
        },
        teachers: performanceData.sort((a, b) => {
          // Sort by average rating (highest first), then by name
          const aRating = a.averageRating || 0;
          const bRating = b.averageRating || 0;
          if (aRating !== bRating) return bRating - aRating;
          return a.name.localeCompare(b.name);
        }),
      },
    });
  } catch (error: any) {
    console.error("Performance report error:", error);
    return Response.json(
      {
        error: "Failed to generate performance report",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
