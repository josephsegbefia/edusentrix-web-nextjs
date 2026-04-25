import "server-only";
import mongoose, { type Types } from "mongoose";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Activity } from "@/models/Activity";
import { Invitation } from "@/models/Invitation";
import { Invoice } from "@/models/Invoice";
import { Payment } from "@/models/Payment";
import { Student } from "@/models/Student";
import { SubjectGrade } from "@/models/SubjectGrade";
import { Teacher } from "@/models/Teacher";
import { TeacherAttendance } from "@/models/TeacherAttendance";
import type { LeoAssistantDraft } from "@/lib/leo/types";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function daysBetween(startDate: Date, endDate: Date) {
  return Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / DAY_MS) + 1);
}

function formatMoney(minor: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  }).format(Number(minor || 0) / 100);
}

async function resolveCurrentReportRange(schoolId: Types.ObjectId) {
  const period = await AcademicPeriod.findOne({ schoolId, isCurrent: true })
    .select("_id yearLabel term startDate endDate")
    .lean<{
      _id: Types.ObjectId;
      yearLabel: string;
      term: string;
      startDate: Date;
      endDate: Date;
    } | null>();

  if (period) {
    return {
      startDate: startOfDay(new Date(period.startDate)),
      endDate: endOfDay(new Date(period.endDate)),
      label: `${period.term} ${period.yearLabel}`,
      periodId: period._id,
      source: "current academic period",
    };
  }

  const endDate = endOfDay(new Date());
  const startDate = startOfDay(new Date(endDate.getTime() - 89 * DAY_MS));
  return {
    startDate,
    endDate,
    label: "the last 90 days",
    periodId: null,
    source: "default range",
  };
}

function countByStatus(rows: Array<{ _id: unknown; count?: number }>, keys: string[]) {
  const output = Object.fromEntries(keys.map((key) => [key, 0])) as Record<string, number>;
  for (const row of rows) {
    const key = String(row._id);
    if (key in output) output[key] = row.count || 0;
  }
  return output;
}

export async function runReportBriefTool(args: {
  schoolId: Types.ObjectId;
}): Promise<LeoAssistantDraft> {
  const range = await resolveCurrentReportRange(args.schoolId);
  const rangeDays = daysBetween(range.startDate, range.endDate);

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
    Payment.aggregate([
      {
        $match: {
          schoolId: args.schoolId,
          status: "completed",
          paymentDate: { $gte: range.startDate, $lte: range.endDate },
        },
      },
      { $group: { _id: null, total: { $sum: "$amountMinor" }, count: { $sum: 1 } } },
    ]),
    Invoice.aggregate([
      {
        $match: {
          schoolId: args.schoolId,
          status: { $ne: "draft" },
          $or: [
            { issueDate: { $gte: range.startDate, $lte: range.endDate } },
            { issueDate: null, createdAt: { $gte: range.startDate, $lte: range.endDate } },
          ],
        },
      },
      { $group: { _id: null, total: { $sum: "$totalAmountMinor" }, count: { $sum: 1 } } },
    ]),
    Invoice.aggregate([
      {
        $match: {
          schoolId: args.schoolId,
          status: { $in: ["issued", "partially_paid", "overdue"] },
        },
      },
      { $group: { _id: null, total: { $sum: "$totalOutstandingMinor" } } },
    ]),
    Invoice.countDocuments({ schoolId: args.schoolId, status: "overdue" }),
    Student.countDocuments({ schoolId: args.schoolId }),
    Student.countDocuments({
      schoolId: args.schoolId,
      $or: [
        { enrolledAt: { $gte: range.startDate, $lte: range.endDate } },
        { enrolledAt: null, createdAt: { $gte: range.startDate, $lte: range.endDate } },
      ],
    }),
    Student.aggregate([
      { $match: { schoolId: args.schoolId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Teacher.aggregate([
      { $match: { schoolId: args.schoolId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Teacher.countDocuments({
      schoolId: args.schoolId,
      homeroomClassGroupId: { $ne: null },
      status: "active",
    }),
    TeacherAttendance.aggregate([
      {
        $match: {
          schoolId: args.schoolId,
          date: { $gte: range.startDate, $lte: range.endDate },
        },
      },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Invitation.aggregate([
      { $match: { schoolId: args.schoolId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Invitation.countDocuments({
      schoolId: args.schoolId,
      createdAt: { $gte: range.startDate, $lte: range.endDate },
    }),
    Activity.countDocuments({
      schoolId: args.schoolId,
      createdAt: { $gte: range.startDate, $lte: range.endDate },
    }),
    Activity.countDocuments({
      schoolId: args.schoolId,
      type: "report.generated",
      createdAt: { $gte: range.startDate, $lte: range.endDate },
    }),
    SubjectGrade.aggregate([
      {
        $match: range.periodId
          ? { schoolId: args.schoolId, academicPeriodId: range.periodId }
          : {
              schoolId: args.schoolId,
              lastUpdated: { $gte: range.startDate, $lte: range.endDate },
            },
      },
      {
        $group: {
          _id: null,
          avgScore: { $avg: "$totalScore" },
          passRate: { $avg: { $cond: ["$isPassed", 1, 0] } },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const revenueMinor = paymentsAgg[0]?.total || 0;
  const paymentsCount = paymentsAgg[0]?.count || 0;
  const billedMinor = billedAgg[0]?.total || 0;
  const invoiceCount = billedAgg[0]?.count || 0;
  const outstandingMinor = outstandingAgg[0]?.total || 0;
  const collectionRate = billedMinor > 0 ? Math.round((revenueMinor / billedMinor) * 10000) / 100 : 0;

  const studentStatus = countByStatus(studentStatusAgg, ["active", "inactive", "withdrawn"]);
  const teacherStatus = countByStatus(teacherStatusAgg, [
    "active",
    "inactive",
    "on_leave",
    "terminated",
  ]);
  const attendanceStatus = countByStatus(attendanceAgg, [
    "present",
    "absent",
    "late",
    "on_leave",
    "sick",
    "other",
  ]);
  const invitationStatus = countByStatus(invitationStatusAgg, [
    "pending",
    "accepted",
    "expired",
    "revoked",
    "failed",
  ]);

  const teachersTotal = Object.values(teacherStatus).reduce((sum, value) => sum + value, 0);
  const attendanceTotal = Object.values(attendanceStatus).reduce((sum, value) => sum + value, 0);
  const attendanceCoverage =
    teachersTotal > 0 && rangeDays > 0
      ? Math.round((attendanceTotal / (teachersTotal * rangeDays)) * 10000) / 100
      : 0;
  const presentRate =
    attendanceTotal > 0
      ? Math.round(((attendanceStatus.present + attendanceStatus.late) / attendanceTotal) * 10000) /
        100
      : 0;

  const academics = academicsAgg[0] || { avgScore: 0, passRate: 0, count: 0 };
  const avgScore = Math.round(Number(academics.avgScore || 0) * 10) / 10;
  const passRate = Math.round(Number(academics.passRate || 0) * 1000) / 10;

  const lines = [
    `Report brief for ${range.label} (${range.source}).`,
    `Fees: ${formatMoney(revenueMinor)} collected from ${paymentsCount} payment${paymentsCount === 1 ? "" : "s"}; ${formatMoney(billedMinor)} billed across ${invoiceCount} invoice${invoiceCount === 1 ? "" : "s"}; collection rate ${collectionRate}%.`,
    `Outstanding exposure: ${formatMoney(outstandingMinor)} outstanding with ${overdueCount} overdue invoice${overdueCount === 1 ? "" : "s"}.`,
    `Students: ${studentsTotal} total, ${studentsNew} new in range, ${studentStatus.active} active.`,
    `Teachers: ${teachersTotal} total, ${teacherStatus.active} active, ${teacherStatus.on_leave} on leave, ${homeroomCount} active homeroom assignment${homeroomCount === 1 ? "" : "s"}.`,
    `Staff attendance: ${attendanceTotal} records, ${attendanceCoverage}% coverage, ${presentRate}% present/late rate.`,
    `Academics: ${academics.count || 0} grade record${academics.count === 1 ? "" : "s"}, average score ${avgScore}, pass rate ${passRate}%.`,
    `Engagement: ${activityCount} activity event${activityCount === 1 ? "" : "s"}, ${reportsGenerated} report generation event${reportsGenerated === 1 ? "" : "s"}, ${invitationsInRange} invitation${invitationsInRange === 1 ? "" : "s"} sent in range.`,
  ];

  const pendingInvitations = invitationStatus.pending || 0;
  if (pendingInvitations > 0 || overdueCount > 0 || attendanceCoverage < 50) {
    lines.push("", "Review flags:");
    if (overdueCount > 0) lines.push(`- Finance has ${overdueCount} overdue invoice${overdueCount === 1 ? "" : "s"} to follow up.`);
    if (attendanceCoverage < 50) lines.push("- Staff attendance coverage is low for this range.");
    if (pendingInvitations > 0) lines.push(`- ${pendingInvitations} staff or guardian invitation${pendingInvitations === 1 ? "" : "s"} still pending.`);
  }

  return {
    contentText: lines.join("\n"),
    citations: [
      { type: "record", label: "Reports summary", ref: "src/app/api/admin/reports/summary/route.ts" },
      { type: "route", label: "Reports", ref: "/admin/reports" },
    ],
    toolsUsed: ["report_brief"],
  };
}
