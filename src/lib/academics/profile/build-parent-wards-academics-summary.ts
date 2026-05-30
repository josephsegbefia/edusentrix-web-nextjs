import mongoose from "mongoose";
import type { ParentContext } from "@/lib/auth/requireParent";
import { buildParentWardAcademicProfile } from "@/lib/academics/profile/build-parent-ward-academic-profile";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { Guardian } from "@/models/Guardian";
import { Student } from "@/models/Student";
import type { StudentAcademicsDataSource } from "@/types/admin/student-academics";
import type { StudentTermPerformanceTier } from "@/types/admin/student-academics";

export type ParentWardAcademicSummaryRow = {
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
  performanceTier: StudentTermPerformanceTier | null;
  subjectCount: number;
  passedCount: number;
  failedCount: number;
};

export type ParentWardSubjectPerformanceRow = {
  subjectId: string;
  subjectName: string;
  shortCode: string | null;
  wardId: string;
  wardName: string;
  totalScore: number | null;
  gradeLetter: string | null;
  isPassed: boolean | null;
};

export type ParentAcademicsAggregateDTO = {
  currentPeriod: { id: string; name: string; label: string } | null;
  selectedPeriodId: string | null;
  selectedPeriodLabel: string | null;
  availablePeriods: Array<{ id: string; name: string; label: string }>;
  dataSource: StudentAcademicsDataSource;
  dataSourceNotes: string[];
  wards: ParentWardAcademicSummaryRow[];
  comparison: Array<{
    wardId: string;
    wardName: string;
    photoUrl: string | null;
    average: number | null;
    color: string;
  }>;
  topPerformingSubjects: ParentWardSubjectPerformanceRow[];
  needsImprovementSubjects: ParentWardSubjectPerformanceRow[];
  overallSummary: {
    averageAcrossWards: number | null;
    highestPerformer: { wardId: string; wardName: string; average: number | null } | null;
    mostImproved: { wardId: string; wardName: string; improvement: number } | null;
    totalSubjects: number;
  };
};

const WARD_COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];

function resolveParentDisplayAverage(profile: Awaited<ReturnType<typeof buildParentWardAcademicProfile>>) {
  if (profile.reportStatus.isReleased) {
    return profile.summary.finalAverage ?? profile.summary.overallAverage;
  }
  return profile.summary.finalAverage ?? profile.summary.overallAverage;
}

function mapProfileDataSource(
  sources: Set<string>
): { dataSource: StudentAcademicsDataSource; notes: string[] } {
  const notes = ["Built from Student Academic Profile (released-first)."];
  if (sources.size === 0 || (sources.size === 1 && sources.has("none"))) {
    return { dataSource: "legacy", notes: [...notes, "No released profile data for the selected period."] };
  }
  if (sources.has("mixed") || (sources.has("report_snapshot") && sources.has("legacy"))) {
    return { dataSource: "mixed", notes };
  }
  if (sources.has("report_snapshot") || sources.has("subject_results")) {
    return { dataSource: "assessment_engine", notes };
  }
  return { dataSource: "legacy", notes };
}

function profileSourceBucket(source: string): string {
  if (source === "report_snapshot" || source === "subject_results") {
    return "assessment_engine";
  }
  if (source === "legacy") return "legacy";
  if (source === "mixed") return "mixed";
  return "none";
}

export async function buildParentWardsAcademicsSummary(input: {
  context: ParentContext;
  periodId?: string | null;
}): Promise<ParentAcademicsAggregateDTO> {
  const empty: ParentAcademicsAggregateDTO = {
    currentPeriod: null,
    selectedPeriodId: null,
    selectedPeriodLabel: null,
    availablePeriods: [],
    dataSource: "legacy",
    dataSourceNotes: ["No wards linked to this account."],
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
  };

  const guardians = await Guardian.find({ userId: input.context.userId })
    .select("studentId")
    .lean<{ studentId: mongoose.Types.ObjectId }[]>();

  if (!guardians.length) {
    return empty;
  }

  const studentIds = guardians.map((g) => g.studentId);
  const students = await Student.find({
    _id: { $in: studentIds },
    schoolId: input.context.schoolId,
    status: "active",
  })
    .select("_id firstName lastName middleName photoUrl classGroupId")
    .lean<
      {
        _id: mongoose.Types.ObjectId;
        firstName?: string;
        lastName?: string;
        photoUrl?: string | null;
        classGroupId?: mongoose.Types.ObjectId;
      }[]
    >();

  if (!students.length) {
    return empty;
  }

  const schoolId =
    input.context.schoolId instanceof mongoose.Types.ObjectId
      ? input.context.schoolId
      : new mongoose.Types.ObjectId(String(input.context.schoolId));

  const classGroupIds = students
    .map((s) => s.classGroupId)
    .filter((id): id is mongoose.Types.ObjectId => Boolean(id));
  const classGroups = await ClassGroup.find({ _id: { $in: classGroupIds } })
    .select("_id name gradeId")
    .lean<{ _id: mongoose.Types.ObjectId; name?: string; gradeId?: mongoose.Types.ObjectId }[]>();
  const classGroupMap = new Map(
    classGroups.map((cg) => [
      String(cg._id),
      { name: cg.name || "", gradeId: cg.gradeId ?? null },
    ])
  );

  const gradeIds = classGroups
    .map((cg) => cg.gradeId)
    .filter((id): id is mongoose.Types.ObjectId => Boolean(id));
  const grades = await Grade.find({ _id: { $in: gradeIds } })
    .select("_id name")
    .lean<{ _id: mongoose.Types.ObjectId; name?: string }[]>();
  const gradeMap = new Map(grades.map((g) => [String(g._id), g.name || ""]));

  const now = new Date();
  let currentPeriod = await AcademicPeriod.findOne({
    schoolId,
    startDate: { $lte: now },
    endDate: { $gte: now },
  })
    .select("_id name label startDate endDate")
    .lean<{ _id: mongoose.Types.ObjectId; name?: string; label?: string; startDate: Date; endDate: Date } | null>();

  if (!currentPeriod) {
    currentPeriod = await AcademicPeriod.findOne({
      schoolId,
      endDate: { $lte: now },
    })
      .sort({ endDate: -1 })
      .select("_id name label startDate endDate")
      .lean<{ _id: mongoose.Types.ObjectId; name?: string; label?: string; startDate: Date; endDate: Date } | null>();
  }

  let requestedPeriod: typeof currentPeriod = null;
  if (input.periodId) {
    requestedPeriod = await AcademicPeriod.findOne({
      _id: new mongoose.Types.ObjectId(input.periodId),
      schoolId,
    })
      .select("_id name label startDate endDate")
      .lean<{ _id: mongoose.Types.ObjectId; name?: string; label?: string; startDate: Date; endDate: Date } | null>();

    if (!requestedPeriod) {
      throw new Error("Academic period not found");
    }
  }

  const selectedPeriod = requestedPeriod ?? currentPeriod;
  const selectedPeriodId = selectedPeriod ? String(selectedPeriod._id) : null;

  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const availablePeriods = await AcademicPeriod.find({
    schoolId,
    startDate: { $gte: twoYearsAgo },
  })
    .select("_id name label")
    .sort({ startDate: -1 })
    .lean<{ _id: mongoose.Types.ObjectId; name?: string; label?: string }[]>();

  let previousPeriodId: string | null = null;
  if (selectedPeriod) {
    const previous = await AcademicPeriod.findOne({
      schoolId,
      endDate: { $lt: selectedPeriod.startDate },
    })
      .sort({ endDate: -1 })
      .select("_id")
      .lean<{ _id: mongoose.Types.ObjectId } | null>();
    previousPeriodId = previous ? String(previous._id) : null;
  }

  const profileSources = new Set<string>();
  const wardSummaries: ParentWardAcademicSummaryRow[] = [];
  const subjectPerformances: ParentWardSubjectPerformanceRow[] = [];

  await Promise.all(
    students.map(async (student) => {
      const wardId = String(student._id);
      const wardName = `${student.firstName || ""} ${student.lastName || ""}`.trim();
      const classGroupInfo = classGroupMap.get(String(student.classGroupId));
      const gradeName = classGroupInfo?.gradeId
        ? gradeMap.get(String(classGroupInfo.gradeId))
        : null;

      const [currentProfile, previousProfile] = await Promise.all([
        buildParentWardAcademicProfile({
          context: input.context,
          wardId,
          periodId: selectedPeriodId,
          allowProgressVisibility: false,
        }),
        previousPeriodId
          ? buildParentWardAcademicProfile({
              context: input.context,
              wardId,
              periodId: previousPeriodId,
              allowProgressVisibility: false,
            })
          : Promise.resolve(null),
      ]);

      profileSources.add(profileSourceBucket(currentProfile.dataSource));

      const currentAverage = resolveParentDisplayAverage(currentProfile);
      const previousAverage = previousProfile
        ? resolveParentDisplayAverage(previousProfile)
        : null;

      let trend: "up" | "down" | "stable" = "stable";
      if (currentAverage != null && previousAverage != null) {
        if (currentAverage > previousAverage + 2) trend = "up";
        else if (currentAverage < previousAverage - 2) trend = "down";
      }

      let passedCount = 0;
      let failedCount = 0;

      for (const row of currentProfile.subjectResults) {
        if (row.isPassed === true) passedCount++;
        else if (row.isPassed === false) failedCount++;

        subjectPerformances.push({
          subjectId: row.subjectId,
          subjectName: row.subjectName,
          shortCode: row.subjectCode,
          wardId,
          wardName,
          totalScore: row.roundedFinalScore ?? row.finalScore,
          gradeLetter: row.gradeLabel,
          isPassed: row.isPassed,
        });
      }

      wardSummaries.push({
        wardId,
        wardName,
        firstName: student.firstName || "",
        lastName: student.lastName || "",
        photoUrl: student.photoUrl ?? null,
        classGroup: classGroupInfo?.name || "",
        grade: gradeName || null,
        average: currentAverage,
        previousAverage,
        trend,
        classPosition: currentProfile.summary.classPosition,
        totalStudents: currentProfile.summary.totalStudents,
        performanceTier: currentProfile.summary.performanceTier,
        subjectCount: currentProfile.subjectResults.length,
        passedCount,
        failedCount,
      });
    })
  );

  wardSummaries.sort((a, b) => a.wardName.localeCompare(b.wardName));

  const comparison = wardSummaries.map((ws, index) => ({
    wardId: ws.wardId,
    wardName: ws.wardName,
    photoUrl: ws.photoUrl,
    average: ws.average,
    color: WARD_COLORS[index % WARD_COLORS.length],
  }));

  const topPerformingSubjects = subjectPerformances
    .filter((sp) => sp.totalScore != null)
    .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
    .slice(0, 5);

  const needsImprovementSubjects = subjectPerformances
    .filter((sp) => sp.totalScore != null && (sp.totalScore || 0) < 60)
    .sort((a, b) => (a.totalScore || 0) - (b.totalScore || 0))
    .slice(0, 5);

  const validAverages = wardSummaries.filter((ws) => ws.average != null);
  const overallAverage =
    validAverages.length > 0
      ? validAverages.reduce((sum, ws) => sum + (ws.average || 0), 0) / validAverages.length
      : null;

  const highestPerformer =
    validAverages.length > 0
      ? validAverages.reduce((best, ws) =>
          (ws.average || 0) > (best.average || 0) ? ws : best
        )
      : null;

  const mostImproved =
    wardSummaries.length > 0
      ? wardSummaries.reduce((best, ws) => {
          const currentDelta = (ws.average || 0) - (ws.previousAverage || ws.average || 0);
          const bestDelta = (best.average || 0) - (best.previousAverage || best.average || 0);
          return currentDelta > bestDelta ? ws : best;
        })
      : null;

  const uniqueSubjects = new Set(subjectPerformances.map((sp) => sp.subjectId));
  const { dataSource, notes: dataSourceNotes } = mapProfileDataSource(profileSources);

  return {
    currentPeriod: currentPeriod
      ? {
          id: String(currentPeriod._id),
          name: currentPeriod.name || "",
          label: currentPeriod.label || currentPeriod.name || "",
        }
      : null,
    selectedPeriodId,
    selectedPeriodLabel: requestedPeriod
      ? requestedPeriod.label || requestedPeriod.name || null
      : currentPeriod
        ? currentPeriod.label || currentPeriod.name || null
        : null,
    availablePeriods: availablePeriods.map((p) => ({
      id: String(p._id),
      name: p.name || "",
      label: p.label || p.name || "",
    })),
    dataSource,
    dataSourceNotes,
    wards: wardSummaries,
    comparison,
    topPerformingSubjects,
    needsImprovementSubjects,
    overallSummary: {
      averageAcrossWards: overallAverage,
      highestPerformer: highestPerformer
        ? {
            wardId: highestPerformer.wardId,
            wardName: highestPerformer.wardName,
            average: highestPerformer.average,
          }
        : null,
      mostImproved:
        mostImproved && mostImproved.trend === "up"
          ? {
              wardId: mostImproved.wardId,
              wardName: mostImproved.wardName,
              improvement:
                (mostImproved.average || 0) - (mostImproved.previousAverage || 0),
            }
          : null,
      totalSubjects: uniqueSubjects.size,
    },
  };
}
