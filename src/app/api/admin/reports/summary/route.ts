import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Activity } from "@/models/Activity";
import { Invitation } from "@/models/Invitation";
import { Invoice } from "@/models/Invoice";
import { Payment } from "@/models/Payment";
import { Student } from "@/models/Student";
import { SubjectGrade } from "@/models/SubjectGrade";
import { Teacher } from "@/models/Teacher";
import { TeacherAttendance } from "@/models/TeacherAttendance";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(d: Date): Date {
  const date = new Date(d);
  date.setHours(23, 59, 59, 999);
  return date;
}

function daysBetween(startDate: Date, endDate: Date): number {
  const diff = endDate.getTime() - startDate.getTime();
  return Math.max(1, Math.floor(diff / DAY_MS) + 1);
}

function parseDate(input: string | null): Date | null {
  if (!input) return null;
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

async function resolveDateRange(
  schoolId: mongoose.Types.ObjectId,
  searchParams: URLSearchParams
) {
  const periodIdParam = searchParams.get("periodId");
  if (periodIdParam) {
    if (!mongoose.Types.ObjectId.isValid(periodIdParam)) {
      return { error: "Invalid periodId" } as const;
    }
    const period = await AcademicPeriod.findOne({
      _id: periodIdParam,
      schoolId,
    })
      .select("yearLabel term startDate endDate")
      .lean();
    if (!period) {
      return { error: "Academic period not found" } as const;
    }
    return {
      startDate: startOfDay(new Date(period.startDate)),
      endDate: endOfDay(new Date(period.endDate)),
      source: "period" as const,
      period: {
        id: String(period._id),
        term: period.term,
        yearLabel: period.yearLabel,
        label: `${period.term} ${period.yearLabel}`,
        startDate: new Date(period.startDate).toISOString(),
        endDate: new Date(period.endDate).toISOString(),
      },
      periodIdObj: new mongoose.Types.ObjectId(String(period._id)),
    } as const;
  }

  const startParam = parseDate(searchParams.get("startDate"));
  const endParam = parseDate(searchParams.get("endDate"));
  if (startParam || endParam) {
    const endDate = endParam ?? new Date();
    const startDate =
      startParam ?? new Date(endDate.getTime() - 29 * DAY_MS);
    if (startDate > endDate) {
      return { error: "startDate must be before endDate" } as const;
    }
    return {
      startDate: startOfDay(startDate),
      endDate: endOfDay(endDate),
      source: "custom" as const,
      period: null,
      periodIdObj: null,
    } as const;
  }

  const currentPeriod = await AcademicPeriod.findOne({
    schoolId,
    isCurrent: true,
  })
    .select("yearLabel term startDate endDate")
    .lean();

  if (currentPeriod) {
    return {
      startDate: startOfDay(new Date(currentPeriod.startDate)),
      endDate: endOfDay(new Date(currentPeriod.endDate)),
      source: "current_period" as const,
      period: {
        id: String(currentPeriod._id),
        term: currentPeriod.term,
        yearLabel: currentPeriod.yearLabel,
        label: `${currentPeriod.term} ${currentPeriod.yearLabel}`,
        startDate: new Date(currentPeriod.startDate).toISOString(),
        endDate: new Date(currentPeriod.endDate).toISOString(),
      },
      periodIdObj: new mongoose.Types.ObjectId(String(currentPeriod._id)),
    } as const;
  }

  const endDate = endOfDay(new Date());
  const startDate = startOfDay(new Date(endDate.getTime() - 89 * DAY_MS));
  return {
    startDate,
    endDate,
    source: "default" as const,
    period: null,
    periodIdObj: null,
  } as const;
}

export async function GET(req: NextRequest) {
  const { schoolId } = await requireSchoolAdmin();
  await connectToDatabase();

  if (!schoolId) {
    return NextResponse.json({ error: "School ID not found" }, { status: 400 });
  }

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  const { searchParams } = new URL(req.url);
  const range = await resolveDateRange(schoolIdObj, searchParams);
  if ("error" in range) {
    return NextResponse.json({ error: range.error }, { status: 400 });
  }

  const { startDate, endDate, source, period, periodIdObj } = range;
  const rangeDays = daysBetween(startDate, endDate);

  const paymentsPromise = Payment.aggregate([
    {
      $match: {
        schoolId: schoolIdObj,
        status: "completed",
        paymentDate: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$amountMinor" },
        count: { $sum: 1 },
      },
    },
  ]);

  const billedPromise = Invoice.aggregate([
    {
      $match: {
        schoolId: schoolIdObj,
        status: { $ne: "draft" },
        $or: [
          { issueDate: { $gte: startDate, $lte: endDate } },
          {
            issueDate: null,
            createdAt: { $gte: startDate, $lte: endDate },
          },
        ],
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$totalAmountMinor" },
        count: { $sum: 1 },
      },
    },
  ]);

  const outstandingPromise = Invoice.aggregate([
    {
      $match: {
        schoolId: schoolIdObj,
        status: { $in: ["issued", "partially_paid", "overdue"] },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$totalOutstandingMinor" },
      },
    },
  ]);

  const overduePromise = Invoice.countDocuments({
    schoolId: schoolIdObj,
    status: "overdue",
  });

  const studentsTotalPromise = Student.countDocuments({
    schoolId: schoolIdObj,
  });

  const studentsNewPromise = Student.countDocuments({
    schoolId: schoolIdObj,
    $or: [
      { enrolledAt: { $gte: startDate, $lte: endDate } },
      { enrolledAt: null, createdAt: { $gte: startDate, $lte: endDate } },
    ],
  });

  const studentStatusPromise = Student.aggregate([
    { $match: { schoolId: schoolIdObj } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const teacherStatusPromise = Teacher.aggregate([
    { $match: { schoolId: schoolIdObj } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const homeroomPromise = Teacher.countDocuments({
    schoolId: schoolIdObj,
    homeroomClassGroupId: { $ne: null },
    status: "active",
  });

  const attendancePromise = TeacherAttendance.aggregate([
    {
      $match: {
        schoolId: schoolIdObj,
        date: { $gte: startDate, $lte: endDate },
      },
    },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const invitationStatusPromise = Invitation.aggregate([
    { $match: { schoolId: schoolIdObj } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const invitationsRangePromise = Invitation.countDocuments({
    schoolId: schoolIdObj,
    createdAt: { $gte: startDate, $lte: endDate },
  });

  const activityCountPromise = Activity.countDocuments({
    schoolId: schoolIdObj,
    createdAt: { $gte: startDate, $lte: endDate },
  });

  const reportGeneratedPromise = Activity.countDocuments({
    schoolId: schoolIdObj,
    type: "report.generated",
    createdAt: { $gte: startDate, $lte: endDate },
  });

  const academicsPromise = SubjectGrade.aggregate([
    {
      $match: periodIdObj
        ? {
            schoolId: schoolIdObj,
            academicPeriodId: periodIdObj,
          }
        : {
            schoolId: schoolIdObj,
            lastUpdated: { $gte: startDate, $lte: endDate },
          },
    },
    {
      $group: {
        _id: null,
        avgScore: { $avg: "$totalScore" },
        passRate: {
          $avg: {
            $cond: ["$isPassed", 1, 0],
          },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const [
    paymentsAgg,
    billedAgg,
    outstandingAgg,
    overdueCount,
    studentsTotal,
    studentsNew,
    studentStatusAgg,
    teacherStatusAgg,
    homeroomCount,
    attendanceAgg,
    invitationStatusAgg,
    invitationsInRange,
    activityCount,
    reportsGenerated,
    academicsAgg,
  ] = await Promise.all([
    paymentsPromise,
    billedPromise,
    outstandingPromise,
    overduePromise,
    studentsTotalPromise,
    studentsNewPromise,
    studentStatusPromise,
    teacherStatusPromise,
    homeroomPromise,
    attendancePromise,
    invitationStatusPromise,
    invitationsRangePromise,
    activityCountPromise,
    reportGeneratedPromise,
    academicsPromise,
  ]);

  const revenueInRangeMinor = paymentsAgg[0]?.total ?? 0;
  const paymentsCount = paymentsAgg[0]?.count ?? 0;
  const billedInRangeMinor = billedAgg[0]?.total ?? 0;
  const invoicesInRange = billedAgg[0]?.count ?? 0;
  const outstandingMinor = outstandingAgg[0]?.total ?? 0;

  const collectionRate =
    billedInRangeMinor > 0
      ? Math.round((revenueInRangeMinor / billedInRangeMinor) * 10000) / 100
      : 0;

  const studentStatusCounts = {
    active: 0,
    inactive: 0,
    withdrawn: 0,
  };

  for (const row of studentStatusAgg) {
    const key = String(row._id) as keyof typeof studentStatusCounts;
    if (key in studentStatusCounts) {
      studentStatusCounts[key] = row.count ?? 0;
    }
  }

  const teacherStatusCounts = {
    active: 0,
    inactive: 0,
    on_leave: 0,
    terminated: 0,
  };

  for (const row of teacherStatusAgg) {
    const key = String(row._id) as keyof typeof teacherStatusCounts;
    if (key in teacherStatusCounts) {
      teacherStatusCounts[key] = row.count ?? 0;
    }
  }

  const teachersTotal = Object.values(teacherStatusCounts).reduce(
    (sum, value) => sum + value,
    0
  );

  const attendanceCounts = {
    present: 0,
    absent: 0,
    late: 0,
    on_leave: 0,
    sick: 0,
    other: 0,
  };

  for (const row of attendanceAgg) {
    const key = String(row._id) as keyof typeof attendanceCounts;
    if (key in attendanceCounts) {
      attendanceCounts[key] = row.count ?? 0;
    }
  }

  const attendanceTotal = Object.values(attendanceCounts).reduce(
    (sum, value) => sum + value,
    0
  );

  const attendanceCoverage =
    teachersTotal > 0 && rangeDays > 0
      ? Math.round(
          (attendanceTotal / (teachersTotal * rangeDays)) * 10000
        ) / 100
      : 0;

  const attendancePresentRate =
    attendanceTotal > 0
      ? Math.round(
          ((attendanceCounts.present + attendanceCounts.late) /
            attendanceTotal) *
            10000
        ) / 100
      : 0;

  const invitationStatusCounts = {
    pending: 0,
    accepted: 0,
    expired: 0,
    revoked: 0,
    failed: 0,
  };

  for (const row of invitationStatusAgg) {
    const key = String(row._id) as keyof typeof invitationStatusCounts;
    if (key in invitationStatusCounts) {
      invitationStatusCounts[key] = row.count ?? 0;
    }
  }

  const invitationsTotal = Object.values(invitationStatusCounts).reduce(
    (sum, value) => sum + value,
    0
  );

  const academicsSnapshot = academicsAgg[0] ?? null;
  const academicsAverageScore = academicsSnapshot?.avgScore ?? 0;
  const academicsPassRate = academicsSnapshot?.passRate ?? 0;
  const academicsCount = academicsSnapshot?.count ?? 0;

  return NextResponse.json({
    range: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      days: rangeDays,
      source,
      period,
    },
    categories: {
      fees: {
        revenueInRangeMinor,
        paymentsCount,
        billedInRangeMinor,
        invoicesInRange,
        outstandingMinor,
        overdueCount,
        collectionRate,
      },
      students: {
        total: studentsTotal,
        newInRange: studentsNew,
        status: studentStatusCounts,
      },
      teachers: {
        total: teachersTotal,
        status: teacherStatusCounts,
        homeroomCount,
      },
      attendance: {
        totalRecords: attendanceTotal,
        status: attendanceCounts,
        coverageRate: attendanceCoverage,
        presentRate: attendancePresentRate,
      },
      invitations: {
        total: invitationsTotal,
        status: invitationStatusCounts,
        sentInRange: invitationsInRange,
      },
      academics: {
        records: academicsCount,
        averageScore:
          Math.round((academicsAverageScore || 0) * 10) / 10,
        passRate: Math.round((academicsPassRate || 0) * 1000) / 10,
        scope: periodIdObj ? "period" : "range",
      },
      activity: {
        totalInRange: activityCount,
        reportsGenerated: reportsGenerated,
      },
    },
  });
}
