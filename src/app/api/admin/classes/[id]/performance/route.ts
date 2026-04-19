import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { ClassGroup } from "@/models/ClassGroup";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Student } from "@/models/Student";
import { Subject } from "@/models/Subject";
import { TermResult } from "@/models/TermResult";
import { SubjectGrade } from "@/models/SubjectGrade";

function toObjectIdOrNull(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    return null;
  }
}

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function percent(part: number, whole: number, decimals = 1) {
  if (!whole) return 0;
  return round((part / whole) * 100, decimals);
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? round((sorted[mid - 1] + sorted[mid]) / 2)
    : round(sorted[mid]);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { id } = await params;
    const classId = toObjectIdOrNull(id);
    if (!classId) {
      return NextResponse.json(
        { success: false, error: "Invalid class ID" },
        { status: 400 }
      );
    }

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const classDoc = await ClassGroup.findOne({
      _id: classId,
      schoolId: schoolIdObj,
    })
      .populate("gradeId", "name")
      .lean();

    if (!classDoc) {
      return NextResponse.json(
        { success: false, error: "Class not found" },
        { status: 404 }
      );
    }

    const periods = await AcademicPeriod.find({ schoolId: schoolIdObj })
      .sort({ startDate: 1, endDate: 1, createdAt: 1 })
      .lean();

    const { searchParams } = new URL(req.url);
    const requestedPeriodId = toObjectIdOrNull(searchParams.get("academicPeriodId"));
    const requestedSubjectId = searchParams.get("subjectId");

    const selectedPeriod =
      periods.find((period) => String(period._id) === String(requestedPeriodId)) ??
      periods.find((period) => period.isCurrent) ??
      periods[periods.length - 1] ??
      null;
    const selectedPeriodId = selectedPeriod?._id
      ? new mongoose.Types.ObjectId(String(selectedPeriod._id))
      : null;
    const previousPeriod = selectedPeriod
      ? periods[
          periods.findIndex((period) => String(period._id) === String(selectedPeriod._id)) - 1
        ] ?? null
      : null;

    const selectedSubjectId =
      requestedSubjectId && requestedSubjectId !== "all"
        ? toObjectIdOrNull(requestedSubjectId)
        : null;

    const students = await Student.find({
      schoolId: schoolIdObj,
      classGroupId: classId,
      status: "active",
    })
      .select("firstName lastName admissionNo photoUrl")
      .sort({ lastName: 1, firstName: 1 })
      .lean();

    const gradeName = (classDoc as any).gradeId?.name ?? "Class";
    const classLabel = `${gradeName} ${(classDoc as any).name}`.trim();

    const subjectIds = (((classDoc as any).subjectIds ?? []) as Array<mongoose.Types.ObjectId>).map(
      (value) => new mongoose.Types.ObjectId(String(value))
    );
    const subjectDocs = subjectIds.length
      ? await Subject.find({ _id: { $in: subjectIds } }).select("name code").lean()
      : [];
    const subjectMap = new Map(
      subjectDocs.map((subject: any) => [String(subject._id), { name: subject.name, code: subject.code ?? null }])
    );

    if (students.length === 0 || !selectedPeriodId) {
      return NextResponse.json({
        success: true,
        data: {
          classGroup: {
            id: String((classDoc as any)._id),
            name: (classDoc as any).name,
            fullLabel: classLabel,
          },
          filters: {
            academicPeriodId: selectedPeriodId ? String(selectedPeriodId) : null,
            academicPeriodLabel: selectedPeriod
              ? `${selectedPeriod.yearLabel} • ${selectedPeriod.term}`
              : null,
            subjectId: selectedSubjectId ? String(selectedSubjectId) : "all",
            subjectLabel: selectedSubjectId
              ? subjectMap.get(String(selectedSubjectId))?.name ?? "Selected subject"
              : "All subjects",
          },
          summary: {
            assessedStudentsCount: 0,
            classAverage: 0,
            medianScore: 0,
            passRate: 0,
            topPerformerCount: 0,
            atRiskCount: 0,
            comparisonAverage: null,
            comparisonDelta: null,
          },
          distribution: {
            top: 0,
            aboveAverage: 0,
            average: 0,
            atRisk: 0,
          },
          ranking: [],
          subjectBreakdown: [],
          spotlight: {
            topPerformers: [],
            attentionNeeded: [],
          },
          leo: {
            riskLevel: "low",
            headline: "Performance insights will appear once results are published.",
            summary:
              "No class performance data is available for the selected filters yet.",
            insights: [
              "Publish term results or subject grades to unlock class-level performance analytics.",
            ],
            predictions: [],
          },
        },
      });
    }

    const studentIds = students.map((student) => student._id);
    const studentMap = new Map(
      students.map((student) => [
        String(student._id),
        {
          fullName: `${student.firstName} ${student.lastName}`.trim(),
          admissionNo: student.admissionNo ?? null,
          photoUrl: student.photoUrl ?? null,
        },
      ])
    );

    let ranking: Array<{
      studentId: string;
      fullName: string;
      admissionNo: string | null;
      photoUrl: string | null;
      score: number;
      rank: number | null;
      totalSubjects: number | null;
      performanceTier: string | null;
      gpa: number | null;
      isPromoted: boolean | null;
    }> = [];

    if (selectedSubjectId) {
      const subjectGrades = await SubjectGrade.find({
        schoolId: schoolIdObj,
        academicPeriodId: selectedPeriodId,
        subjectId: selectedSubjectId,
        studentId: { $in: studentIds },
      })
        .select("studentId totalScore gradeLetter isPassed")
        .lean();

      ranking = subjectGrades
        .map((grade: any) => {
          const studentMeta = studentMap.get(String(grade.studentId));
          if (!studentMeta) return null;
          return {
            studentId: String(grade.studentId),
            fullName: studentMeta.fullName,
            admissionNo: studentMeta.admissionNo,
            photoUrl: studentMeta.photoUrl,
            score: round(Number(grade.totalScore || 0)),
            rank: null,
            totalSubjects: 1,
            performanceTier:
              Number(grade.totalScore || 0) >= 80
                ? "top"
                : Number(grade.totalScore || 0) >= 65
                ? "above_average"
                : Number(grade.totalScore || 0) >= 50
                ? "average"
                : "at_risk",
            gpa: null,
            isPromoted: null,
          };
        })
        .filter(Boolean) as Array<{
        studentId: string;
        fullName: string;
        admissionNo: string | null;
        photoUrl: string | null;
        score: number;
        rank: number | null;
        totalSubjects: number | null;
        performanceTier: string | null;
        gpa: number | null;
        isPromoted: boolean | null;
      }>;

      ranking.sort((a, b) => b.score - a.score || a.fullName.localeCompare(b.fullName));
      ranking = ranking.map((row, index) => ({ ...row, rank: index + 1 }));
    } else {
      const termResults = await TermResult.find({
        schoolId: schoolIdObj,
        classGroupId: classId,
        academicPeriodId: selectedPeriodId,
        studentId: { $in: studentIds },
      })
        .select("studentId averageScore classPosition totalSubjects performanceTier gpa isPromoted")
        .lean();

      ranking = termResults
        .map((result: any) => {
          const studentMeta = studentMap.get(String(result.studentId));
          if (!studentMeta) return null;
          return {
            studentId: String(result.studentId),
            fullName: studentMeta.fullName,
            admissionNo: studentMeta.admissionNo,
            photoUrl: studentMeta.photoUrl,
            score: round(Number(result.averageScore || 0)),
            rank: result.classPosition ?? null,
            totalSubjects: result.totalSubjects ?? null,
            performanceTier: result.performanceTier ?? null,
            gpa: result.gpa ?? null,
            isPromoted: result.isPromoted ?? null,
          };
        })
        .filter(Boolean) as Array<{
        studentId: string;
        fullName: string;
        admissionNo: string | null;
        photoUrl: string | null;
        score: number;
        rank: number | null;
        totalSubjects: number | null;
        performanceTier: string | null;
        gpa: number | null;
        isPromoted: boolean | null;
      }>;

      ranking.sort((a, b) => {
        if (a.rank !== null && b.rank !== null) return a.rank - b.rank;
        return b.score - a.score || a.fullName.localeCompare(b.fullName);
      });
    }

    const scores = ranking.map((row) => row.score);
    const classAverage = scores.length
      ? round(scores.reduce((sum, value) => sum + value, 0) / scores.length)
      : 0;
    const medianScore = median(scores);
    const passRate = percent(
      ranking.filter((row) => row.score >= 50).length,
      ranking.length
    );
    const topPerformerCount = ranking.filter((row) => row.score >= 80).length;
    const atRiskCount = ranking.filter((row) => row.score < 50).length;

    let comparisonAverage: number | null = null;
    let comparisonDelta: number | null = null;
    if (previousPeriod?._id) {
      if (selectedSubjectId) {
        const previousRows = await SubjectGrade.find({
          schoolId: schoolIdObj,
          academicPeriodId: previousPeriod._id,
          subjectId: selectedSubjectId,
          studentId: { $in: studentIds },
        })
          .select("totalScore")
          .lean();

        if (previousRows.length > 0) {
          comparisonAverage = round(
            previousRows.reduce(
              (sum: number, row: any) => sum + Number(row.totalScore || 0),
              0
            ) / previousRows.length
          );
        }
      } else {
        const previousRows = await TermResult.find({
          schoolId: schoolIdObj,
          classGroupId: classId,
          academicPeriodId: previousPeriod._id,
          studentId: { $in: studentIds },
        })
          .select("averageScore")
          .lean();

        if (previousRows.length > 0) {
          comparisonAverage = round(
            previousRows.reduce(
              (sum: number, row: any) => sum + Number(row.averageScore || 0),
              0
            ) / previousRows.length
          );
        }
      }
      if (comparisonAverage !== null) {
        comparisonDelta = round(classAverage - comparisonAverage);
      }
    }

    const subjectAggregate = await SubjectGrade.aggregate([
      {
        $match: {
          schoolId: schoolIdObj,
          academicPeriodId: selectedPeriodId,
          studentId: { $in: studentIds },
          ...(selectedSubjectId ? { subjectId: selectedSubjectId } : {}),
        },
      },
      {
        $group: {
          _id: "$subjectId",
          averageScore: { $avg: "$totalScore" },
          topScore: { $max: "$totalScore" },
          lowScore: { $min: "$totalScore" },
          assessedStudentsCount: { $sum: 1 },
          passCount: {
            $sum: {
              $cond: [{ $gte: ["$totalScore", 50] }, 1, 0],
            },
          },
        },
      },
      { $sort: { averageScore: -1 } },
    ]);

    const subjectBreakdown = subjectAggregate.map((row: any) => ({
      subjectId: String(row._id),
      subjectName: subjectMap.get(String(row._id))?.name ?? "Unknown subject",
      subjectCode: subjectMap.get(String(row._id))?.code ?? null,
      averageScore: round(Number(row.averageScore || 0)),
      topScore: round(Number(row.topScore || 0)),
      lowScore: round(Number(row.lowScore || 0)),
      assessedStudentsCount: Number(row.assessedStudentsCount || 0),
      passRate: percent(Number(row.passCount || 0), Number(row.assessedStudentsCount || 0)),
    }));

    const distribution = ranking.reduce(
      (acc, row) => {
        const tier = row.performanceTier;
        if (tier === "top") acc.top += 1;
        else if (tier === "above_average") acc.aboveAverage += 1;
        else if (tier === "at_risk") acc.atRisk += 1;
        else acc.average += 1;
        return acc;
      },
      { top: 0, aboveAverage: 0, average: 0, atRisk: 0 }
    );

    const topPerformers = ranking.slice(0, 5);
    const attentionNeeded = [...ranking]
      .sort((a, b) => a.score - b.score || a.fullName.localeCompare(b.fullName))
      .slice(0, 5);

    const leoRiskLevel =
      classAverage < 60 || atRiskCount >= Math.max(3, Math.ceil(ranking.length * 0.25))
        ? "high"
        : classAverage < 70 || passRate < 80
        ? "medium"
        : "low";

    const selectedSubjectLabel = selectedSubjectId
      ? subjectMap.get(String(selectedSubjectId))?.name ?? "Selected subject"
      : "All subjects";

    const weakestSubject = [...subjectBreakdown].sort(
      (a, b) => a.averageScore - b.averageScore
    )[0];
    const strongestSubject = subjectBreakdown[0];

    const leoInsights = [
      `${ranking.length} student${ranking.length === 1 ? "" : "s"} have published ${
        selectedSubjectId ? "subject" : "term"
      } results for the selected period.`,
      strongestSubject
        ? `Strongest subject signal: ${strongestSubject.subjectName} is averaging ${strongestSubject.averageScore}%.`
        : "No subject-level breakdown is available yet.",
      weakestSubject && strongestSubject && weakestSubject.subjectId !== strongestSubject.subjectId
        ? `Weakest subject signal: ${weakestSubject.subjectName} is the current drag on class average at ${weakestSubject.averageScore}%.`
        : "The available results are too narrow to isolate a weak subject.",
      atRiskCount > 0
        ? `${atRiskCount} student${atRiskCount === 1 ? "" : "s"} are currently below the pass threshold.`
        : "No students are currently below the pass threshold.",
    ];

    const leoPredictions: string[] = [];
    if (comparisonDelta !== null && comparisonDelta < -2) {
      leoPredictions.push(
        "Performance is slipping against the previous period. Intervention in the next assessment cycle would likely have the highest impact."
      );
    }
    if (weakestSubject && weakestSubject.averageScore < 55) {
      leoPredictions.push(
        `${weakestSubject.subjectName} is likely to continue generating the largest risk cluster unless reteaching or support sessions are introduced.`
      );
    }
    if (topPerformerCount >= Math.ceil(Math.max(1, ranking.length * 0.25))) {
      leoPredictions.push(
        "The class has enough strong performers to support peer tutoring or revision grouping without overloading the top end."
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        classGroup: {
          id: String((classDoc as any)._id),
          name: (classDoc as any).name,
          fullLabel: classLabel,
        },
        filters: {
          academicPeriodId: String(selectedPeriodId),
          academicPeriodLabel: selectedPeriod
            ? `${selectedPeriod.yearLabel} • ${selectedPeriod.term}`
            : null,
          subjectId: selectedSubjectId ? String(selectedSubjectId) : "all",
          subjectLabel: selectedSubjectLabel,
        },
        summary: {
          assessedStudentsCount: ranking.length,
          classAverage,
          medianScore,
          passRate,
          topPerformerCount,
          atRiskCount,
          comparisonAverage,
          comparisonDelta,
        },
        distribution,
        ranking,
        subjectBreakdown,
        spotlight: {
          topPerformers,
          attentionNeeded,
        },
        leo: {
          riskLevel: leoRiskLevel,
          headline:
            leoRiskLevel === "high"
              ? "This class needs academic intervention."
              : leoRiskLevel === "medium"
              ? "Performance is mixed, with a visible support group."
              : "The class is performing well overall.",
          summary:
            leoRiskLevel === "high"
              ? "The current results show too many students below the pass line or a weak class average."
              : leoRiskLevel === "medium"
              ? "The class has a workable foundation, but the weaker tail and subject spread need attention."
              : "Results suggest the class is holding a healthy academic baseline for the selected period.",
          insights: leoInsights,
          predictions: leoPredictions,
        },
      },
    });
  } catch (error) {
    console.error("Failed to fetch class performance analytics:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch class performance analytics",
      },
      { status: 500 }
    );
  }
}
