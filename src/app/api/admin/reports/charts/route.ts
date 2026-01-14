import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Activity } from "@/models/Activity";
import { Grade } from "@/models/Grade";
import { Invitation } from "@/models/Invitation";
import { Invoice } from "@/models/Invoice";
import { Payment } from "@/models/Payment";
import { Student } from "@/models/Student";
import { Subject } from "@/models/Subject";
import { SubjectGrade } from "@/models/SubjectGrade";
import { Teacher } from "@/models/Teacher";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { TeacherAttendance } from "@/models/TeacherAttendance";

const DAY_MS = 24 * 60 * 60 * 1000;

type Interval = "day" | "week" | "month";
type AttendanceCounts = {
  total: number;
  present: number;
  late: number;
  absent: number;
  on_leave: number;
  sick: number;
  other: number;
};
type AttendanceStatus = Exclude<keyof AttendanceCounts, "total">;

type Bucket = {
  key: string;
  label: string;
  start: Date;
  end: Date;
};

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

function addDays(d: Date, days: number): Date {
  const date = new Date(d);
  date.setDate(date.getDate() + days);
  return date;
}

function startOfWeek(d: Date): Date {
  const date = startOfDay(d);
  const day = date.getDay();
  const diff = (day + 6) % 7;
  date.setDate(date.getDate() - diff);
  return date;
}

function formatDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonthKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function buildBuckets(
  startDate: Date,
  endDate: Date,
  interval: Interval
): Bucket[] {
  const buckets: Bucket[] = [];

  if (interval === "day") {
    let cursor = startOfDay(startDate);
    const last = endOfDay(endDate);
    while (cursor <= last) {
      const start = startOfDay(cursor);
      const end = endOfDay(cursor);
      const key = formatDateKey(cursor);
      buckets.push({ key, label: key, start, end });
      cursor = addDays(cursor, 1);
    }
    return buckets;
  }

  if (interval === "week") {
    let cursor = startOfWeek(startDate);
    const last = endOfDay(endDate);
    while (cursor <= last) {
      const start = startOfDay(cursor);
      const end = endOfDay(addDays(cursor, 6));
      const key = formatDateKey(start);
      buckets.push({ key, label: key, start, end });
      cursor = addDays(cursor, 7);
    }
    return buckets;
  }

  let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const last = endOfDay(endDate);
  while (cursor <= last) {
    const start = startOfDay(cursor);
    const end = endOfDay(
      new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
    );
    const key = formatMonthKey(start);
    buckets.push({ key, label: key, start, end });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  return buckets;
}

function bucketKeyForDate(date: Date, interval: Interval): string {
  if (interval === "day") return formatDateKey(date);
  if (interval === "week") return formatDateKey(startOfWeek(date));
  return formatMonthKey(date);
}

function rollupDailySeries(
  dailyMap: Map<string, number>,
  interval: Interval,
  buckets: Bucket[]
) {
  const bucketTotals = new Map<string, number>();

  for (const [dayKey, value] of dailyMap.entries()) {
    const date = new Date(`${dayKey}T00:00:00`);
    const bucketKey = bucketKeyForDate(date, interval);
    bucketTotals.set(bucketKey, (bucketTotals.get(bucketKey) ?? 0) + value);
  }

  return buckets.map((bucket) => ({
    label: bucket.label,
    value: bucketTotals.get(bucket.key) ?? 0,
  }));
}

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function parseDate(input: string | null): Date | null {
  if (!input) return null;
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function resolveInterval(days: number, raw: string | null): Interval {
  if (raw === "day" || raw === "week" || raw === "month") {
    return raw;
  }
  if (days <= 45) return "day";
  if (days <= 140) return "week";
  return "month";
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

  const { startDate, endDate, period, periodIdObj, source } = range;
  const rangeDays = Math.max(
    1,
    Math.floor((endDate.getTime() - startDate.getTime()) / DAY_MS) + 1
  );
  const interval = resolveInterval(rangeDays, searchParams.get("interval"));
  const buckets = buildBuckets(startDate, endDate, interval);

  const dailyPaymentsPromise = Payment.aggregate([
    {
      $match: {
        schoolId: schoolIdObj,
        status: "completed",
        paymentDate: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$paymentDate" },
        },
        total: { $sum: "$amountMinor" },
      },
    },
  ]);

  const paymentMethodsPromise = Payment.aggregate([
    {
      $match: {
        schoolId: schoolIdObj,
        status: "completed",
        paymentDate: { $gte: startDate, $lte: endDate },
      },
    },
    { $group: { _id: "$paymentMethod", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const invoiceStatusPromise = Invoice.aggregate([
    { $match: { schoolId: schoolIdObj } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const enrollmentPromise = Student.aggregate([
    {
      $match: {
        schoolId: schoolIdObj,
        $or: [
          { enrolledAt: { $gte: startDate, $lte: endDate } },
          { enrolledAt: null, createdAt: { $gte: startDate, $lte: endDate } },
        ],
      },
    },
    {
      $project: {
        effectiveDate: { $ifNull: ["$enrolledAt", "$createdAt"] },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$effectiveDate" },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const studentStatusPromise = Student.aggregate([
    { $match: { schoolId: schoolIdObj } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const gradeDistributionPromise = Student.aggregate([
    { $match: { schoolId: schoolIdObj } },
    { $group: { _id: "$gradeId", count: { $sum: 1 } } },
  ]);

  const teacherStatusPromise = Teacher.aggregate([
    { $match: { schoolId: schoolIdObj } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const teacherDepartmentPromise = Teacher.aggregate([
    { $match: { schoolId: schoolIdObj } },
    {
      $group: {
        _id: { $ifNull: ["$department", "Unassigned"] },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 8 },
  ]);

  const assignmentPromise = TeacherAssignment.aggregate([
    {
      $match: periodIdObj
        ? {
            schoolId: schoolIdObj,
            academicPeriodId: periodIdObj,
            status: "active",
          }
        : {
            schoolId: schoolIdObj,
            status: "active",
            assignedAt: { $gte: startDate, $lte: endDate },
          },
    },
    { $group: { _id: "$subjectId", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 8 },
  ]);

  const attendanceDailyPromise = TeacherAttendance.aggregate([
    {
      $match: {
        schoolId: schoolIdObj,
        date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          status: "$status",
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const invitationSentPromise = Invitation.aggregate([
    {
      $match: {
        schoolId: schoolIdObj,
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
  ]);

  const invitationStatusPromise = Invitation.aggregate([
    { $match: { schoolId: schoolIdObj } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const invitationRolePromise = Invitation.aggregate([
    { $match: { schoolId: schoolIdObj } },
    { $group: { _id: "$role", count: { $sum: 1 } } },
  ]);

  const activityDailyPromise = Activity.aggregate([
    {
      $match: {
        schoolId: schoolIdObj,
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
  ]);

  const activityTypePromise = Activity.aggregate([
    {
      $match: {
        schoolId: schoolIdObj,
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    { $group: { _id: "$type", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 8 },
  ]);

  const subjectGradesPromise = SubjectGrade.aggregate([
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
        _id: "$subjectId",
        avgScore: { $avg: "$totalScore" },
        passRate: { $avg: { $cond: ["$isPassed", 1, 0] } },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 8 },
  ]);

  const passRatePromise = SubjectGrade.aggregate([
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
    { $group: { _id: "$isPassed", count: { $sum: 1 } } },
  ]);

  const [
    dailyPayments,
    paymentMethodsAgg,
    invoiceStatusAgg,
    enrollmentAgg,
    studentStatusAgg,
    gradeDistributionAgg,
    teacherStatusAgg,
    teacherDepartmentAgg,
    assignmentAgg,
    attendanceDailyAgg,
    invitationSentAgg,
    invitationStatusAgg,
    invitationRoleAgg,
    activityDailyAgg,
    activityTypeAgg,
    subjectGradesAgg,
    passRateAgg,
  ] = await Promise.all([
    dailyPaymentsPromise,
    paymentMethodsPromise,
    invoiceStatusPromise,
    enrollmentPromise,
    studentStatusPromise,
    gradeDistributionPromise,
    teacherStatusPromise,
    teacherDepartmentPromise,
    assignmentPromise,
    attendanceDailyPromise,
    invitationSentPromise,
    invitationStatusPromise,
    invitationRolePromise,
    activityDailyPromise,
    activityTypePromise,
    subjectGradesPromise,
    passRatePromise,
  ]);

  const paymentDailyMap = new Map<string, number>();
  for (const row of dailyPayments) {
    paymentDailyMap.set(row._id as string, row.total ?? 0);
  }

  const enrollmentDailyMap = new Map<string, number>();
  for (const row of enrollmentAgg) {
    enrollmentDailyMap.set(row._id as string, row.count ?? 0);
  }

  const invitationDailyMap = new Map<string, number>();
  for (const row of invitationSentAgg) {
    invitationDailyMap.set(row._id as string, row.count ?? 0);
  }

  const activityDailyMap = new Map<string, number>();
  for (const row of activityDailyAgg) {
    activityDailyMap.set(row._id as string, row.count ?? 0);
  }

  const attendanceDailyMap = new Map<string, AttendanceCounts>();

  for (const row of attendanceDailyAgg) {
    const key = row._id.date as string;
    const status = String(row._id.status) as AttendanceStatus;
    const entry: AttendanceCounts = attendanceDailyMap.get(key) ?? {
      total: 0,
      present: 0,
      late: 0,
      absent: 0,
      on_leave: 0,
      sick: 0,
      other: 0,
    };
    const next = { ...entry };
    if (status in next) {
      next[status] = (next[status] ?? 0) + (row.count ?? 0);
    }
    next.total += row.count ?? 0;
    attendanceDailyMap.set(key, next);
  }

  const attendanceBucketTotals = new Map<string, AttendanceCounts>();

  for (const [dayKey, entry] of attendanceDailyMap.entries()) {
    const date = new Date(`${dayKey}T00:00:00`);
    const bucketKey = bucketKeyForDate(date, interval);
    const current: AttendanceCounts =
      attendanceBucketTotals.get(bucketKey) ?? {
        total: 0,
        present: 0,
        late: 0,
        absent: 0,
        on_leave: 0,
        sick: 0,
        other: 0,
      };
    attendanceBucketTotals.set(bucketKey, {
      total: current.total + entry.total,
      present: current.present + entry.present,
      late: current.late + entry.late,
      absent: current.absent + entry.absent,
      on_leave: current.on_leave + entry.on_leave,
      sick: current.sick + entry.sick,
      other: current.other + entry.other,
    });
  }

  const attendanceTrend = buckets.map((bucket) => {
    const totals = attendanceBucketTotals.get(bucket.key) ?? {
      total: 0,
      present: 0,
      late: 0,
      absent: 0,
      on_leave: 0,
      sick: 0,
      other: 0,
    };
    const presentTotal = totals.present + totals.late;
    const presentRate =
      totals.total > 0 ? (presentTotal / totals.total) * 100 : 0;
    return {
      label: bucket.label,
      presentRate: roundTo(presentRate, 1),
      present: presentTotal,
      absent: totals.absent,
      total: totals.total,
    };
  });

  const paymentMethods = paymentMethodsAgg.map((row) => ({
    label: String(row._id),
    value: row.count ?? 0,
  }));

  const invoiceStatusCounts: Record<string, number> = {
    draft: 0,
    issued: 0,
    partially_paid: 0,
    paid: 0,
    overdue: 0,
    cancelled: 0,
  };

  for (const row of invoiceStatusAgg) {
    const key = String(row._id);
    if (key in invoiceStatusCounts) {
      invoiceStatusCounts[key] = row.count ?? 0;
    }
  }

  const invoiceStatus = Object.entries(invoiceStatusCounts).map(
    ([label, value]) => ({ label, value })
  );

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
  const studentStatus = Object.entries(studentStatusCounts).map(
    ([label, value]) => ({ label, value })
  );

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
  const teacherStatus = Object.entries(teacherStatusCounts).map(
    ([label, value]) => ({ label, value })
  );

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
  const invitationStatus = Object.entries(invitationStatusCounts).map(
    ([label, value]) => ({ label, value })
  );

  const invitationRoleCounts = {
    teacher: 0,
    staff: 0,
    school_admin: 0,
  };
  for (const row of invitationRoleAgg) {
    const key = String(row._id) as keyof typeof invitationRoleCounts;
    if (key in invitationRoleCounts) {
      invitationRoleCounts[key] = row.count ?? 0;
    }
  }
  const invitationRoles = Object.entries(invitationRoleCounts).map(
    ([label, value]) => ({ label, value })
  );

  const attendanceStatusCounts = {
    present: 0,
    absent: 0,
    late: 0,
    on_leave: 0,
    sick: 0,
    other: 0,
  };
  for (const row of attendanceDailyAgg) {
    const key = String(row._id.status) as keyof typeof attendanceStatusCounts;
    if (key in attendanceStatusCounts) {
      attendanceStatusCounts[key] += row.count ?? 0;
    }
  }
  const attendanceStatus = Object.entries(attendanceStatusCounts).map(
    ([label, value]) => ({ label, value })
  );

  const gradeIds = gradeDistributionAgg
    .map((row) => row._id)
    .filter(Boolean) as mongoose.Types.ObjectId[];

  const grades = gradeIds.length
    ? await Grade.find({ _id: { $in: gradeIds } }).lean()
    : [];

  const gradeMap = new Map<string, string>();
  for (const grade of grades) {
    gradeMap.set(String(grade._id), grade.name);
  }

  const gradeDistribution = gradeDistributionAgg.map((row) => ({
    label: gradeMap.get(String(row._id)) ?? "Unassigned",
    value: row.count ?? 0,
    gradeId: row._id ? String(row._id) : null,
  }));

  const subjectIds = new Set<string>();
  for (const row of assignmentAgg) {
    if (row._id) subjectIds.add(String(row._id));
  }
  for (const row of subjectGradesAgg) {
    if (row._id) subjectIds.add(String(row._id));
  }

  const subjects = subjectIds.size
    ? await Subject.find({ _id: { $in: Array.from(subjectIds) } }).lean()
    : [];

  const subjectMap = new Map<string, string>();
  for (const subject of subjects) {
    subjectMap.set(String(subject._id), subject.name);
  }

  const assignmentsBySubject = assignmentAgg.map((row) => ({
    label: subjectMap.get(String(row._id)) ?? "Unknown",
    value: row.count ?? 0,
    subjectId: row._id ? String(row._id) : null,
  }));

  const averageBySubject = subjectGradesAgg.map((row) => ({
    label: subjectMap.get(String(row._id)) ?? "Unknown",
    value: roundTo(row.avgScore ?? 0, 1),
    passRate: roundTo((row.passRate ?? 0) * 100, 1),
    subjectId: row._id ? String(row._id) : null,
    count: row.count ?? 0,
  }));

  let passed = 0;
  let failed = 0;
  for (const row of passRateAgg) {
    if (row._id === true) passed = row.count ?? 0;
    if (row._id === false) failed = row.count ?? 0;
  }
  const passRateDistribution = [
    { label: "Passed", value: passed },
    { label: "Failed", value: failed },
  ];

  const activityTopTypes = activityTypeAgg.map((row) => ({
    label: String(row._id),
    value: row.count ?? 0,
  }));

  const revenueTrend = rollupDailySeries(
    paymentDailyMap,
    interval,
    buckets
  );
  const enrollmentTrend = rollupDailySeries(
    enrollmentDailyMap,
    interval,
    buckets
  );
  const invitationsTrend = rollupDailySeries(
    invitationDailyMap,
    interval,
    buckets
  );
  const activityTrend = rollupDailySeries(
    activityDailyMap,
    interval,
    buckets
  );

  return NextResponse.json({
    range: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      days: rangeDays,
      source,
      period,
    },
    interval,
    charts: {
      fees: {
        revenueTrend: {
          interval,
          points: revenueTrend,
        },
        paymentMethods,
        invoiceStatus,
      },
      students: {
        enrollmentTrend: {
          interval,
          points: enrollmentTrend,
        },
        gradeDistribution,
        statusDistribution: studentStatus,
      },
      teachers: {
        statusDistribution: teacherStatus,
        departmentDistribution: teacherDepartmentAgg.map((row) => ({
          label: String(row._id),
          value: row.count ?? 0,
        })),
        assignmentsBySubject,
      },
      attendance: {
        attendanceTrend: {
          interval,
          points: attendanceTrend,
        },
        statusDistribution: attendanceStatus,
      },
      invitations: {
        sentTrend: {
          interval,
          points: invitationsTrend,
        },
        statusDistribution: invitationStatus,
        roleDistribution: invitationRoles,
      },
      academics: {
        averageBySubject,
        passRateDistribution,
        scope: periodIdObj ? "period" : "range",
      },
      activity: {
        volumeTrend: {
          interval,
          points: activityTrend,
        },
        topTypes: activityTopTypes,
      },
    },
  });
}
