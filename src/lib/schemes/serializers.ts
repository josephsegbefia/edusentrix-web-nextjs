import type { ISchemeItem, SchemeItemCoverageStatus } from "@/models/SchemeItem";
import type { ISchemeOfWork } from "@/models/SchemeOfWork";
import type { ISchemeReview } from "@/models/SchemeReview";
import type { SchemeStatus } from "@/types/schemes";

function normalizeSchemeStatus(status: unknown): SchemeStatus {
  if (status === "in_review") return "submitted";
  if (
    status === "draft" ||
    status === "submitted" ||
    status === "needs_revision" ||
    status === "approved" ||
    status === "active" ||
    status === "archived" ||
    status === "rejected"
  ) {
    return status;
  }
  return "draft";
}

export function serializeSchemeRow(row: ISchemeOfWork) {
  return {
    id: String(row._id),
    title: row.title,
    description: row.description ?? null,
    status: normalizeSchemeStatus(row.status),
    academicYearLabel: row.academicYearLabel ?? null,
    termLabel: row.termLabel ?? null,
    academicPeriodId: row.academicPeriodId ? String(row.academicPeriodId) : null,
    academicYearId: row.academicYearId ? String(row.academicYearId) : null,
    termId: row.termId ? String(row.termId) : null,
    curriculumId: row.curriculumId ? String(row.curriculumId) : null,
    curriculumSubjectId: row.curriculumSubjectId ? String(row.curriculumSubjectId) : null,
    gradeId: row.gradeId ? String(row.gradeId) : null,
    classGroupId: row.classGroupId ? String(row.classGroupId) : null,
    subjectOfferingId: row.subjectOfferingId ? String(row.subjectOfferingId) : null,
    subjectId: row.subjectId ? String(row.subjectId) : null,
    ownerTeacherId: row.ownerTeacherId ? String(row.ownerTeacherId) : null,
    sourceType: row.sourceType ?? "manual",
    version: row.version ?? 1,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export function serializeSchemeItemRow(row: ISchemeItem) {
  const coverageStatus = (row.coverageStatus ?? "not_started") as SchemeItemCoverageStatus;
  return {
    id: String(row._id),
    schemeId: String(row.schemeId),
    weekNumber: row.weekNumber ?? null,
    lessonOrder: row.lessonOrder ?? null,
    sequence: row.sequence,
    topic: row.topic ?? null,
    subtopic: row.subtopic ?? null,
    title: row.title ?? row.topic ?? "",
    strand: row.strand ?? null,
    subStrand: row.subStrand ?? null,
    contentStandard: row.contentStandard ?? null,
    indicator: row.indicator ?? null,
    learningObjectives: row.learningObjectives ?? [],
    learningObjective: row.learningObjective ?? null,
    coreCompetencies: row.coreCompetencies ?? [],
    teachingResources: row.teachingResources ?? [],
    assessmentIdeas: row.assessmentIdeas ?? [],
    notes: row.notes ?? null,
    plannedStartDate: row.plannedStartDate
      ? new Date(row.plannedStartDate).toISOString()
      : null,
    plannedEndDate: row.plannedEndDate
      ? new Date(row.plannedEndDate).toISOString()
      : null,
    curriculumNodeIds: (row.curriculumNodeIds || []).map((id) => String(id)),
    suggestedLessonTemplateType: row.suggestedLessonTemplateType ?? null,
    suggestedDurationMinutes: row.suggestedDurationMinutes ?? null,
    status: row.status,
    coverageStatus,
    coverageNote: row.coverageNote ?? null,
    coverageUpdatedAt: row.coverageUpdatedAt
      ? new Date(row.coverageUpdatedAt).toISOString()
      : null,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export function serializeSchemeReviewRow(row: ISchemeReview) {
  return {
    id: String(row._id),
    schemeId: String(row.schemeId),
    decision: row.decision,
    note: row.note ?? null,
    actorUserId: String(row.actorUserId),
    actorTeacherId: row.actorTeacherId ? String(row.actorTeacherId) : null,
    actorRole: row.actorRole ?? null,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}
