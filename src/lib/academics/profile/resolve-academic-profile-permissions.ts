import type {
  AcademicProfileInsightMode,
  AcademicProfilePermissionsDTO,
  AcademicProfileVisibilityMode,
} from "@/types/academics/student-academic-profile";

export function resolveAcademicProfileInsightMode(
  visibilityMode: AcademicProfileVisibilityMode
): AcademicProfileInsightMode {
  switch (visibilityMode) {
    case "admin":
      return "admin";
    case "homeroom_teacher":
    case "subject_teacher":
      return "teacher";
    case "parent":
      return "parent";
    case "student":
      return "student";
    default: {
      const _exhaustive: never = visibilityMode;
      return _exhaustive;
    }
  }
}

/** Role-aware UI/action flags for the academic profile (spec §17). */
export function resolveAcademicProfilePermissions(input: {
  visibilityMode: AcademicProfileVisibilityMode;
  allowProgressVisibility?: boolean;
  allowedSubjectIds?: string[] | null;
}): AcademicProfilePermissionsDTO {
  const { visibilityMode, allowProgressVisibility = false, allowedSubjectIds } =
    input;

  const isStaff =
    visibilityMode === "admin" ||
    visibilityMode === "homeroom_teacher" ||
    visibilityMode === "subject_teacher";

  const isAdmin = visibilityMode === "admin";
  const isHomeroom = visibilityMode === "homeroom_teacher";
  const isSubjectTeacher = visibilityMode === "subject_teacher";
  const isParentOrStudent =
    visibilityMode === "parent" || visibilityMode === "student";

  const canViewProvisionalScores =
    isStaff || (isParentOrStudent && allowProgressVisibility);

  return {
    canViewProvisionalScores,
    canViewProjectedAverage: isStaff,
    canViewReadiness: isAdmin || isHomeroom,
    canViewMissingMarks: isStaff,
    canViewInternalNotes: isAdmin,
    canViewBreakdown: isStaff || (isParentOrStudent && allowProgressVisibility),
    canDownloadReport: true,
    canViewReportCard: true,
    canGenerateInsights: isStaff,
    visibleSubjectIds: isSubjectTeacher ? (allowedSubjectIds ?? null) : null,
  };
}
