/**
 * Legacy gradebook (CA/exam hardcoded) — retired in Assessment Engine Slice 23.
 *
 * Official mark entry, calculation, and submission use:
 * - UI: /teacher/marks/[classGroupId]/[subjectId]
 * - API: /api/teacher/marks/gradebooks/[classGroupId]/[subjectId]
 * - Submit: /api/teacher/marks/subject-results/submit
 *
 * See docs/LEGACY_GRADEBOOK_MIGRATION.md
 */

export const LEGACY_GRADEBOOK_MIGRATION_DOC = "docs/LEGACY_GRADEBOOK_MIGRATION.md";

export const LEGACY_GRADEBOOK_SUCCESSOR = {
  marksList: "/teacher/marks",
  marksWorkspace(classGroupId: string, subjectId: string) {
    return `/teacher/marks/${classGroupId}/${subjectId}`;
  },
  gradebookApi(classGroupId: string, subjectId: string) {
    return `/api/teacher/marks/gradebooks/${classGroupId}/${subjectId}`;
  },
  submitSubjectResult: "/api/teacher/marks/subject-results/submit",
  previewSubjectResult: "/api/teacher/marks/subject-results/preview",
} as const;

export type LegacyGradebookDeprecatedOptions = {
  classGroupId?: string;
  subjectId?: string;
  action?: string;
};

function resolveSuccessorPath(options?: LegacyGradebookDeprecatedOptions) {
  if (options?.classGroupId && options?.subjectId) {
    return LEGACY_GRADEBOOK_SUCCESSOR.marksWorkspace(
      options.classGroupId,
      options.subjectId
    );
  }
  return LEGACY_GRADEBOOK_SUCCESSOR.marksList;
}

export function legacyGradebookDeprecatedMessage(
  options?: LegacyGradebookDeprecatedOptions
) {
  const successor = resolveSuccessorPath(options);
  const action = options?.action ? ` (${options.action})` : "";
  return `The legacy gradebook${action} is retired. Use Marks & Reports at ${successor} with your school's assessment plan and grading policy.`;
}

export function legacyGradebookDeprecatedResponse(
  options?: LegacyGradebookDeprecatedOptions
) {
  const successor = resolveSuccessorPath(options);
  const apiSuccessor =
    options?.classGroupId && options?.subjectId
      ? LEGACY_GRADEBOOK_SUCCESSOR.gradebookApi(
          options.classGroupId,
          options.subjectId
        )
      : null;

  return Response.json(
    {
      success: false,
      error: legacyGradebookDeprecatedMessage(options),
      deprecated: true,
      legacy: true,
      successor,
      successorApi: apiSuccessor,
      migrationDoc: LEGACY_GRADEBOOK_MIGRATION_DOC,
    },
    {
      status: 410,
      headers: {
        Deprecation: "true",
        Link: `<${successor}>; rel="successor-version"`,
      },
    }
  );
}
