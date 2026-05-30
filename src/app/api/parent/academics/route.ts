// src/app/api/parent/academics/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { Student } from "@/models/Student";
import { Guardian } from "@/models/Guardian";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { TermResult } from "@/models/TermResult";
import { SubjectGrade } from "@/models/SubjectGrade";
import { Subject } from "@/models/Subject";
import {
  computeTermOverviewFromSubjectResults,
  derivePerformanceTier,
  legacyGradeToPerformanceRow,
  mergeSubjectPerformanceRows,
  resolveAcademicsDataSource,
} from "@/lib/academics/compatibility/subject-result-adapters";
import {
  buildSubjectResultPerformanceRows,
  loadSubjectResultsForStudents,
} from "@/lib/academics/compatibility/load-subject-results";
import type { StudentAcademicsDataSource } from "@/types/admin/student-academics";

type TrendDirection = "up" | "down" | "stable";
type PerformanceTier = "top" | "above_average" | "average" | "at_risk";

type GuardianLink = {
  studentId: mongoose.Types.ObjectId;
};

type StudentRow = {
  _id: mongoose.Types.ObjectId;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  photoUrl?: string | null;
  classGroupId?: mongoose.Types.ObjectId;
};

type ClassGroupRow = {
  _id: mongoose.Types.ObjectId;
  name?: string;
  gradeId?: mongoose.Types.ObjectId;
};

type GradeRow = {
  _id: mongoose.Types.ObjectId;
  name?: string;
};

type AcademicPeriodWithDates = {
  _id: mongoose.Types.ObjectId;
  name?: string;
  label?: string;
  startDate: Date;
  endDate: Date;
};

type AcademicPeriodOption = {
  _id: mongoose.Types.ObjectId;
  name?: string;
  label?: string;
};

type PreviousPeriod = {
  _id: mongoose.Types.ObjectId;
};

type TermResultRow = {
  studentId: mongoose.Types.ObjectId;
  averageScore?: number | null;
  classPosition?: number | null;
  totalStudents?: number | null;
  performanceTier?: PerformanceTier | null;
  totalSubjects?: number | null;
};

type PreviousResultRow = {
  studentId: mongoose.Types.ObjectId;
  averageScore?: number | null;
};

type SubjectGradeRow = {
  studentId: mongoose.Types.ObjectId;
  subjectId?: mongoose.Types.ObjectId;
  totalScore?: number | null;
  gradeLetter?: string | null;
  isPassed?: boolean | null;
};

type SubjectRow = {
  _id: mongoose.Types.ObjectId;
  name?: string;
  shortCode?: string | null;
};

interface WardAcademicSummary {
  wardId: string;
  wardName: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  classGroup: string;
  grade: string | null;
  average: number | null;
  previousAverage: number | null;
  trend: "up" | "down" | "stable";
  classPosition: number | null;
  totalStudents: number | null;
  performanceTier: PerformanceTier | null;
  subjectCount: number;
  passedCount: number;
  failedCount: number;
}

interface SubjectPerformance {
  subjectId: string;
  subjectName: string;
  shortCode: string | null;
  wardId: string;
  wardName: string;
  totalScore: number | null;
  gradeLetter: string | null;
  isPassed: boolean | null;
}

interface AcademicComparisonData {
  wardId: string;
  wardName: string;
  photoUrl: string | null;
  average: number | null;
  color: string;
}

export async function GET(req: NextRequest) {
  try {
    const context = await requireParent();
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const periodId = searchParams.get("periodId") || searchParams.get("termId");
    if (periodId && !mongoose.Types.ObjectId.isValid(periodId)) {
      return NextResponse.json(
        { success: false, error: "Invalid periodId" },
        { status: 400 }
      );
    }

    // Get all wards for this parent
    const guardians = await Guardian.find({ userId: context.userId })
      .select("studentId relationship isPrimary")
      .lean<GuardianLink[]>();

    if (!guardians.length) {
      return NextResponse.json({
        success: true,
        data: {
          currentPeriod: null,
          availablePeriods: [],
          wards: [],
          comparison: [],
          topPerformingSubjects: [],
          needsImprovementSubjects: [],
          overallSummary: {
            averageAcrossWards: null,
            highestPerformer: null,
            mostImproved: null,
            totalSubjects: 0,
          },
        },
      });
    }

    const studentIds = guardians.map((g) => g.studentId);

    // Fetch students
    const students = await Student.find({
      _id: { $in: studentIds },
      schoolId: context.schoolId,
      status: "active",
    })
      .select("_id firstName lastName middleName photoUrl classGroupId")
      .lean<StudentRow[]>();

    if (!students.length) {
      return NextResponse.json({
        success: true,
        data: {
          currentPeriod: null,
          availablePeriods: [],
          wards: [],
          comparison: [],
          topPerformingSubjects: [],
          needsImprovementSubjects: [],
          overallSummary: {
            averageAcrossWards: null,
            highestPerformer: null,
            mostImproved: null,
            totalSubjects: 0,
          },
        },
      });
    }

    // Get class groups and grades
    const classGroupIds = students
      .map((s) => s.classGroupId)
      .filter((classGroupId): classGroupId is mongoose.Types.ObjectId => Boolean(classGroupId));
    const classGroups = await ClassGroup.find({ _id: { $in: classGroupIds } })
      .select("_id name gradeId")
      .lean<ClassGroupRow[]>();
    const classGroupMap = new Map(
      classGroups.map((cg) => [
        String(cg._id),
        { name: cg.name || "", gradeId: cg.gradeId || null },
      ])
    );

    const gradeIds = classGroups
      .map((cg) => cg.gradeId)
      .filter((gradeId): gradeId is mongoose.Types.ObjectId => Boolean(gradeId));
    const grades = await Grade.find({ _id: { $in: gradeIds } })
      .select("_id name")
      .lean<GradeRow[]>();
    const gradeMap = new Map(grades.map((g) => [String(g._id), g.name || ""]));

    // Get current and available academic periods
    const now = new Date();
    let currentPeriod = await AcademicPeriod.findOne({
      schoolId: context.schoolId,
      startDate: { $lte: now },
      endDate: { $gte: now },
    })
      .select("_id name label startDate endDate")
      .lean<AcademicPeriodWithDates | null>();

    // If no current period, get the most recent one
    if (!currentPeriod) {
      currentPeriod = await AcademicPeriod.findOne({
        schoolId: context.schoolId,
        endDate: { $lte: now },
      })
        .sort({ endDate: -1 })
        .select("_id name label startDate endDate")
        .lean<AcademicPeriodWithDates | null>();
    }

    let requestedPeriod: AcademicPeriodWithDates | null = null;
    if (periodId) {
      requestedPeriod = await AcademicPeriod.findOne({
        _id: new mongoose.Types.ObjectId(periodId),
        schoolId: context.schoolId,
      })
        .select("_id name label startDate endDate")
        .lean<AcademicPeriodWithDates | null>();

      if (!requestedPeriod) {
        return NextResponse.json(
          { success: false, error: "Academic period not found" },
          { status: 404 }
        );
      }
    }

    const selectedPeriodId = requestedPeriod?._id || currentPeriod?._id;

    // Get available periods (last 2 years worth)
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const availablePeriods = await AcademicPeriod.find({
      schoolId: context.schoolId,
      startDate: { $gte: twoYearsAgo },
    })
      .select("_id name label")
      .sort({ startDate: -1 })
      .lean<AcademicPeriodOption[]>();

    // Get previous period for trend comparison
    let previousPeriod: PreviousPeriod | null = null;
    const trendBaselinePeriod = requestedPeriod || currentPeriod;
    if (trendBaselinePeriod) {
      previousPeriod = await AcademicPeriod.findOne({
        schoolId: context.schoolId,
        endDate: { $lt: trendBaselinePeriod.startDate },
      })
        .sort({ endDate: -1 })
        .select("_id")
        .lean<PreviousPeriod | null>();
    }

    // Fetch term results for selected period
    const termResults = selectedPeriodId
      ? await TermResult.find({
          studentId: { $in: studentIds },
          schoolId: context.schoolId,
          academicPeriodId: selectedPeriodId,
        })
          .select("studentId averageScore classPosition totalStudents performanceTier totalSubjects")
          .lean<TermResultRow[]>()
      : ([] as TermResultRow[]);

    const termResultMap = new Map(
      termResults.map((tr) => [String(tr.studentId), tr])
    );

    // Fetch previous period results for trend
    let previousResultMap = new Map<string, number | null>();
    if (previousPeriod) {
      const previousResults = await TermResult.find({
        studentId: { $in: studentIds },
        schoolId: context.schoolId,
        academicPeriodId: previousPeriod._id,
      })
        .select("studentId averageScore")
        .lean<PreviousResultRow[]>();
      previousResultMap = new Map(
        previousResults.map((pr) => [String(pr.studentId), pr.averageScore ?? null])
      );
    }

    // Fetch subject grades for selected period (legacy fallback)
    const subjectGrades = selectedPeriodId
      ? await SubjectGrade.find({
          studentId: { $in: studentIds },
          schoolId: context.schoolId,
          academicPeriodId: selectedPeriodId,
        })
          .select("studentId subjectId totalScore gradeLetter isPassed")
          .lean<SubjectGradeRow[]>()
      : ([] as SubjectGradeRow[]);

    const subjectResultsByStudent = selectedPeriodId
      ? await loadSubjectResultsForStudents({
          schoolId: context.schoolId,
          studentIds,
          academicPeriodId: selectedPeriodId,
        })
      : new Map<string, never[]>();

    const previousSubjectResultsByStudent =
      previousPeriod && selectedPeriodId
        ? await loadSubjectResultsForStudents({
            schoolId: context.schoolId,
            studentIds,
            academicPeriodId: previousPeriod._id,
          })
        : new Map<string, never[]>();

    // Get all subjects referenced by legacy grades or engine results
    const allSubjectIds = new Set<string>();
    subjectGrades.forEach((sg) => {
      if (sg.subjectId) allSubjectIds.add(String(sg.subjectId));
    });
    for (const results of subjectResultsByStudent.values()) {
      for (const result of results) {
        allSubjectIds.add(String(result.subjectId));
      }
    }

    const subjects = allSubjectIds.size > 0
      ? await Subject.find({
          _id: { $in: Array.from(allSubjectIds) },
        })
          .select("_id name shortCode")
          .lean<SubjectRow[]>()
      : ([] as SubjectRow[]);
    const subjectMap = new Map(
      subjects.map((s) => [
        String(s._id),
        { name: s.name || "Unknown Subject", shortCode: s.shortCode || null },
      ])
    );

    // Group subject grades by student
    const subjectGradesByStudent = new Map<string, SubjectGradeRow[]>();
    subjectGrades.forEach((sg) => {
      const studentId = String(sg.studentId);
      if (!subjectGradesByStudent.has(studentId)) {
        subjectGradesByStudent.set(studentId, []);
      }
      subjectGradesByStudent.get(studentId)!.push(sg);
    });

    // Build ward academic summaries
    const wardColors = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];
    const wardSummaries: WardAcademicSummary[] = [];
    const subjectPerformances: SubjectPerformance[] = [];
    let totalSubjectRowsFromEngine = 0;
    let totalSubjectRowsFromLegacy = 0;
    let summaryFromEngine = false;
    let summaryFromLegacy = false;

    for (const student of students) {
      const studentId = String(student._id);
      const termResult = termResultMap.get(studentId);
      const previousAverageFromTerm = previousResultMap.get(studentId) ?? null;
      const classGroupInfo = classGroupMap.get(String(student.classGroupId));
      const gradeName = classGroupInfo?.gradeId ? gradeMap.get(String(classGroupInfo.gradeId)) : null;

      const wardName = `${student.firstName || ""} ${student.lastName || ""}`.trim();

      const engineResults = subjectResultsByStudent.get(studentId) ?? [];
      const engineRows =
        engineResults.length > 0
          ? await buildSubjectResultPerformanceRows({
              schoolId: context.schoolId,
              results: engineResults,
            })
          : [];

      const legacyRows = (subjectGradesByStudent.get(studentId) ?? [])
        .map((sg) => {
          const subjectId = String(sg.subjectId);
          const subjectInfo = subjectMap.get(subjectId);
          if (!subjectInfo) return null;
          return legacyGradeToPerformanceRow({
            subjectId,
            subjectName: subjectInfo.name,
            shortCode: subjectInfo.shortCode,
            totalScore: sg.totalScore ?? null,
            gradeLetter: sg.gradeLetter ?? null,
            isPassed: typeof sg.isPassed === "boolean" ? sg.isPassed : null,
          });
        })
        .filter((row): row is NonNullable<typeof row> => row != null);

      const merged = mergeSubjectPerformanceRows(engineRows, legacyRows);
      totalSubjectRowsFromEngine += merged.subjectRowsFromEngine;
      totalSubjectRowsFromLegacy += merged.subjectRowsFromLegacy;

      const engineOverview =
        engineResults.length > 0 && selectedPeriodId
          ? computeTermOverviewFromSubjectResults({
              termId: String(selectedPeriodId),
              label: "",
              results: engineResults,
            })
          : null;

      const currentAverage =
        engineOverview?.averageScore ?? termResult?.averageScore ?? null;
      const performanceTier =
        engineOverview?.performanceTier ?? termResult?.performanceTier ?? null;

      if (engineOverview?.averageScore != null) {
        summaryFromEngine = true;
      } else if (termResult?.averageScore != null) {
        summaryFromLegacy = true;
      }

      let previousAverage = previousAverageFromTerm;
      if (previousAverage == null && previousPeriod) {
        const previousEngineResults = previousSubjectResultsByStudent.get(studentId) ?? [];
        const previousOverview = computeTermOverviewFromSubjectResults({
          termId: String(previousPeriod._id),
          label: "",
          results: previousEngineResults,
        });
        previousAverage = previousOverview?.averageScore ?? null;
        if (previousOverview?.averageScore != null) {
          summaryFromEngine = true;
        }
      }

      let trend: TrendDirection = "stable";
      if (currentAverage !== null && previousAverage !== null) {
        if (currentAverage > previousAverage + 2) trend = "up";
        else if (currentAverage < previousAverage - 2) trend = "down";
      }

      let passedCount = 0;
      let failedCount = 0;

      for (const row of merged.rows) {
        if (row.isPassed === true) passedCount++;
        else if (row.isPassed === false) failedCount++;

        subjectPerformances.push({
          subjectId: row.subjectId,
          subjectName: row.subjectName,
          shortCode: row.shortCode,
          wardId: studentId,
          wardName,
          totalScore: row.totalScore,
          gradeLetter: row.gradeLetter,
          isPassed: row.isPassed,
        });
      }

      wardSummaries.push({
        wardId: studentId,
        wardName,
        firstName: student.firstName || "",
        lastName: student.lastName || "",
        photoUrl: student.photoUrl || null,
        classGroup: classGroupInfo?.name || "",
        grade: gradeName || null,
        average: currentAverage,
        previousAverage,
        trend,
        classPosition: termResult?.classPosition ?? null,
        totalStudents: termResult?.totalStudents ?? null,
        performanceTier:
          performanceTier ??
          derivePerformanceTier(currentAverage),
        subjectCount: merged.rows.length || termResult?.totalSubjects || 0,
        passedCount,
        failedCount,
      });
    }

    // Build comparison data
    const comparison: AcademicComparisonData[] = wardSummaries.map((ws, index) => ({
      wardId: ws.wardId,
      wardName: ws.wardName,
      photoUrl: ws.photoUrl,
      average: ws.average,
      color: wardColors[index % wardColors.length],
    }));

    // Find top performing subjects (highest scores across wards)
    const topPerformingSubjects = subjectPerformances
      .filter((sp) => sp.totalScore !== null)
      .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
      .slice(0, 5);

    // Find subjects needing improvement (lowest scores)
    const needsImprovementSubjects = subjectPerformances
      .filter((sp) => sp.totalScore !== null && (sp.totalScore || 0) < 60)
      .sort((a, b) => (a.totalScore || 0) - (b.totalScore || 0))
      .slice(0, 5);

    // Calculate overall summary
    const validAverages = wardSummaries.filter((ws) => ws.average !== null);
    const overallAverage = validAverages.length > 0
      ? validAverages.reduce((sum, ws) => sum + (ws.average || 0), 0) / validAverages.length
      : null;

    const highestPerformer = validAverages.length > 0
      ? validAverages.reduce((best, ws) =>
          (ws.average || 0) > (best.average || 0) ? ws : best
        )
      : null;

    const mostImproved = wardSummaries.length > 0
      ? wardSummaries.reduce((best, ws) => {
          const currentDelta = (ws.average || 0) - (ws.previousAverage || ws.average || 0);
          const bestDelta = (best.average || 0) - (best.previousAverage || best.average || 0);
          return currentDelta > bestDelta ? ws : best;
        })
      : null;

    const { dataSource, dataSourceNotes } = resolveAcademicsDataSource({
      subjectRowsFromEngine: totalSubjectRowsFromEngine,
      subjectRowsFromLegacy: totalSubjectRowsFromLegacy,
      summaryFromEngine,
      summaryFromLegacy,
    });

    return NextResponse.json({
      success: true,
      data: {
        currentPeriod: currentPeriod
          ? {
              id: String(currentPeriod._id),
              name: currentPeriod.name || "",
              label: currentPeriod.label || currentPeriod.name || "",
            }
          : null,
        selectedPeriodId: selectedPeriodId ? String(selectedPeriodId) : null,
        selectedPeriodLabel: requestedPeriod
          ? requestedPeriod.label || requestedPeriod.name
          : currentPeriod
          ? currentPeriod.label || currentPeriod.name
          : null,
        availablePeriods: availablePeriods.map((p) => ({
          id: String(p._id),
          name: p.name || "",
          label: p.label || p.name || "",
        })),
        dataSource: dataSource as StudentAcademicsDataSource,
        dataSourceNotes,
        wards: wardSummaries,
        comparison,
        topPerformingSubjects,
        needsImprovementSubjects,
        overallSummary: {
          averageAcrossWards: overallAverage,
          highestPerformer: highestPerformer
            ? { wardId: highestPerformer.wardId, wardName: highestPerformer.wardName, average: highestPerformer.average }
            : null,
          mostImproved: mostImproved && mostImproved.trend === "up"
            ? { wardId: mostImproved.wardId, wardName: mostImproved.wardName, improvement: (mostImproved.average || 0) - (mostImproved.previousAverage || 0) }
            : null,
          totalSubjects: allSubjectIds.size,
        },
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Failed to fetch parent academics:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch academics",
      },
      { status: 500 }
    );
  }
}
