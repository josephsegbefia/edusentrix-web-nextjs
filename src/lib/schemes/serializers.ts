import type { ISchemeItem, SchemeItemCoverageStatus } from "@/models/SchemeItem";
import type { ISchemeOfWork } from "@/models/SchemeOfWork";
import type { ISchemeReview } from "@/models/SchemeReview";

export function serializeSchemeRow(row: ISchemeOfWork) {
  return {
    id: String(row._id),
    title: row.title,
    description: row.description ?? null,
    status: row.status,
    academicYearLabel: row.academicYearLabel ?? null,
    termLabel: row.termLabel ?? null,
    gradeId: row.gradeId ? String(row.gradeId) : null,
    subjectId: row.subjectId ? String(row.subjectId) : null,
    ownerTeacherId: row.ownerTeacherId ? String(row.ownerTeacherId) : null,
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
    sequence: row.sequence,
    title: row.title,
    learningObjective: row.learningObjective ?? null,
    notes: row.notes ?? null,
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
    createdAt: new Date(row.createdAt).toISOString(),
  };
}
