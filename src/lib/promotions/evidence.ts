// src/lib/promotions/evidence.ts
// PROMO-BE-003: Evidence computation per PROMOTION_SERVICE_SPEC §9.1
import { StudentAttendance } from "@/models/StudentAttendance";
import { TermResult } from "@/models/TermResult";
import { SubjectGrade } from "@/models/SubjectGrade";
import { Invoice } from "@/models/Invoice";
import type { Types } from "mongoose";

export type EvidenceResult = {
  attendancePercent: number | null;
  overallAverage: number | null;
  subjectsPassedPercent: number | null;
  feeOutstandingMinor: number | null;
  disciplineFlags: number | null;
};

/**
 * Compute attendance percent from StudentAttendance for the period.
 * attended = present + late + (excused if treatExcusedAsPresent)
 */
export async function computeAttendancePercent(
  studentId: Types.ObjectId,
  academicPeriodId: Types.ObjectId,
  treatExcusedAsPresent: boolean
): Promise<number | null> {
  const { AcademicPeriod } = await import("@/models/AcademicPeriod");
  const period = await AcademicPeriod.findById(academicPeriodId)
    .select("startDate endDate")
    .lean();
  if (!period) return null;

  const start = new Date((period as { startDate: Date }).startDate);
  const end = new Date((period as { endDate: Date }).endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const records = await StudentAttendance.find({
    studentId,
    academicPeriodId,
    type: "homeroom",
    date: { $gte: start, $lte: end },
  })
    .select("status")
    .lean();

  if (records.length === 0) return null;

  const attended = records.filter((r) => {
    if (r.status === "present" || r.status === "late") return true;
    if (r.status === "excused" && treatExcusedAsPresent) return true;
    return false;
  }).length;

  return Math.round((attended / records.length) * 10000) / 100;
}

/**
 * Compute academic evidence from TermResult (primary) or SubjectGrade (fallback).
 */
export async function computeAcademicEvidence(
  studentId: Types.ObjectId,
  academicPeriodId: Types.ObjectId,
  classGroupId: Types.ObjectId
): Promise<{ overallAverage: number | null; subjectsPassedPercent: number | null }> {
  const termResultRaw = await TermResult.findOne({
    studentId,
    academicPeriodId,
    classGroupId,
  })
    .select("averageScore totalSubjects")
    .lean();
  const termResult = Array.isArray(termResultRaw)
    ? termResultRaw[0] || null
    : termResultRaw;

  if (termResult) {
    const avg = termResult.averageScore ?? null;
    const totalSubjects = termResult.totalSubjects ?? 0;
    if (totalSubjects === 0) return { overallAverage: avg, subjectsPassedPercent: null };

    const passedCount = await SubjectGrade.countDocuments({
      studentId,
      academicPeriodId,
      isPassed: true,
    });
    const totalCount = await SubjectGrade.countDocuments({
      studentId,
      academicPeriodId,
    });
    const subjectsPassedPercent =
      totalCount > 0 ? Math.round((passedCount / totalCount) * 10000) / 100 : null;

    return { overallAverage: avg, subjectsPassedPercent };
  }

  const grades = await SubjectGrade.find({
    studentId,
    academicPeriodId,
  })
    .select("totalScore isPassed")
    .lean();

  if (grades.length === 0) return { overallAverage: null, subjectsPassedPercent: null };

  const totalScore = grades.reduce((s, g) => s + (g.totalScore ?? 0), 0);
  const overallAverage = Math.round((totalScore / grades.length) * 100) / 100;
  const passedCount = grades.filter((g) => g.isPassed).length;
  const subjectsPassedPercent =
    Math.round((passedCount / grades.length) * 10000) / 100;

  return { overallAverage, subjectsPassedPercent };
}

/**
 * Sum outstanding fees (minor units) for student in the period.
 */
export async function computeFeeOutstanding(
  studentId: Types.ObjectId,
  academicPeriodId: Types.ObjectId
): Promise<number> {
  const invoices = await Invoice.find({
    studentId,
    academicPeriodId,
    status: { $in: ["issued", "partially_paid", "overdue"] },
  })
    .select("totalOutstandingMinor")
    .lean();

  return invoices.reduce((s, inv) => s + (inv.totalOutstandingMinor ?? 0), 0);
}

/**
 * Discipline flags: v1 no discipline source; return null.
 * Spec: If required and missing -> hold with MISSING_DISCIPLINE_EVIDENCE.
 */
export async function computeDisciplineFlags(
  _studentId: Types.ObjectId,
  _academicPeriodId: Types.ObjectId
): Promise<number | null> {
  return null;
}
