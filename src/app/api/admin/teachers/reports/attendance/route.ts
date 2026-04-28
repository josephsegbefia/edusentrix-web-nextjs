// src/app/api/admin/teachers/reports/attendance/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Teacher } from "@/models/Teacher";
import { TeacherAttendance } from "@/models/TeacherAttendance";
import mongoose from "mongoose";

function toObjectIdOrNull(id: string): mongoose.Types.ObjectId | null {
  if (!id || !id.trim()) return null;
  try {
    return new mongoose.Types.ObjectId(String(id.trim()));
  } catch {
    return null;
  }
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/**
 * GET /api/admin/teachers/reports/attendance
 * Get attendance summary report for all teachers
 * Query params: startDate (ISO string), endDate (ISO string), status (optional filter)
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
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const statusFilter = searchParams.get("status");

    // Default to last 30 days if no dates provided
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    const startDate = startDateParam
      ? new Date(startDateParam)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return Response.json({ error: "Invalid date format" }, { status: 400 });
    }

    if (startDate > endDate) {
      return Response.json({ error: "startDate must be before endDate" }, { status: 400 });
    }

    // Get all active teachers
    const teachers = await Teacher.find({
      schoolId: schoolIdObj,
      status: "active",
    })
      .populate("userId", "firstName lastName")
      .lean();

    // Build attendance query
    const attendanceMatch: any = {
      schoolId: schoolIdObj,
      date: {
        $gte: startOfDay(startDate),
        $lte: endOfDay(endDate),
      },
    };

    if (statusFilter) {
      attendanceMatch.status = statusFilter;
    }

    // Get attendance records
    const attendanceRecords = await TeacherAttendance.find(attendanceMatch).lean();

    // Calculate total days in range
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;

    // Group attendance by teacher
    const attendanceByTeacher = new Map<string, any[]>();
    attendanceRecords.forEach((record: any) => {
      const teacherId = String(record.teacherId);
      if (!attendanceByTeacher.has(teacherId)) {
        attendanceByTeacher.set(teacherId, []);
      }
      attendanceByTeacher.get(teacherId)!.push(record);
    });

    // Calculate attendance metrics for each teacher
    const attendanceData = teachers.map((teacher: any) => {
      const teacherId = String(teacher._id);
      const records = attendanceByTeacher.get(teacherId) || [];
      const user = teacher.userId || {};

      // Count by status
      const statusCounts: Record<string, number> = {
        present: 0,
        absent: 0,
        late: 0,
        on_leave: 0,
        sick: 0,
        other: 0,
      };

      let totalMinutesLate = 0;
      let leaveDays = 0;

      records.forEach((record: any) => {
        const status = record.status || "other";
        statusCounts[status] = (statusCounts[status] || 0) + 1;

        if (status === "late" && record.minutesLate) {
          totalMinutesLate += record.minutesLate;
        }

        if (["on_leave", "sick"].includes(status)) {
          leaveDays++;
        }
      });

      const presentDays = statusCounts.present;
      const absentDays = statusCounts.absent;
      const lateDays = statusCounts.late;
      const recordedDays = records.length;
      const missingDays = totalDays - recordedDays;

      // Calculate attendance rate (present + late / total days)
      const attendanceRate = totalDays > 0
        ? ((presentDays + lateDays) / totalDays) * 100
        : 0;

      // Calculate punctuality rate (present / (present + late))
      const punctualityRate = (presentDays + lateDays) > 0
        ? (presentDays / (presentDays + lateDays)) * 100
        : 100;

      return {
        teacherId,
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown",
        email: user.email || null,
        department: teacher.department || null,
        totalDays,
        recordedDays,
        missingDays,
        presentDays,
        absentDays,
        lateDays,
        leaveDays,
        totalMinutesLate,
        attendanceRate: Math.round(attendanceRate * 100) / 100,
        punctualityRate: Math.round(punctualityRate * 100) / 100,
        statusCounts,
      };
    });

    // Calculate school averages
    const totalTeachers = attendanceData.length;
    const avgAttendanceRate = totalTeachers > 0
      ? attendanceData.reduce((sum, t) => sum + t.attendanceRate, 0) / totalTeachers
      : 0;

    const avgPunctualityRate = totalTeachers > 0
      ? attendanceData.reduce((sum, t) => sum + t.punctualityRate, 0) / totalTeachers
      : 0;

    const totalAbsentDays = attendanceData.reduce((sum, t) => sum + t.absentDays, 0);
    const totalLeaveDays = attendanceData.reduce((sum, t) => sum + t.leaveDays, 0);
    const totalLateDays = attendanceData.reduce((sum, t) => sum + t.lateDays, 0);

    return Response.json({
      success: true,
      data: {
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          totalDays,
        },
        summary: {
          totalTeachers,
          avgAttendanceRate: Math.round(avgAttendanceRate * 100) / 100,
          avgPunctualityRate: Math.round(avgPunctualityRate * 100) / 100,
          totalAbsentDays,
          totalLeaveDays,
          totalLateDays,
        },
        teachers: attendanceData.sort((a, b) => {
          // Sort by attendance rate (lowest first to highlight issues), then by name
          if (a.attendanceRate !== b.attendanceRate) return a.attendanceRate - b.attendanceRate;
          return a.name.localeCompare(b.name);
        }),
      },
    });
  } catch (error: any) {
    console.error("Attendance report error:", error);
    return Response.json(
      {
        error: "Failed to generate attendance report",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
