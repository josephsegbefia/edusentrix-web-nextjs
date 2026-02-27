import mongoose from "mongoose";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Invoice } from "@/models/Invoice";
import { Assessment } from "@/models/Assessment";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { TimetableVersion } from "@/models/TimetableVersion";
import { StudentClassRole } from "@/models/StudentClassRole";
import { Payment } from "@/models/Payment";
import { TermResult } from "@/models/TermResult";
import { StudentAttendance } from "@/models/StudentAttendance";

export type PeriodReportContext = {
  period: {
    yearLabel: string;
    term: string;
    startDate: string;
    endDate: string;
  };
  finances: {
    invoiceCount: number;
    paidInvoiceCount: number;
    overdueInvoiceCount: number;
    totalBilledMinor: number;
    totalCollectedMinor: number;
    collectionRatePct: number;
  };
  academics: {
    assessmentCount: number;
    termResultCount: number;
    studentCountWithResults: number;
  };
  staffing: {
    teacherAssignmentCount: number;
    studentRoleCount: number;
  };
  timetable: {
    versionCount: number;
    hasPublished: boolean;
  };
  attendance?: {
    recordCount: number;
    presentCount: number;
    absentCount: number;
  };
};

export async function buildPeriodReportContext(
  schoolId: mongoose.Types.ObjectId,
  periodId: mongoose.Types.ObjectId
): Promise<PeriodReportContext | null> {
  const period = await AcademicPeriod.findOne({
    _id: periodId,
    schoolId,
  }).lean();

  if (!period) return null;

  const [
    invoiceStats,
    paymentAgg,
    assessmentCount,
    termResultStats,
    teacherAssignmentCount,
    studentRoleCount,
    timetableStats,
    attendanceStats,
  ] = await Promise.all([
    Invoice.aggregate([
      {
        $match: {
          schoolId,
          academicPeriodId: periodId,
          status: { $ne: "cancelled" },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalBilledMinor: { $sum: "$totalAmountMinor" },
          paidCount: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] } },
          overdueCount: {
            $sum: { $cond: [{ $eq: ["$status", "overdue"] }, 1, 0] },
          },
        },
      },
    ]),
    Payment.aggregate([
      {
        $match: { schoolId, status: "completed" },
      },
      { $lookup: { from: "invoices", localField: "invoiceId", foreignField: "_id", as: "inv" } },
      { $unwind: "$inv" },
      { $match: { "inv.academicPeriodId": periodId } },
      { $group: { _id: null, total: { $sum: "$amountMinor" } } },
    ]),
    Assessment.countDocuments({ schoolId, academicPeriodId: periodId }),
    TermResult.aggregate([
      { $match: { schoolId, academicPeriodId: periodId } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          studentCount: { $addToSet: "$studentId" },
        },
      },
    ]),
    TeacherAssignment.countDocuments({
      schoolId,
      academicPeriodId: periodId,
      status: "active",
    }),
    StudentClassRole.countDocuments({ schoolId, academicPeriodId: periodId }),
    TimetableVersion.aggregate([
      { $match: { schoolId, academicPeriodId: periodId } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          hasPublished: { $max: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] } },
        },
      },
    ]),
    StudentAttendance.aggregate([
      { $match: { schoolId, academicPeriodId: periodId } },
      {
        $group: {
          _id: null,
          recordCount: { $sum: 1 },
          presentCount: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
          absentCount: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const inv = invoiceStats[0];
  const totalBilledMinor = inv?.totalBilledMinor ?? 0;
  const totalCollectedMinor = paymentAgg[0]?.total ?? 0;
  const collectionRatePct =
    totalBilledMinor > 0 ? Math.round((totalCollectedMinor / totalBilledMinor) * 100) : 0;

  const tr = termResultStats[0];
  const studentCountWithResults = tr?.studentCount
    ? (Array.isArray(tr.studentCount) ? tr.studentCount.length : 0)
    : 0;

  const tt = timetableStats[0];
  const att = attendanceStats[0];

  return {
    period: {
      yearLabel: period.yearLabel,
      term: period.term,
      startDate: String(period.startDate),
      endDate: String(period.endDate),
    },
    finances: {
      invoiceCount: inv?.count ?? 0,
      paidInvoiceCount: inv?.paidCount ?? 0,
      overdueInvoiceCount: inv?.overdueCount ?? 0,
      totalBilledMinor,
      totalCollectedMinor,
      collectionRatePct,
    },
    academics: {
      assessmentCount,
      termResultCount: tr?.count ?? 0,
      studentCountWithResults,
    },
    staffing: {
      teacherAssignmentCount,
      studentRoleCount,
    },
    timetable: {
      versionCount: tt?.count ?? 0,
      hasPublished: (tt?.hasPublished ?? 0) > 0,
    },
    attendance: att
      ? {
          recordCount: att.recordCount ?? 0,
          presentCount: att.presentCount ?? 0,
          absentCount: att.absentCount ?? 0,
        }
      : undefined,
  };
}

export type DateRangeReportContext = Omit<PeriodReportContext, "period"> & {
  period: {
    yearLabel: string;
    term: string;
    startDate: string;
    endDate: string;
    label: string;
  };
};

export async function buildReportContextForDateRange(
  schoolId: mongoose.Types.ObjectId,
  periodId: mongoose.Types.ObjectId,
  startDate: Date,
  endDate: Date
): Promise<DateRangeReportContext | null> {
  const period = await AcademicPeriod.findOne({
    _id: periodId,
    schoolId,
  }).lean();

  if (!period) return null;

  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const [
    invoiceStats,
    paymentAgg,
    assessmentCount,
    termResultStats,
    teacherAssignmentCount,
    studentRoleCount,
    timetableStats,
    attendanceStats,
  ] = await Promise.all([
    Invoice.aggregate([
      {
        $match: {
          schoolId,
          academicPeriodId: periodId,
          status: { $ne: "cancelled" },
          $or: [
            { issueDate: { $gte: start, $lte: end } },
            { issueDate: null, createdAt: { $gte: start, $lte: end } },
          ],
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalBilledMinor: { $sum: "$totalAmountMinor" },
          paidCount: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] } },
          overdueCount: {
            $sum: { $cond: [{ $eq: ["$status", "overdue"] }, 1, 0] },
          },
        },
      },
    ]),
    Payment.aggregate([
      {
        $match: {
          schoolId,
          status: "completed",
          paymentDate: { $gte: start, $lte: end },
        },
      },
      { $lookup: { from: "invoices", localField: "invoiceId", foreignField: "_id", as: "inv" } },
      { $unwind: "$inv" },
      { $match: { "inv.academicPeriodId": periodId } },
      { $group: { _id: null, total: { $sum: "$amountMinor" } } },
    ]),
    Assessment.countDocuments({
      schoolId,
      academicPeriodId: periodId,
      gradedAt: { $ne: null, $gte: start, $lte: end },
    }),
    TermResult.aggregate([
      {
        $match: {
          schoolId,
          academicPeriodId: periodId,
          $or: [
            { createdAt: { $gte: start, $lte: end } },
            { updatedAt: { $gte: start, $lte: end } },
          ],
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          studentCount: { $addToSet: "$studentId" },
        },
      },
    ]),
    TeacherAssignment.countDocuments({
      schoolId,
      academicPeriodId: periodId,
      status: "active",
    }),
    StudentClassRole.countDocuments({ schoolId, academicPeriodId: periodId }),
    TimetableVersion.aggregate([
      { $match: { schoolId, academicPeriodId: periodId } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          hasPublished: { $max: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] } },
        },
      },
    ]),
    StudentAttendance.aggregate([
      {
        $match: {
          schoolId,
          academicPeriodId: periodId,
          date: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          recordCount: { $sum: 1 },
          presentCount: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
          absentCount: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const inv = invoiceStats[0];
  const totalBilledMinor = inv?.totalBilledMinor ?? 0;
  const totalCollectedMinor = paymentAgg[0]?.total ?? 0;
  const collectionRatePct =
    totalBilledMinor > 0 ? Math.round((totalCollectedMinor / totalBilledMinor) * 100) : 0;

  const tr = termResultStats[0];
  const studentCountWithResults = tr?.studentCount
    ? (Array.isArray(tr.studentCount) ? tr.studentCount.length : 0)
    : 0;

  const tt = timetableStats[0];
  const att = attendanceStats[0];

  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);
  const label = `${period.term} ${period.yearLabel} (${startStr} to ${endStr})`;

  return {
    period: {
      yearLabel: period.yearLabel,
      term: period.term,
      startDate: startStr,
      endDate: endStr,
      label,
    },
    finances: {
      invoiceCount: inv?.count ?? 0,
      paidInvoiceCount: inv?.paidCount ?? 0,
      overdueInvoiceCount: inv?.overdueCount ?? 0,
      totalBilledMinor,
      totalCollectedMinor,
      collectionRatePct,
    },
    academics: {
      assessmentCount,
      termResultCount: tr?.count ?? 0,
      studentCountWithResults,
    },
    staffing: {
      teacherAssignmentCount,
      studentRoleCount,
    },
    timetable: {
      versionCount: tt?.count ?? 0,
      hasPublished: (tt?.hasPublished ?? 0) > 0,
    },
    attendance: att
      ? {
          recordCount: att.recordCount ?? 0,
          presentCount: att.presentCount ?? 0,
          absentCount: att.absentCount ?? 0,
        }
      : undefined,
  };
}
