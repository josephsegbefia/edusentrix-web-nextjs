/* eslint-disable @typescript-eslint/no-explicit-any */
// src/lib/academics/buildStudentAcademicsDTO.ts

import mongoose from "mongoose";
import { AcademicPeriod, type IAcademicPeriod } from "@/models/AcademicPeriod";
import { TermResult, type ITermResult } from "@/models/TermResult";
import { SubjectGrade, type ISubjectGrade } from "@/models/SubjectGrade";
import { TeacherComment, type ITeacherComment } from "@/models/TeacherComment";
// Import Teacher and User models to ensure they're registered for population
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";
// Ensure models are registered (side effect import)
void Teacher;
void User;

import { calculateTrend } from "@/lib/academics/calculateGrades";
import { calculateRiskLevel } from "@/lib/academics/calculateRiskLevel";
import { calculateClassAverages } from "@/lib/academics/calculateClassAverages";
import { Student } from "@/models/Student";

import type {
  StudentAcademicsDTO,
  StudentSubjectPerformanceRow,
  StudentTermOverview,
  TeacherCommentDTO,
} from "@/types/admin/student-academics";

type IdLike = string | mongoose.Types.ObjectId;

function toStringId(id: IdLike | undefined | null): string | null {
  if (!id) return null;
  return id instanceof mongoose.Types.ObjectId ? id.toString() : String(id);
}

function formatPeriodLabel(
  period: Pick<IAcademicPeriod, "yearLabel" | "term">
) {
  return `${period.yearLabel} • ${period.term}`;
}

function buildTeacherName(user: any | null | undefined): string | null {
  if (!user) return null;
  if (user.firstName || user.lastName) {
    const full = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
    return full || user.name || null;
  }
  return user.name ?? null;
}

/**
 * Canonical builder for the student's academics DTO.
 *
 * - Uses all AcademicPeriods for the school (even if there is no TermResult yet).
 * - Overlays TermResult data per period where available.
 * - Chooses the selected period based on:
 *   1) explicit academicPeriodId (if provided and valid),
 *   2) isCurrent flag,
 *   3) last period by endDate.
 * - Computes trend using calculateTrend(currentAvg, prevAvg) and adds trendDelta.
 * - Populates subject rows from SubjectGrade for the selected period.
 * - Populates teacher comments for the selected period.
 */
export async function buildStudentAcademicsDTO(params: {
  schoolId: IdLike;
  studentId: IdLike;
  academicPeriodId?: IdLike | null;
}): Promise<StudentAcademicsDTO> {
  const { schoolId, studentId, academicPeriodId } = params;

  const schoolKey = toStringId(schoolId);
  const studentKey = toStringId(studentId);

  if (!schoolKey || !studentKey) {
    throw new Error("Missing schoolId or studentId");
  }

  // 1) Fetch ALL academic periods for this school (for full term history)
  const allPeriods = (await AcademicPeriod.find({
    schoolId: schoolKey,
  })
    .sort({ startDate: 1 })
    .lean()) as unknown as IAcademicPeriod[];

  const periodMap = new Map<string, IAcademicPeriod>();
  for (const p of allPeriods) {
    periodMap.set(p._id.toString(), p);
  }

  // 2) Fetch all TermResult docs for this student
  const termResults = (await TermResult.find({
    schoolId: schoolKey,
    studentId: studentKey,
  })
    .sort({ createdAt: 1 })
    .lean()) as unknown as ITermResult[];

  const termResultByPeriodId = new Map<string, ITermResult>();
  for (const tr of termResults) {
    const pid = toStringId(tr.academicPeriodId);
    if (pid) {
      termResultByPeriodId.set(pid, tr);
    }
  }

  // 3) Determine selected period (URL academicPeriodId, else isCurrent, else latest-by-endDate)
  let selectedPeriod: IAcademicPeriod | null = null;

  if (academicPeriodId) {
    const pid = toStringId(academicPeriodId)!;
    selectedPeriod = periodMap.get(pid) ?? null;

    if (!selectedPeriod) {
      // Fallback: try loading directly from DB in case it wasn't in the initial set
      selectedPeriod = (await AcademicPeriod.findOne({
        schoolId: schoolKey,
        _id: pid,
      }).lean()) as unknown as IAcademicPeriod | null;

      if (selectedPeriod) {
        periodMap.set(selectedPeriod._id.toString(), selectedPeriod);
      }
    }
  }

  if (!selectedPeriod && allPeriods.length > 0) {
    // Try current period
    selectedPeriod = (await AcademicPeriod.findOne({
      schoolId: schoolKey,
      isCurrent: true,
    }).lean()) as unknown as IAcademicPeriod | null;

    // If still null, use last by endDate
    if (!selectedPeriod) {
      const sortedByEnd = [...allPeriods].sort(
        (a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
      );
      selectedPeriod = sortedByEnd[sortedByEnd.length - 1] ?? null;
    }
  }

  // If there are literally no periods, return an empty DTO
  if (!selectedPeriod && allPeriods.length === 0) {
    const emptyDto: StudentAcademicsDTO = {
      studentId: studentKey,
      selectedTermId: null,
      selectedTermLabel: null,
      summary: {
        overallAverage: null,
        classPosition: null,
        totalStudents: null,
        performanceTier: null,
        trend: "stable",
        trendDelta: null,
      },
      term: [],
      subjects: [],
      comments: [],
    };
    return emptyDto;
  }

  // At this point we have at least one period, and likely a selectedPeriod
  const selectedTermId = selectedPeriod?._id
    ? selectedPeriod._id.toString()
    : null;
  const selectedTermLabel = selectedPeriod
    ? formatPeriodLabel(selectedPeriod)
    : null;

  // 4) Build term overview list:
  //    For every academic period, overlay with any available TermResult.
  const terms: StudentTermOverview[] = allPeriods.map((p) => {
    const pid = p._id.toString();
    const tr = termResultByPeriodId.get(pid) ?? null;

    return {
      termId: pid,
      label: formatPeriodLabel(p),
      averageScore: tr?.averageScore ?? null,
      classPosition: tr?.classPosition ?? null,
      totalSubjects: tr?.totalSubjects ?? null,
      performanceTier: tr?.performanceTier ?? null,
    };
  });

  // Ensure terms are sorted by endDate (oldest -> newest)
  terms.sort((a, b) => {
    const pa = a.termId && periodMap.get(a.termId);
    const pb = b.termId && periodMap.get(b.termId);
    if (!pa || !pb) return 0;
    return new Date(pa.endDate).getTime() - new Date(pb.endDate).getTime();
  });

  // 5) Determine trend vs previous period using calculateTrend
  const selectedTermResult = selectedTermId
    ? termResultByPeriodId.get(selectedTermId) ?? null
    : null;

  let trendDirection: "up" | "down" | "stable" | null = null;
  let trendDelta: number | null = null;

  if (selectedTermId && terms.length > 1) {
    const idx = terms.findIndex((t) => t.termId === selectedTermId);
    if (idx > 0) {
      const current = terms[idx];
      const prev = terms[idx - 1];

      if (current.averageScore != null && prev.averageScore != null) {
        const delta = (current.averageScore ?? 0) - (prev.averageScore ?? 0);
        trendDelta = Number(delta.toFixed(2));

        // Use shared helper for direction
        trendDirection = calculateTrend(
          current.averageScore,
          prev.averageScore
        );
      }
    }
  }

  if (!trendDirection) {
    trendDirection = "stable";
  }

  // 6) Subject breakdown for selected term (using SubjectGrade)
  let subjects: StudentSubjectPerformanceRow[] = [];
  if (selectedTermId) {
    // Check if Teacher model is registered
    const TeacherModel = mongoose.models.Teacher;
    const canPopulateTeacher = !!TeacherModel;

    const subjectGradesQuery = SubjectGrade.find({
      schoolId: schoolKey,
      studentId: studentKey,
      academicPeriodId: selectedTermId,
    }).populate("subjectId", "name code");

    // Only populate teacher if model is available
    if (canPopulateTeacher) {
      try {
        subjectGradesQuery.populate({
          path: "teacherId",
          populate: { path: "userId", select: "firstName lastName name" },
          strictPopulate: false,
        });
      } catch (err) {
        // Silently continue if population fails
      }
    }

    const subjectGrades = (await subjectGradesQuery.lean()) as unknown as (
      ISubjectGrade & {
        subjectId?: any;
        teacherId?: any;
      }
    )[];

    // Use a Map to deduplicate by subjectId (in case of duplicates)
    const subjectMap = new Map<string, StudentSubjectPerformanceRow>();

    subjectGrades.forEach((sg) => {
      const subject: any = sg.subjectId;
      const teacher: any = sg.teacherId;
      const teacherUser = teacher?.userId;

      const teacherName = buildTeacherName(teacherUser);

      // Extract subjectId - handle both populated (object) and unpopulated (ObjectId) cases
      let subjectIdStr: string;
      if (subject && typeof subject === 'object' && subject._id) {
        // Subject is populated, use its _id
        subjectIdStr = toStringId(subject._id) || subject._id.toString();
      } else {
        // Subject is not populated, use the ObjectId directly
        subjectIdStr = toStringId(sg.subjectId) || String(sg.subjectId);
      }

      // Only add if not already present (deduplicate)
      if (!subjectMap.has(subjectIdStr)) {
        subjectMap.set(subjectIdStr, {
          subjectId: subjectIdStr,
          subjectName: subject?.name ?? "Unknown subject",
          shortCode: subject?.code ?? null,
          teacherName,
          caPercentage: sg.caPercentage ?? null,
          examPercentage: sg.examPercentage ?? null,
          totalScore: sg.totalScore ?? null,
          gradeLetter: sg.gradeLetter ?? null,
          gradePoint: sg.gradePoint ?? null,
          isPassed: typeof sg.isPassed === "boolean" ? sg.isPassed : null,
        });
      }
    });

    subjects = Array.from(subjectMap.values());
    subjects.sort((a, b) => a.subjectName.localeCompare(b.subjectName));
  }

  // 7) Teacher comments for selected term
  let comments: TeacherCommentDTO[] = [];
  if (selectedTermId) {
    // Check if Teacher model is registered
    const TeacherModel = mongoose.models.Teacher;
    const canPopulateTeacher = !!TeacherModel;

    const commentsQuery = TeacherComment.find({
      schoolId: schoolKey,
      studentId: studentKey,
      academicPeriodId: selectedTermId,
    }).populate("subjectId", "name code");

    // Only populate teacher if model is available
    if (canPopulateTeacher) {
      try {
        commentsQuery.populate({
          path: "teacherId",
          populate: { path: "userId", select: "firstName lastName name" },
          strictPopulate: false,
        });
      } catch (err) {
        // Silently continue if population fails
      }
    }

    const commentDocs = (await commentsQuery
      .sort({ createdAt: -1 })
      .lean()) as unknown as (ITeacherComment & {
      subjectId?: any;
      teacherId?: any;
    })[];

    comments = commentDocs.map((c) => {
      const subject: any = c.subjectId;
      const teacher: any = c.teacherId;
      const teacherUser = teacher?.userId;
      const teacherName = buildTeacherName(teacherUser);

      return {
        id: toStringId(c._id)!,
        commentType: c.commentType,
        subjectId: subject?._id?.toString() ?? null,
        subjectName: subject?.name ?? null,
        teacherName,
        comment: c.comment,
        isPublic: c.isPublic,
        createdAt:
          c.createdAt instanceof Date
            ? c.createdAt.toISOString()
            : new Date().toISOString(),
      };
    });
  }

  // 8) Build summary block
  const summary = {
    overallAverage: selectedTermResult?.averageScore ?? null,
    classPosition: selectedTermResult?.classPosition ?? null,
    totalStudents: selectedTermResult?.totalStudents ?? null,
    performanceTier: selectedTermResult?.performanceTier ?? null,
    trend: trendDirection,
    trendDelta,
  };

  // 9) Extended fields for enhanced gradebook
  // Get student's classGroupId
  const studentDoc = await Student.findById(studentKey)
    .select("classGroupId")
    .lean<{ classGroupId?: mongoose.Types.ObjectId } | null>();
  const classGroupId = studentDoc?.classGroupId;

  // Calculate class averages for selected term
  let classAverages: Record<string, number> = {};
  if (selectedTermId && classGroupId) {
    try {
      classAverages = await calculateClassAverages({
        schoolId: schoolKey,
        classGroupId,
        academicPeriodId: selectedTermId,
      });
    } catch (error) {
      console.error("Error calculating class averages:", error);
      // Continue without class averages
    }
  }

  // Build multi-term history with class averages
  const multiTermHistory = await Promise.all(
    terms.map(async (term) => {
      let classAverage: number | null = null;
      if (classGroupId && term.termId) {
        try {
          const termClassAverages = await calculateClassAverages({
            schoolId: schoolKey,
            classGroupId,
            academicPeriodId: term.termId,
          });
          // Calculate overall class average for this term
          const classAvgValues = Object.values(termClassAverages);
          if (classAvgValues.length > 0) {
            classAverage =
              classAvgValues.reduce((sum, val) => sum + val, 0) /
              classAvgValues.length;
            classAverage = Number(classAverage.toFixed(2));
          }
        } catch (error) {
          // Continue without class average for this term
        }
      }
      return {
        termId: term.termId,
        label: term.label,
        averageScore: term.averageScore,
        classAverage,
      };
    })
  );

  // Build subject history (for sparklines)
  const subjectHistory: Record<
    string,
    Array<{ termId: string; termLabel: string; totalScore: number | null }>
  > = {};

  if (subjects.length > 0 && terms.length > 0) {
    // Fetch all SubjectGrade records for this student across all terms
    const allSubjectGrades = (await SubjectGrade.find({
      schoolId: schoolKey,
      studentId: studentKey,
      academicPeriodId: {
        $in: terms.map((t) => t.termId).filter(Boolean),
      },
    })
      .populate("subjectId", "name code")
      .lean()) as unknown as (ISubjectGrade & { subjectId?: any })[];

    for (const sg of allSubjectGrades) {
      const subjectIdStr = sg.subjectId?._id
        ? toStringId(sg.subjectId._id)
        : toStringId(sg.subjectId);
      if (!subjectIdStr) continue;

      const periodId = toStringId(sg.academicPeriodId);
      if (!periodId) continue;

      const period = periodMap.get(periodId);
      if (!period) continue;

      if (!subjectHistory[subjectIdStr]) {
        subjectHistory[subjectIdStr] = [];
      }

      subjectHistory[subjectIdStr].push({
        termId: periodId,
        termLabel: formatPeriodLabel(period),
        totalScore: sg.totalScore ?? null,
      });
    }

    // Sort each subject's history by term order
    for (const subjectId in subjectHistory) {
      subjectHistory[subjectId].sort((a, b) => {
        const aIdx = terms.findIndex((t) => t.termId === a.termId);
        const bIdx = terms.findIndex((t) => t.termId === b.termId);
        return aIdx - bIdx;
      });
    }
  }

  // Calculate risk level
  const weakSubjectsCount = subjects.filter(
    (s) => s.totalScore !== null && s.totalScore < 60
  ).length;

  // Count consecutive declines
  let consecutiveDeclines = 0;
  for (let i = terms.length - 1; i > 0; i--) {
    const current = terms[i];
    const prev = terms[i - 1];
    if (
      current.averageScore !== null &&
      prev.averageScore !== null &&
      current.averageScore < prev.averageScore
    ) {
      consecutiveDeclines++;
    } else {
      break;
    }
  }

  const riskLevel = calculateRiskLevel({
    overallAverage: summary.overallAverage,
    performanceTier: summary.performanceTier,
    trend: trendDirection,
    weakSubjectsCount,
    consecutiveDeclines,
  });

  // Find strongest and weakest subjects
  let strongestSubject: {
    subjectId: string;
    subjectName: string;
    score: number;
  } | null = null;
  let weakestSubject: {
    subjectId: string;
    subjectName: string;
    score: number;
  } | null = null;

  const subjectsWithScores = subjects.filter(
    (s) => s.totalScore !== null
  ) as Array<StudentSubjectPerformanceRow & { totalScore: number }>;

  if (subjectsWithScores.length > 0) {
    const sortedByScore = [...subjectsWithScores].sort(
      (a, b) => b.totalScore - a.totalScore
    );
    strongestSubject = {
      subjectId: sortedByScore[0].subjectId,
      subjectName: sortedByScore[0].subjectName,
      score: sortedByScore[0].totalScore,
    };
    weakestSubject = {
      subjectId: sortedByScore[sortedByScore.length - 1].subjectId,
      subjectName: sortedByScore[sortedByScore.length - 1].subjectName,
      score: sortedByScore[sortedByScore.length - 1].totalScore,
    };
  }

  // 10) Final DTO for the student academics tab / gradebook
  const dto: StudentAcademicsDTO = {
    studentId: studentKey,
    selectedTermId,
    selectedTermLabel,
    summary,
    term: terms,
    subjects,
    comments,
    classAverages,
    multiTermHistory,
    subjectHistory,
    riskLevel,
    strongestSubject,
    weakestSubject,
  };

  return dto;
}
