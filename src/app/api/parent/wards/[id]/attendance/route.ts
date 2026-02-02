// src/app/api/parent/wards/[id]/attendance/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent, verifyGuardianAccess } from "@/lib/auth/requireParent";
import { StudentAttendance } from "@/models/StudentAttendance";
import { AcademicPeriod } from "@/models/AcademicPeriod";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireParent();
    await connectToDatabase();

    const { id: studentId } = await ctx.params;
    await verifyGuardianAccess(context.userId, studentId);

    const url = new URL(req.url);
    const periodId = url.searchParams.get("periodId");

    const studentObjectId = new mongoose.Types.ObjectId(studentId);

    // Get academic period
    let period;
    if (periodId) {
      period = await AcademicPeriod.findOne({
        _id: new mongoose.Types.ObjectId(periodId),
        schoolId: context.schoolId,
      }).lean() as { _id: mongoose.Types.ObjectId; startDate: Date; endDate: Date } | null;
    } else {
      period = await AcademicPeriod.findOne({
        schoolId: context.schoolId,
        isCurrent: true,
      }).lean() as { _id: mongoose.Types.ObjectId; startDate: Date; endDate: Date } | null;
    }

    const dateFilter: { $gte?: Date; $lte?: Date } = {};
    if (period) {
      dateFilter.$gte = period.startDate;
      dateFilter.$lte = period.endDate;
    }

    // Get attendance records
    const records = await StudentAttendance.find({
      studentId: studentObjectId,
      schoolId: context.schoolId,
      ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
    })
      .sort({ date: -1 })
      .limit(50)
      .lean() as Array<{
        date: Date;
        status: string;
        lateMinutes?: number;
        reason?: string;
      }>;

    // Calculate stats
    const stats = records.reduce(
      (acc, r) => {
        if (r.status === "present") acc.present++;
        else if (r.status === "absent") acc.absent++;
        else if (r.status === "late") acc.late++;
        else if (r.status === "excused") acc.excused++;
        return acc;
      },
      { present: 0, absent: 0, late: 0, excused: 0 }
    );

    const totalDays = records.length;
    const rate = totalDays > 0 ? (stats.present / totalDays) * 100 : 100;

    // Group by month for breakdown
    const monthlyMap = new Map<string, { present: number; absent: number; late: number; total: number }>();
    records.forEach((r) => {
      const monthKey = new Date(r.date).toLocaleDateString("en-US", { month: "short", year: "numeric" });
      const existing = monthlyMap.get(monthKey) || { present: 0, absent: 0, late: 0, total: 0 };
      existing.total++;
      if (r.status === "present") existing.present++;
      else if (r.status === "absent") existing.absent++;
      else if (r.status === "late") existing.late++;
      monthlyMap.set(monthKey, existing);
    });

    const monthlyBreakdown = Array.from(monthlyMap.entries()).map(([month, data]) => ({
      month,
      ...data,
    }));

    // Recent records (last 10)
    const recentRecords = records.slice(0, 10).map((r) => ({
      date: r.date.toISOString(),
      status: r.status as "present" | "absent" | "late" | "excused",
      notes: r.reason || undefined,
    }));

    return NextResponse.json({
      success: true,
      data: {
        rate: Math.round(rate * 10) / 10,
        daysPresent: stats.present,
        daysAbsent: stats.absent,
        daysLate: stats.late,
        totalDays,
        trend: "stable" as const, // TODO: Calculate actual trend
        recentRecords,
        monthlyBreakdown,
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Failed to fetch ward attendance:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch attendance" },
      { status: 500 }
    );
  }
}
