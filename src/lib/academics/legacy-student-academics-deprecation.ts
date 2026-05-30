/**
 * Legacy `StudentAcademicsDTO` (CA/exam-shaped) — superseded by Student Academic Profile.
 *
 * @see docs/STUDENT_ACADEMIC_PROFILE_LEGACY_DTO_DEPRECATION.md
 * @see STUDENT_ACADEMIC_PROFILE_SPEC.md Slice 21
 */

export const LEGACY_STUDENT_ACADEMICS_MIGRATION_DOC =
  "docs/STUDENT_ACADEMIC_PROFILE_LEGACY_DTO_DEPRECATION.md";

export const LEGACY_STUDENT_ACADEMICS_SUCCESSOR = {
  profileBuilder: "src/lib/academics/profile/buildStudentAcademicProfileDTO.ts",
  adminProfileApi: (studentId: string) =>
    `/api/admin/students/${studentId}/academic-profile`,
  parentWardProfileApi: (wardId: string) =>
    `/api/parent/wards/${wardId}/academic-profile`,
  studentProfileApi: "/api/student/academic-profile",
} as const;

export type LegacyStudentAcademicsConsumer =
  | "api.admin.students.academics"
  | "api.parent.wards.academics"
  | "api.student.results"
  | "api.parent.reports.download.legacy_pdf"
  | "hook.admin.useStudentAcademics"
  | "hook.parent.useWardAcademics"
  | "ui.admin.StudentAcademicsTab.fallback"
  | "ui.parent.wardOverview"
  | "builder.buildStudentAcademicsDTO";

/** Inventory of known call sites (update when migrating). */
export const LEGACY_STUDENT_ACADEMICS_CONSUMERS: Record<
  LegacyStudentAcademicsConsumer,
  { status: "active" | "compat_wrapper" | "profile_first" | "deprecated_route"; notes: string }
> = {
  "builder.buildStudentAcademicsDTO": {
    status: "compat_wrapper",
    notes: "Implementation retained; new code must use buildStudentAcademicProfileDTO.",
  },
  "api.admin.students.academics": {
    status: "compat_wrapper",
    notes: "Legacy DTO for admin tab charts fallback; Deprecation header on response.",
  },
  "api.parent.wards.academics": {
    status: "profile_first",
    notes: "Maps academic profile to legacy DTO for ward overview cards.",
  },
  "api.student.results": {
    status: "deprecated_route",
    notes: "Returns HTTP 410; use GET /api/student/academic-profile.",
  },
  "api.parent.reports.download.legacy_pdf": {
    status: "profile_first",
    notes: "Released snapshot PDF only via buildSnapshotReportCardPdf; legacy DTO PDF removed.",
  },
  "hook.admin.useStudentAcademics": {
    status: "compat_wrapper",
    notes: "Fetched only when profile trends need legacy fallback.",
  },
  "hook.parent.useWardAcademics": {
    status: "profile_first",
    notes: "Calls compat ward academics API (profile-mapped).",
  },
  "ui.admin.StudentAcademicsTab.fallback": {
    status: "compat_wrapper",
    notes: "Dual fetch reduced: legacy query skipped when profile is sufficient.",
  },
  "ui.parent.wardOverview": {
    status: "profile_first",
    notes: "Overview metrics via mapped profile DTO.",
  },
};

export function legacyStudentAcademicsDeprecationMessage(surface?: string) {
  const suffix = surface ? ` (${surface})` : "";
  return `The legacy StudentAcademicsDTO${suffix} is deprecated. Use the Student Academic Profile API and types in src/types/academics/student-academic-profile.ts. See ${LEGACY_STUDENT_ACADEMICS_MIGRATION_DOC}.`;
}

export function legacyStudentAcademicsDeprecationHeaders(successor?: string) {
  return {
    Deprecation: "true",
    Sunset: "TBD",
    Link: successor
      ? `<${successor}>; rel="successor-version"`
      : `<${LEGACY_STUDENT_ACADEMICS_MIGRATION_DOC}>; rel="deprecation"`,
    "X-Legacy-DTO": "StudentAcademicsDTO",
  } as const;
}
