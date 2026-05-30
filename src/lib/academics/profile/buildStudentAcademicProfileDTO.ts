/**
 * Student Academic Profile builder — orchestrates engine snapshots, subject results,
 * attendance, and legacy fallback (slices 3–6). Slice 2: shell + safe empty profile.
 * @see STUDENT_ACADEMIC_PROFILE_SPEC.md §18
 */

import mongoose from "mongoose";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { School } from "@/models/School";
import { Student } from "@/models/Student";
import { listReleasedStudentReportCards } from "@/lib/academics/reporting/load-student-report-card";
import type {
  BuildStudentAcademicProfileParams,
  StudentAcademicProfileDTO,
} from "@/types/academics/student-academic-profile";
import type { SchoolLevelForAcademics } from "@/types/admin/student-academics";
import {
  buildAcademicProfilePeriodDTO,
  formatAcademicPeriodLabel,
  loadSchoolAcademicPeriods,
  resolveSelectedAcademicPeriod,
  toStringId,
  type IdLike,
} from "@/lib/academics/profile/academic-profile-periods";
import { createEmptyStudentAcademicProfile } from "@/lib/academics/profile/empty-academic-profile-sections";
import { tryApplyProfileFromReportCard } from "@/lib/academics/profile/buildProfileFromReportCard";
import { applyProfileAttendance } from "@/lib/academics/profile/buildAttendanceProfile";
import { tryApplyLegacyAcademicProfileFallback } from "@/lib/academics/profile/buildLegacyAcademicProfileFallback";
import { tryApplyProfileFromSubjectResults } from "@/lib/academics/profile/buildProfileFromSubjectResults";
import {
  buildAcademicAIInsightsContext,
  profileHasAcademicInsightData,
} from "@/lib/academics/profile/build-academic-ai-insights-context";
import { hydrateAcademicProfileTrends } from "@/lib/academics/profile/hydrate-academic-profile-trends";
import { computeDataFingerprint } from "@/lib/ai/dataFingerprint";
import {
  resolveAcademicProfileInsightMode,
  resolveAcademicProfilePermissions,
} from "@/lib/academics/profile/resolve-academic-profile-permissions";

export type { BuildStudentAcademicProfileParams };

/**
 * Builds the read-only Student Academic Profile for one student and period.
 * Data sources are filled in slices 3–6; until then returns a valid empty profile.
 */
export async function buildStudentAcademicProfileDTO(
  params: BuildStudentAcademicProfileParams
): Promise<StudentAcademicProfileDTO> {
  const schoolKey = toStringId(params.schoolId);
  const studentKey = toStringId(params.studentId);

  if (!schoolKey || !studentKey) {
    throw new Error("Missing schoolId or studentId");
  }

  const permissions = resolveAcademicProfilePermissions({
    visibilityMode: params.visibilityMode,
    allowProgressVisibility: params.allowProgressVisibility,
    allowedSubjectIds: params.allowedSubjectIds,
  });

  const insightMode = resolveAcademicProfileInsightMode(params.visibilityMode);

  const [schoolDoc, studentDoc] = await Promise.all([
    School.findById(schoolKey).select("type").lean(),
    Student.findOne({ _id: studentKey, schoolId: schoolKey })
      .select("_id classGroupId gradeId")
      .lean(),
  ]);

  if (!studentDoc) {
    throw new Error("Student not found");
  }

  const schoolLevel: SchoolLevelForAcademics | null = schoolDoc
    ? (schoolDoc as { type?: SchoolLevelForAcademics }).type === "SHS"
      ? "SHS"
      : "Basic"
    : null;

  const classGroupId = toStringId(
    (studentDoc as { classGroupId?: IdLike }).classGroupId
  );
  const gradeId = toStringId((studentDoc as { gradeId?: IdLike }).gradeId);

  const { periods: allPeriods, periodMap } =
    await loadSchoolAcademicPeriods(schoolKey);

  const schoolObjectId = new mongoose.Types.ObjectId(schoolKey);
  const studentObjectId = new mongoose.Types.ObjectId(studentKey);

  const releasedCards = await listReleasedStudentReportCards({
    schoolId: schoolObjectId,
    studentIds: [studentObjectId],
    academicPeriodIds: allPeriods.map((p) => p._id.toString()),
  });

  const releasedPeriodIds = new Set(
    releasedCards.map((card) => toStringId(card.academicPeriodId)).filter(Boolean) as string[]
  );

  const currentPeriodDoc = (await AcademicPeriod.findOne({
    schoolId: schoolKey,
    isCurrent: true,
  })
    .select("_id")
    .lean()) as { _id?: IdLike } | null;

  const currentPeriodId = toStringId(currentPeriodDoc?._id);

  const periodDtos = allPeriods.map((period) =>
    buildAcademicProfilePeriodDTO(period, {
      releasedPeriodIds,
      currentPeriodId,
    })
  );

  if (allPeriods.length === 0) {
    return createEmptyStudentAcademicProfile({
      studentId: studentKey,
      schoolId: schoolKey,
      classGroupId,
      gradeId,
      schoolLevel,
      visibilityMode: params.visibilityMode,
      permissions,
      insightMode,
      dataSourceNotes: ["No academic periods configured for this school."],
    });
  }

  let selectedPeriod = await resolveSelectedAcademicPeriod({
    schoolId: schoolKey,
    academicPeriodId: params.academicPeriodId,
    periodMap,
    allPeriods,
  });

  // Prefer latest released period when current period has no official data (§8).
  if (
    selectedPeriod &&
    currentPeriodId &&
    selectedPeriod._id.toString() === currentPeriodId &&
    !releasedPeriodIds.has(currentPeriodId)
  ) {
    const latestReleased = [...allPeriods]
      .filter((p) => releasedPeriodIds.has(p._id.toString()))
      .sort(
        (a, b) =>
          new Date(b.endDate).getTime() - new Date(a.endDate).getTime()
      )[0];

    if (latestReleased) {
      selectedPeriod = latestReleased;
    }
  }

  const selectedPeriodId = selectedPeriod
    ? selectedPeriod._id.toString()
    : null;
  const selectedPeriodLabel = selectedPeriod
    ? formatAcademicPeriodLabel(selectedPeriod)
    : null;

  const profile = createEmptyStudentAcademicProfile({
    studentId: studentKey,
    schoolId: schoolKey,
    classGroupId,
    gradeId,
    schoolLevel,
    visibilityMode: params.visibilityMode,
    permissions,
    insightMode,
    selectedPeriodId,
    selectedPeriodLabel,
    periods: periodDtos,
    recordStatus: "no_data",
  });

  // Slices 3–6 populate subjectResults, summary, attendance, etc.
  await applyProfileDataSources(profile, {
    schoolId: schoolObjectId,
    studentId: studentObjectId,
    selectedPeriodId,
    visibilityMode: params.visibilityMode,
    permissions,
    releasedPeriodIds,
    allowProgressVisibility: params.allowProgressVisibility,
  });

  const periodLabelById = new Map(
    periodDtos.map((period) => [period.academicPeriodId, period.label])
  );

  hydrateAcademicProfileTrends({
    profile,
    releasedCards,
    periodOrder: periodDtos.map((period) => period.academicPeriodId),
    periodLabelById,
  });

  const studentDocForName = studentDoc as {
    firstName?: string | null;
    lastName?: string | null;
  };
  const studentName = `${studentDocForName.firstName ?? ""} ${studentDocForName.lastName ?? ""}`.trim();
  const insightContext = buildAcademicAIInsightsContext(profile, studentName);

  profile.aiInsights = {
    mode: profile.aiInsights.mode,
    available: profileHasAcademicInsightData(profile),
    isStale: false,
    generatedAt: profile.aiInsights.generatedAt,
    dataFingerprint: computeDataFingerprint(insightContext),
  };

  return profile;
}

async function applyProfileDataSources(
  profile: StudentAcademicProfileDTO,
  context: {
    schoolId: mongoose.Types.ObjectId;
    studentId: mongoose.Types.ObjectId;
    selectedPeriodId: string | null;
    visibilityMode: BuildStudentAcademicProfileParams["visibilityMode"];
    permissions: StudentAcademicProfileDTO["permissions"];
    releasedPeriodIds: Set<string>;
    allowProgressVisibility?: boolean;
  }
): Promise<void> {
  await tryApplyProfileFromReportCard(profile, {
    schoolId: context.schoolId,
    studentId: context.studentId,
    academicPeriodId: context.selectedPeriodId,
    visibilityMode: context.visibilityMode,
    permissions: context.permissions,
  });

  if (profile.dataSource !== "report_snapshot") {
    await tryApplyProfileFromSubjectResults(profile, {
      schoolId: context.schoolId,
      studentId: context.studentId,
      academicPeriodId: context.selectedPeriodId,
      visibilityMode: context.visibilityMode,
      permissions: context.permissions,
      allowProgressVisibility: context.allowProgressVisibility,
    });
  }

  await applyProfileAttendance(profile, {
    schoolId: context.schoolId,
    studentId: context.studentId,
    academicPeriodId: context.selectedPeriodId,
    classGroupId: profile.classGroupId,
    visibilityMode: context.visibilityMode,
    isReleasedPeriod: context.selectedPeriodId
      ? context.releasedPeriodIds.has(context.selectedPeriodId)
      : false,
  });

  await tryApplyLegacyAcademicProfileFallback(profile, {
    schoolId: context.schoolId,
    studentId: context.studentId,
    academicPeriodId: context.selectedPeriodId,
  });
}
