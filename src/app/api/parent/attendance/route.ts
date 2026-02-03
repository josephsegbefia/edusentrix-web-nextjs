// src/app/api/parent/attendance/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { Student } from "@/models/Student";
import { Guardian } from "@/models/Guardian";
import { ClassGroup } from "@/models/ClassGroup";
import { StudentAttendance } from "@/models/StudentAttendance";
import { AcademicPeriod } from "@/models/AcademicPeriod";

interface WardAttendanceSummary {
  wardId: string;
  wardName: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  classGroup: string;
  rate: number;
  daysPresent: number;
  daysAbsent: number;
  daysLate: number;
  daysExcused: number;
  totalDays: number;
  trend: "up" | "down" | "stable";
  previousRate: number | null;
}

interface DailyAttendanceRecord {
  date: string;
  wardId: string;
  wardName: string;
  status: "present" | "absent" | "late" | "excused";
  notes?: string;
}

export async function GET(req: NextRequest) {
  try {
    const context = await requireParent();
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const periodId = searchParams.get("periodId") || searchParams.get("termId");
    const month = searchParams.get("month"); // YYYY-MM format

    // Get all wards for this parent
    const guardians = await Guardian.find({ userId: context.userId })
      .select("studentId")
      .lean();

    if (!guardians.length) {
      return NextResponse.json({
        success: true,
        data: {
          currentPeriod: null,
          availablePeriods: [],
          wards: [],
          overallSummary: {
            averageRate: null,
            totalPresent: 0,
            totalAbsent: 0,
            totalLate: 0,
            totalDays: 0,
          },
          recentRecords: [],
          monthlyBreakdown: [],
        },
      });
    }

    const studentIds = guardians.map(
      (g) => (g as unknown as { studentId: mongoose.Types.ObjectId }).studentId
    );

    // Fetch students
    const students = await Student.find({
      _id: { $in: studentIds },
      schoolId: context.schoolId,
      status: "active",
    })
      .select("_id firstName lastName photoUrl classGroupId")
      .lean();

    if (!students.length) {
      return NextResponse.json({
        success: true,
        data: {
          currentPeriod: null,
          availablePeriods: [],
          wards: [],
          overallSummary: {
            averageRate: null,
            totalPresent: 0,
            totalAbsent: 0,
            totalLate: 0,
            totalDays: 0,
          },
          recentRecords: [],
          monthlyBreakdown: [],
        },
      });
    }

    // Get class groups
    const classGroupIds = students.map((s: any) => s.classGroupId).filter(Boolean);
    const classGroups = await ClassGroup.find({ _id: { $in: classGroupIds } })
      .select("_id name")
      .lean();
    const classGroupMap = new Map(
      classGroups.map((cg: any) => [String(cg._id), cg.name])
    );

    // Get current and available academic periods
    const now = new Date();
    let currentPeriod = await AcademicPeriod.findOne({
      schoolId: context.schoolId,
      startDate: { $lte: now },
      endDate: { $gte: now },
    })
      .select("_id name label startDate endDate")
      .lean();

    if (!currentPeriod) {
      currentPeriod = await AcademicPeriod.findOne({
        schoolId: context.schoolId,
        endDate: { $lte: now },
      })
        .sort({ endDate: -1 })
        .select("_id name label startDate endDate")
        .lean();
    }

    const selectedPeriodId = periodId
      ? new mongoose.Types.ObjectId(periodId)
      : currentPeriod?._id;

    // Get available periods
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const availablePeriods = await AcademicPeriod.find({
      schoolId: context.schoolId,
      startDate: { $gte: twoYearsAgo },
    })
      .select("_id name label startDate endDate")
      .sort({ startDate: -1 })
      .lean();

    // Build date filter
    const dateFilter: any = { schoolId: context.schoolId, studentId: { $in: studentIds } };
    
    if (selectedPeriodId) {
      const period = availablePeriods.find((p: any) => String(p._id) === String(selectedPeriodId));
      if (period) {
        dateFilter.date = {
          $gte: (period as any).startDate,
          $lte: (period as any).endDate,
        };
      }
    }

    if (month) {
      const [year, monthNum] = month.split("-").map(Number);
      const startOfMonth = new Date(year, monthNum - 1, 1);
      const endOfMonth = new Date(year, monthNum, 0);
      dateFilter.date = {
        ...dateFilter.date,
        $gte: startOfMonth,
        $lte: endOfMonth,
      };
    }

    // Fetch attendance records
    const attendanceRecords = await StudentAttendance.find(dateFilter)
      .select("studentId date status notes")
      .sort({ date: -1 })
      .lean();

    // Group by student
    const attendanceByStudent = new Map<string, any[]>();
    attendanceRecords.forEach((record: any) => {
      const studentId = String(record.studentId);
      if (!attendanceByStudent.has(studentId)) {
        attendanceByStudent.set(studentId, []);
      }
      attendanceByStudent.get(studentId)!.push(record);
    });

    // Get previous period for trend
    let previousPeriod: any = null;
    if (currentPeriod) {
      previousPeriod = await AcademicPeriod.findOne({
        schoolId: context.schoolId,
        endDate: { $lt: (currentPeriod as any).startDate },
      })
        .sort({ endDate: -1 })
        .select("_id startDate endDate")
        .lean();
    }

    // Fetch previous period attendance for trend
    let previousAttendanceByStudent = new Map<string, { present: number; total: number }>();
    if (previousPeriod) {
      const prevRecords = await StudentAttendance.find({
        schoolId: context.schoolId,
        studentId: { $in: studentIds },
        date: {
          $gte: previousPeriod.startDate,
          $lte: previousPeriod.endDate,
        },
      })
        .select("studentId status")
        .lean();

      prevRecords.forEach((record: any) => {
        const studentId = String(record.studentId);
        if (!previousAttendanceByStudent.has(studentId)) {
          previousAttendanceByStudent.set(studentId, { present: 0, total: 0 });
        }
        const data = previousAttendanceByStudent.get(studentId)!;
        data.total++;
        if (record.status === "present" || record.status === "late") {
          data.present++;
        }
      });
    }

    // Build ward summaries
    const wardSummaries: WardAttendanceSummary[] = [];
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalLate = 0;
    let totalExcused = 0;
    let totalDays = 0;

    students.forEach((student: any) => {
      const studentId = String(student._id);
      const records = attendanceByStudent.get(studentId) || [];
      const wardName = `${student.firstName || ""} ${student.lastName || ""}`.trim();

      let present = 0;
      let absent = 0;
      let late = 0;
      let excused = 0;

      records.forEach((r: any) => {
        if (r.status === "present") present++;
        else if (r.status === "absent") absent++;
        else if (r.status === "late") late++;
        else if (r.status === "excused") excused++;
      });

      const total = records.length;
      const rate = total > 0 ? ((present + late) / total) * 100 : 0;

      // Trend calculation
      const prevData = previousAttendanceByStudent.get(studentId);
      const previousRate = prevData && prevData.total > 0
        ? (prevData.present / prevData.total) * 100
        : null;

      let trend: "up" | "down" | "stable" = "stable";
      if (previousRate !== null) {
        if (rate > previousRate + 5) trend = "up";
        else if (rate < previousRate - 5) trend = "down";
      }

      wardSummaries.push({
        wardId: studentId,
        wardName,
        firstName: student.firstName || "",
        lastName: student.lastName || "",
        photoUrl: student.photoUrl || null,
        classGroup: classGroupMap.get(String(student.classGroupId)) || "",
        rate,
        daysPresent: present,
        daysAbsent: absent,
        daysLate: late,
        daysExcused: excused,
        totalDays: total,
        trend,
        previousRate,
      });

      totalPresent += present;
      totalAbsent += absent;
      totalLate += late;
      totalExcused += excused;
      totalDays += total;
    });

    // Calculate overall average rate
    const averageRate = totalDays > 0
      ? ((totalPresent + totalLate) / totalDays) * 100
      : null;

    // Get recent records (last 20)
    const recentRecords: DailyAttendanceRecord[] = attendanceRecords
      .slice(0, 20)
      .map((r: any) => {
        const student = students.find((s: any) => String(s._id) === String(r.studentId));
        return {
          date: r.date.toISOString(),
          wardId: String(r.studentId),
          wardName: student
            ? `${(student as any).firstName || ""} ${(student as any).lastName || ""}`.trim()
            : "Unknown",
          status: r.status,
          notes: r.notes,
        };
      });

    // Monthly breakdown
    const monthlyMap = new Map<string, { present: number; absent: number; late: number; excused: number; total: number }>();
    attendanceRecords.forEach((r: any) => {
      const monthKey = r.date.toISOString().slice(0, 7); // YYYY-MM
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { present: 0, absent: 0, late: 0, excused: 0, total: 0 });
      }
      const data = monthlyMap.get(monthKey)!;
      data.total++;
      if (r.status === "present") data.present++;
      else if (r.status === "absent") data.absent++;
      else if (r.status === "late") data.late++;
      else if (r.status === "excused") data.excused++;
    });

    const monthlyBreakdown = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month,
        label: new Date(month + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        ...data,
        rate: data.total > 0 ? ((data.present + data.late) / data.total) * 100 : 0,
      }))
      .sort((a, b) => b.month.localeCompare(a.month));

    return NextResponse.json({
      success: true,
      data: {
        currentPeriod: currentPeriod
          ? {
              id: String((currentPeriod as any)._id),
              name: (currentPeriod as any).name,
              label: (currentPeriod as any).label,
            }
          : null,
        selectedPeriodId: selectedPeriodId ? String(selectedPeriodId) : null,
        availablePeriods: availablePeriods.map((p: any) => ({
          id: String(p._id),
          name: p.name,
          label: p.label || p.name,
        })),
        wards: wardSummaries,
        overallSummary: {
          averageRate,
          totalPresent,
          totalAbsent,
          totalLate,
          totalExcused,
          totalDays,
        },
        recentRecords,
        monthlyBreakdown,
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Failed to fetch parent attendance:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch attendance",
      },
      { status: 500 }
    );
  }
}
