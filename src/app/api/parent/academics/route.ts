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
  performanceTier: string | null;
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

    // Get all wards for this parent
    const guardians = await Guardian.find({ userId: context.userId })
      .select("studentId relationship isPrimary")
      .lean();

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

    const studentIds = guardians.map(
      (g) => (g as unknown as { studentId: mongoose.Types.ObjectId }).studentId
    );

    // Fetch students
    const students = await Student.find({
      _id: { $in: studentIds },
      schoolId: context.schoolId,
      status: "active",
    })
      .select("_id firstName lastName middleName photoUrl classGroupId")
      .lean();

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
    const classGroupIds = students.map((s: any) => s.classGroupId).filter(Boolean);
    const classGroups = await ClassGroup.find({ _id: { $in: classGroupIds } })
      .select("_id name gradeId")
      .lean();
    const classGroupMap = new Map(
      classGroups.map((cg: any) => [String(cg._id), { name: cg.name, gradeId: cg.gradeId }])
    );

    const gradeIds = classGroups.map((cg: any) => cg.gradeId).filter(Boolean);
    const grades = await Grade.find({ _id: { $in: gradeIds } }).select("_id name").lean();
    const gradeMap = new Map(grades.map((g: any) => [String(g._id), g.name]));

    // Get current and available academic periods
    const now = new Date();
    let currentPeriod = await AcademicPeriod.findOne({
      schoolId: context.schoolId,
      startDate: { $lte: now },
      endDate: { $gte: now },
    })
      .select("_id name label startDate endDate")
      .lean();

    // If no current period, get the most recent one
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

    // Get available periods (last 2 years worth)
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const availablePeriods = await AcademicPeriod.find({
      schoolId: context.schoolId,
      startDate: { $gte: twoYearsAgo },
    })
      .select("_id name label")
      .sort({ startDate: -1 })
      .lean();

    // Get previous period for trend comparison
    let previousPeriod: any = null;
    if (currentPeriod) {
      previousPeriod = await AcademicPeriod.findOne({
        schoolId: context.schoolId,
        endDate: { $lt: (currentPeriod as any).startDate },
      })
        .sort({ endDate: -1 })
        .select("_id")
        .lean();
    }

    // Fetch term results for selected period
    const termResults = selectedPeriodId
      ? await TermResult.find({
          studentId: { $in: studentIds },
          schoolId: context.schoolId,
          academicPeriodId: selectedPeriodId,
        })
          .select("studentId averageScore classPosition totalStudents performanceTier totalSubjects")
          .lean()
      : [];

    const termResultMap = new Map(
      termResults.map((tr: any) => [String(tr.studentId), tr])
    );

    // Fetch previous period results for trend
    let previousResultMap = new Map();
    if (previousPeriod) {
      const previousResults = await TermResult.find({
        studentId: { $in: studentIds },
        schoolId: context.schoolId,
        academicPeriodId: previousPeriod._id,
      })
        .select("studentId averageScore")
        .lean();
      previousResultMap = new Map(
        previousResults.map((pr: any) => [String(pr.studentId), pr.averageScore])
      );
    }

    // Fetch subject grades for selected period
    const subjectGrades = selectedPeriodId
      ? await SubjectGrade.find({
          studentId: { $in: studentIds },
          schoolId: context.schoolId,
          academicPeriodId: selectedPeriodId,
        })
          .select("studentId subjectId totalScore gradeLetter isPassed")
          .lean()
      : [];

    // Get all subjects referenced
    const allSubjectIds = new Set<string>();
    subjectGrades.forEach((sg: any) => {
      if (sg.subjectId) allSubjectIds.add(String(sg.subjectId));
    });

    const subjects = allSubjectIds.size > 0
      ? await Subject.find({
          _id: { $in: Array.from(allSubjectIds) },
        })
          .select("_id name shortCode")
          .lean()
      : [];
    const subjectMap = new Map(
      subjects.map((s: any) => [String(s._id), { name: s.name, shortCode: s.shortCode }])
    );

    // Group subject grades by student
    const subjectGradesByStudent = new Map<string, any[]>();
    subjectGrades.forEach((sg: any) => {
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

    students.forEach((student: any, index: number) => {
      const studentId = String(student._id);
      const termResult = termResultMap.get(studentId);
      const previousAverage = previousResultMap.get(studentId) || null;
      const classGroupInfo = classGroupMap.get(String(student.classGroupId));
      const gradeName = classGroupInfo?.gradeId ? gradeMap.get(String(classGroupInfo.gradeId)) : null;

      const wardName = `${student.firstName || ""} ${student.lastName || ""}`.trim();
      const currentAverage = termResult?.averageScore ?? null;

      let trend: "up" | "down" | "stable" = "stable";
      if (currentAverage !== null && previousAverage !== null) {
        if (currentAverage > previousAverage + 2) trend = "up";
        else if (currentAverage < previousAverage - 2) trend = "down";
      }

      // Count passed/failed subjects from subject grades
      const studentSubjectGrades = subjectGradesByStudent.get(studentId) || [];
      let passedCount = 0;
      let failedCount = 0;

      studentSubjectGrades.forEach((sg: any) => {
        if (sg.isPassed === true) passedCount++;
        else if (sg.isPassed === false) failedCount++;

        // Add to subject performances
        const subjectInfo = subjectMap.get(String(sg.subjectId));
        if (subjectInfo) {
          subjectPerformances.push({
            subjectId: String(sg.subjectId),
            subjectName: subjectInfo.name,
            shortCode: subjectInfo.shortCode,
            wardId: studentId,
            wardName,
            totalScore: sg.totalScore ?? null,
            gradeLetter: sg.gradeLetter ?? null,
            isPassed: sg.isPassed ?? null,
          });
        }
      });

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
        performanceTier: termResult?.performanceTier ?? null,
        subjectCount: studentSubjectGrades.length || termResult?.totalSubjects || 0,
        passedCount,
        failedCount,
      });
    });

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
