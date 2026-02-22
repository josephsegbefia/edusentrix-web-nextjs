/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from "mongoose";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { TermResult } from "@/models/TermResult";
import { SubjectGrade } from "@/models/SubjectGrade";
import { StudentAttendance } from "@/models/StudentAttendance";
import { Invoice } from "@/models/Invoice";
import { Payment } from "@/models/Payment";
import { TeacherComment } from "@/models/TeacherComment";
import { Student } from "@/models/Student";
import { calculateTrend } from "@/lib/academics/calculateGrades";
import { calculateRiskLevel } from "@/lib/academics/calculateRiskLevel";
import { calculateClassAverages } from "@/lib/academics/calculateClassAverages";
import type { IRuleBasedInsights } from "@/models/AIInsightCache";

type IdLike = string | mongoose.Types.ObjectId;

function toOid(id: IdLike): mongoose.Types.ObjectId {
  return id instanceof mongoose.Types.ObjectId
    ? id
    : new mongoose.Types.ObjectId(String(id));
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export interface StudentInsightsDTO {
  studentId: string;
  studentName: string;
  gradeName: string | null;
  classGroupName: string | null;
  currentPeriodId: string | null;
  currentPeriodLabel: string | null;
  ruleBased: IRuleBasedInsights;
  subjectDetails: Array<{
    subjectName: string;
    totalScore: number;
    caPercentage: number;
    examPercentage: number;
    classAvg: number | null;
  }>;
  termHistory: Array<{
    label: string;
    averageScore: number | null;
    classAverage: number | null;
  }>;
  recentComments: Array<{
    comment: string;
    teacherName: string | null;
    type: string;
    date: string;
  }>;
  feesDetail: {
    totalBilledMinor: number;
    totalPaidMinor: number;
    outstandingMinor: number;
    currency: string;
  } | null;
}

export async function buildStudentInsightsDTO(params: {
  schoolId: IdLike;
  studentId: IdLike;
  periodId?: IdLike | null;
}): Promise<StudentInsightsDTO> {
  const schoolOid = toOid(params.schoolId);
  const studentOid = toOid(params.studentId);

  // ── Resolve student info ──
  const student = (await Student.findOne({
    _id: studentOid,
    schoolId: schoolOid,
  })
    .select("firstName lastName classGroupId gradeId")
    .populate("classGroupId", "name")
    .populate("gradeId", "name")
    .lean()) as any;

  const studentName = student
    ? `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim()
    : "Unknown";
  const classGroupName = student?.classGroupId?.name ?? null;
  const gradeName = student?.gradeId?.name ?? null;
  const classGroupId = student?.classGroupId?._id ?? student?.classGroupId;

  // ── Resolve academic period ──
  let period: any = null;
  if (params.periodId) {
    period = await AcademicPeriod.findOne({
      _id: toOid(params.periodId),
      schoolId: schoolOid,
    }).lean();
  }
  if (!period) {
    period = await AcademicPeriod.findOne({
      schoolId: schoolOid,
      isCurrent: true,
    }).lean();
  }
  if (!period) {
    period = await AcademicPeriod.findOne({ schoolId: schoolOid })
      .sort({ endDate: -1 })
      .lean();
  }

  const periodId = period?._id?.toString() ?? null;
  const periodLabel = period
    ? `${period.yearLabel} – ${period.term}`
    : null;

  // ── Academic: TermResults (current + previous) ──
  const allTermResults = (await TermResult.find({
    schoolId: schoolOid,
    studentId: studentOid,
  })
    .sort({ calculatedAt: 1 })
    .populate("academicPeriodId", "yearLabel term")
    .lean()) as any[];

  const currentResult = periodId
    ? allTermResults.find(
        (tr) => (tr.academicPeriodId?._id ?? tr.academicPeriodId)?.toString() === periodId
      )
    : allTermResults[allTermResults.length - 1] ?? null;

  const currentIdx = currentResult
    ? allTermResults.indexOf(currentResult)
    : -1;
  const prevResult = currentIdx > 0 ? allTermResults[currentIdx - 1] : null;

  const overallAvg = currentResult?.averageScore ?? null;
  const prevAvg = prevResult?.averageScore ?? null;
  const trend = calculateTrend(overallAvg, prevAvg);
  const trendDelta =
    overallAvg != null && prevAvg != null
      ? Number((overallAvg - prevAvg).toFixed(2))
      : null;

  const classPosition = currentResult?.classPosition ?? null;
  const classSize = currentResult?.totalStudents ?? null;
  const prevPosition = prevResult?.classPosition ?? null;
  const positionMovement =
    prevPosition != null && classPosition != null
      ? prevPosition - classPosition
      : null;

  // ── Subject grades for current period ──
  let subjectGrades: any[] = [];
  if (periodId) {
    subjectGrades = (await SubjectGrade.find({
      schoolId: schoolOid,
      studentId: studentOid,
      academicPeriodId: periodId,
    })
      .populate("subjectId", "name")
      .lean()) as any[];
  }

  // Class averages
  let classAvgMap: Record<string, number> = {};
  if (periodId && classGroupId) {
    try {
      classAvgMap = await calculateClassAverages({
        schoolId: params.schoolId,
        classGroupId,
        academicPeriodId: periodId,
      });
    } catch {
      /* continue without class averages */
    }
  }

  const subjectDetails = subjectGrades.map((sg: any) => {
    const subId =
      sg.subjectId?._id?.toString() ?? sg.subjectId?.toString() ?? "";
    return {
      subjectName: sg.subjectId?.name ?? "Unknown",
      totalScore: sg.totalScore ?? 0,
      caPercentage: sg.caPercentage ?? 0,
      examPercentage: sg.examPercentage ?? 0,
      classAvg: classAvgMap[subId] ?? null,
    };
  });

  const sorted = [...subjectDetails].sort(
    (a, b) => b.totalScore - a.totalScore
  );
  const strengths = sorted.slice(0, 3).map((s) => ({
    subject: s.subjectName,
    score: s.totalScore,
    classAvg: s.classAvg,
  }));
  const weaknesses = sorted
    .slice(-3)
    .reverse()
    .map((s) => ({
      subject: s.subjectName,
      score: s.totalScore,
      classAvg: s.classAvg,
    }));

  // CA vs Exam gap
  const caScores = subjectDetails
    .filter((s) => s.caPercentage > 0)
    .map((s) => s.caPercentage);
  const examScores = subjectDetails
    .filter((s) => s.examPercentage > 0)
    .map((s) => s.examPercentage);
  const avgCA =
    caScores.length > 0
      ? caScores.reduce((a, b) => a + b, 0) / caScores.length
      : null;
  const avgExam =
    examScores.length > 0
      ? examScores.reduce((a, b) => a + b, 0) / examScores.length
      : null;
  const caVsExamGap =
    avgCA != null && avgExam != null
      ? Number((avgCA - avgExam).toFixed(1))
      : null;

  // Risk level
  const weakSubjectsCount = subjectDetails.filter(
    (s) => s.totalScore < 60
  ).length;
  let consecutiveDeclines = 0;
  for (let i = allTermResults.length - 1; i > 0; i--) {
    if (
      allTermResults[i].averageScore != null &&
      allTermResults[i - 1].averageScore != null &&
      allTermResults[i].averageScore < allTermResults[i - 1].averageScore
    ) {
      consecutiveDeclines++;
    } else break;
  }
  const riskLevel =
    overallAvg != null
      ? calculateRiskLevel({
          overallAverage: overallAvg,
          performanceTier: currentResult?.performanceTier ?? null,
          trend,
          weakSubjectsCount,
          consecutiveDeclines,
        })
      : "low";

  // ── Attendance ──
  let attendanceBreakdown: IRuleBasedInsights["attendanceBreakdown"] = null;
  let attendanceRate: number | null = null;
  let attendanceFlag = false;
  let mostMissedDay: string | null = null;
  let avgLateMinutes: number | null = null;

  if (periodId) {
    const attendanceRecords = (await StudentAttendance.find({
      schoolId: schoolOid,
      studentId: studentOid,
      academicPeriodId: periodId,
      type: "homeroom",
    })
      .select("status date lateMinutes")
      .lean()) as any[];

    if (attendanceRecords.length > 0) {
      const present = attendanceRecords.filter(
        (r: any) => r.status === "present"
      ).length;
      const absent = attendanceRecords.filter(
        (r: any) => r.status === "absent"
      ).length;
      const late = attendanceRecords.filter(
        (r: any) => r.status === "late"
      ).length;
      const excused = attendanceRecords.filter(
        (r: any) => r.status === "excused"
      ).length;
      const total = attendanceRecords.length;

      attendanceBreakdown = { present, absent, late, excused, total };
      attendanceRate =
        total > 0 ? Number((((present + late) / total) * 100).toFixed(1)) : null;
      attendanceFlag = attendanceRate != null && attendanceRate < 80;

      // Most-missed day of week
      const dayCounts: Record<number, number> = {};
      attendanceRecords
        .filter((r: any) => r.status === "absent")
        .forEach((r: any) => {
          const day = new Date(r.date).getDay();
          dayCounts[day] = (dayCounts[day] || 0) + 1;
        });
      const maxDay = Object.entries(dayCounts).sort(
        (a, b) => Number(b[1]) - Number(a[1])
      )[0];
      mostMissedDay = maxDay ? DAY_NAMES[Number(maxDay[0])] : null;

      // Average late minutes
      const lateRecords = attendanceRecords.filter(
        (r: any) => r.status === "late" && r.lateMinutes
      );
      avgLateMinutes =
        lateRecords.length > 0
          ? Number(
              (
                lateRecords.reduce(
                  (s: number, r: any) => s + (r.lateMinutes ?? 0),
                  0
                ) / lateRecords.length
              ).toFixed(1)
            )
          : null;
    }
  }

  // ── Fees ──
  let feesStatus: IRuleBasedInsights["feesStatus"] = null;
  let overdueInvoices = 0;
  let paymentConsistency: number | null = null;
  let feesDetail: StudentInsightsDTO["feesDetail"] = null;

  const invoices = (await Invoice.find({
    schoolId: schoolOid,
    studentId: studentOid,
    status: { $ne: "cancelled" },
  })
    .select(
      "totalAmountMinor totalPaidMinor totalOutstandingMinor status dueDate"
    )
    .lean()) as any[];

  if (invoices.length > 0) {
    const totalBilled = invoices.reduce(
      (s: number, inv: any) => s + (inv.totalAmountMinor ?? 0),
      0
    );
    const totalPaid = invoices.reduce(
      (s: number, inv: any) => s + (inv.totalPaidMinor ?? 0),
      0
    );
    const outstanding = invoices.reduce(
      (s: number, inv: any) => s + (inv.totalOutstandingMinor ?? 0),
      0
    );

    feesDetail = {
      totalBilledMinor: totalBilled,
      totalPaidMinor: totalPaid,
      outstandingMinor: outstanding,
      currency: "GHS",
    };

    if (outstanding <= 0) feesStatus = "clear";
    else if (totalPaid > 0) feesStatus = "partial";
    else feesStatus = "owing";

    const now = new Date();
    overdueInvoices = invoices.filter(
      (inv: any) =>
        inv.totalOutstandingMinor > 0 && new Date(inv.dueDate) < now
    ).length;

    // Payment consistency: % of payments made on or before due date
    const payments = (await Payment.find({
      schoolId: schoolOid,
      studentId: studentOid,
      status: "completed",
    })
      .select("paymentDate invoiceId")
      .lean()) as any[];

    if (payments.length > 0) {
      const invoiceMap = new Map(
        invoices.map((inv: any) => [inv._id.toString(), inv])
      );
      let onTime = 0;
      let total = 0;
      for (const p of payments) {
        const inv = invoiceMap.get(p.invoiceId?.toString());
        if (inv?.dueDate) {
          total++;
          if (new Date(p.paymentDate) <= new Date(inv.dueDate)) onTime++;
        }
      }
      paymentConsistency =
        total > 0 ? Number(((onTime / total) * 100).toFixed(0)) : null;
    }
  }

  // ── Teacher comments ──
  let teacherCommentCount = 0;
  let recentComments: StudentInsightsDTO["recentComments"] = [];

  if (periodId) {
    const comments = (await TeacherComment.find({
      schoolId: schoolOid,
      studentId: studentOid,
      academicPeriodId: periodId,
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate({
        path: "teacherId",
        populate: { path: "userId", select: "firstName lastName" },
        strictPopulate: false,
      })
      .lean()) as any[];

    teacherCommentCount = await TeacherComment.countDocuments({
      schoolId: schoolOid,
      studentId: studentOid,
      academicPeriodId: periodId,
    });

    recentComments = comments.map((c: any) => {
      const user = c.teacherId?.userId;
      const name = user
        ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || null
        : null;
      return {
        comment: c.comment,
        teacherName: name,
        type: c.commentType,
        date: c.createdAt?.toISOString?.() ?? new Date().toISOString(),
      };
    });
  }

  // ── Term history ──
  const allPeriods = (await AcademicPeriod.find({ schoolId: schoolOid })
    .sort({ startDate: 1 })
    .lean()) as any[];

  const termHistory: StudentInsightsDTO["termHistory"] = [];
  for (const p of allPeriods) {
    const tr = allTermResults.find(
      (r: any) =>
        (r.academicPeriodId?._id ?? r.academicPeriodId)?.toString() ===
        p._id.toString()
    );
    let classAverage: number | null = null;
    if (classGroupId) {
      try {
        const ca = await calculateClassAverages({
          schoolId: params.schoolId,
          classGroupId,
          academicPeriodId: p._id.toString(),
        });
        const vals = Object.values(ca);
        if (vals.length > 0) {
          classAverage = Number(
            (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)
          );
        }
      } catch {
        /* skip */
      }
    }
    termHistory.push({
      label: `${p.yearLabel} – ${p.term}`,
      averageScore: tr?.averageScore ?? null,
      classAverage,
    });
  }

  const ruleBased: IRuleBasedInsights = {
    riskLevel,
    trend,
    trendDelta,
    attendanceRate,
    attendanceFlag,
    feesStatus,
    overdueInvoices,
    strengths,
    weaknesses,
    caVsExamGap,
    classPosition,
    classSize,
    positionMovement,
    attendanceBreakdown,
    mostMissedDay,
    avgLateMinutes,
    paymentConsistency,
    teacherCommentCount,
  };

  return {
    studentId: studentOid.toString(),
    studentName,
    gradeName,
    classGroupName,
    currentPeriodId: periodId,
    currentPeriodLabel: periodLabel,
    ruleBased,
    subjectDetails,
    termHistory,
    recentComments,
    feesDetail,
  };
}
