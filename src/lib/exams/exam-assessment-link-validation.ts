import { EXAM_TIMETABLE_ENTRY_SOURCE_REF_TYPE } from "@/constants/academics/exam-scheduling-engine";
import type {
  ExamAssessmentLinkClassGroupRowDTO,
  ExamAssessmentLinkStatusDTO,
  ExamEntryMissingAssessmentLinkDTO,
} from "@/types/academics/exam-scheduling-engine";

export type ExamAssessmentLinkEntryInput = {
  id: string;
  title?: string | null;
  subjectId: string;
  academicPeriodId: string;
  classGroupIds: string[];
  contributesToReport: boolean;
  assessmentComponentKey: string | null;
  maxScore: number | null;
  assessmentItemId?: string | null;
};

export type ExamAssessmentLinkItemInput = {
  id: string;
  schoolId: string;
  academicPeriodId: string;
  subjectId: string;
  classGroupId: string;
  contributesToReport: boolean;
  componentKey: string | null;
  maxScore: number;
  sourceRefType: string | null;
  sourceRefId: string | null;
  status: string;
};

const LOCKED_ITEM_STATUSES = new Set(["locked", "archived"]);

export function entryRequiresAssessmentLink(entry: Pick<ExamAssessmentLinkEntryInput, "contributesToReport">) {
  return entry.contributesToReport;
}

export function validateAssessmentItemForExamEntryLink(input: {
  entry: ExamAssessmentLinkEntryInput;
  item: ExamAssessmentLinkItemInput;
  classGroupId: string;
  schoolId: string;
}): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const { entry, item, classGroupId, schoolId } = input;

  if (item.schoolId !== schoolId) {
    errors.push("Assessment item must belong to the same school.");
  }

  if (!entry.classGroupIds.includes(classGroupId)) {
    errors.push("Class group is not part of this exam entry.");
  }

  if (item.classGroupId !== classGroupId) {
    errors.push("Assessment item class group does not match the selected class group.");
  }

  if (item.subjectId !== entry.subjectId) {
    errors.push("Assessment item subject must match the exam entry subject.");
  }

  if (item.academicPeriodId !== entry.academicPeriodId) {
    errors.push("Assessment item academic period must match the exam session period.");
  }

  if (entry.contributesToReport && !item.contributesToReport) {
    errors.push("Report-contributing exams require an assessment item that contributes to the report.");
  }

  if (
    entry.assessmentComponentKey &&
    item.componentKey &&
    item.componentKey !== entry.assessmentComponentKey
  ) {
    errors.push("Assessment item component must match the exam entry component.");
  }

  if (entry.maxScore !== null && item.maxScore !== entry.maxScore) {
    errors.push("Assessment item max score must match the exam entry max score.");
  }

  if (LOCKED_ITEM_STATUSES.has(item.status)) {
    errors.push("Locked or archived assessment items cannot be linked.");
  }

  if (
    item.sourceRefType === EXAM_TIMETABLE_ENTRY_SOURCE_REF_TYPE &&
    item.sourceRefId &&
    item.sourceRefId !== entry.id
  ) {
    errors.push("Assessment item is already linked to another exam timetable entry.");
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export function buildLinkedClassGroupIds(
  entry: ExamAssessmentLinkEntryInput,
  linkedItems: ExamAssessmentLinkItemInput[]
): Set<string> {
  const linked = new Set<string>();

  for (const classGroupId of entry.classGroupIds) {
    const match = linkedItems.find(
      (item) =>
        item.classGroupId === classGroupId &&
        (item.sourceRefType === EXAM_TIMETABLE_ENTRY_SOURCE_REF_TYPE
          ? item.sourceRefId === entry.id
          : item.id === entry.assessmentItemId)
    );
    if (match) {
      linked.add(classGroupId);
    }
  }

  return linked;
}

export function isExamEntryAssessmentLinkComplete(
  entry: ExamAssessmentLinkEntryInput,
  linkedItems: ExamAssessmentLinkItemInput[]
) {
  if (!entryRequiresAssessmentLink(entry)) {
    return true;
  }

  const linkedClassGroupIds = buildLinkedClassGroupIds(entry, linkedItems);
  return entry.classGroupIds.every((classGroupId) => linkedClassGroupIds.has(classGroupId));
}

export function buildExamAssessmentLinkStatus(input: {
  entry: ExamAssessmentLinkEntryInput;
  linkedItems: ExamAssessmentLinkItemInput[];
  classGroupNames?: Record<string, string | null>;
  schoolId: string;
}): ExamAssessmentLinkStatusDTO {
  const { entry, linkedItems, classGroupNames, schoolId } = input;
  const required = entryRequiresAssessmentLink(entry);
  const validationErrors: string[] = [];

  const classGroups: ExamAssessmentLinkClassGroupRowDTO[] = entry.classGroupIds.map((classGroupId) => {
    const linkedItem = linkedItems.find(
      (item) =>
        item.classGroupId === classGroupId &&
        item.sourceRefType === EXAM_TIMETABLE_ENTRY_SOURCE_REF_TYPE &&
        item.sourceRefId === entry.id
    );

    if (!required) {
      return {
        classGroupId,
        classGroupName: classGroupNames?.[classGroupId] ?? null,
        linkedAssessmentItemId: linkedItem?.id ?? null,
        status: "not_required",
        validationErrors: [],
      };
    }

    if (!linkedItem) {
      validationErrors.push(`Missing assessment link for class group ${classGroupId}.`);
      return {
        classGroupId,
        classGroupName: classGroupNames?.[classGroupId] ?? null,
        linkedAssessmentItemId: null,
        status: "missing",
        validationErrors: ["No linked assessment item."],
      };
    }

    const itemValidation = validateAssessmentItemForExamEntryLink({
      entry,
      item: linkedItem,
      classGroupId,
      schoolId,
    });

    const rowErrors = itemValidation.ok ? [] : itemValidation.errors;
    validationErrors.push(...rowErrors);

    return {
      classGroupId,
      classGroupName: classGroupNames?.[classGroupId] ?? null,
      linkedAssessmentItemId: linkedItem.id,
      status: rowErrors.length === 0 ? "linked" : "missing",
      validationErrors: rowErrors,
    };
  });

  const isComplete = isExamEntryAssessmentLinkComplete(entry, linkedItems);

  return {
    entryId: entry.id,
    contributesToReport: entry.contributesToReport,
    required,
    isComplete,
    assessmentComponentKey: entry.assessmentComponentKey,
    maxScore: entry.maxScore,
    classGroups,
    validationErrors: [...new Set(validationErrors)],
  };
}

export function listMissingAssessmentLinkEntries(input: {
  entries: ExamAssessmentLinkEntryInput[];
  linkedItemsByEntryId: Record<string, ExamAssessmentLinkItemInput[]>;
}): ExamEntryMissingAssessmentLinkDTO[] {
  const missing: ExamEntryMissingAssessmentLinkDTO[] = [];

  for (const entry of input.entries) {
    if (!entryRequiresAssessmentLink(entry)) continue;

    const linkedItems = input.linkedItemsByEntryId[entry.id] ?? [];
    const linkedClassGroupIds = buildLinkedClassGroupIds(entry, linkedItems);
    const missingClassGroupIds = entry.classGroupIds.filter(
      (classGroupId) => !linkedClassGroupIds.has(classGroupId)
    );

    if (missingClassGroupIds.length === 0) continue;

    missing.push({
      entryId: entry.id,
      title: entry.title ?? null,
      subjectId: entry.subjectId,
      classGroupIds: entry.classGroupIds,
      missingClassGroupIds,
      contributesToReport: entry.contributesToReport,
      assessmentComponentKey: entry.assessmentComponentKey,
    });
  }

  return missing;
}

export function resolvePrimaryAssessmentItemId(
  entry: ExamAssessmentLinkEntryInput,
  linkedItems: ExamAssessmentLinkItemInput[]
): string | null {
  if (!isExamEntryAssessmentLinkComplete(entry, linkedItems)) {
    return null;
  }

  const firstClassGroupId = entry.classGroupIds[0];
  if (!firstClassGroupId) return null;

  const linkedItem = linkedItems.find(
    (item) =>
      item.classGroupId === firstClassGroupId &&
      item.sourceRefType === EXAM_TIMETABLE_ENTRY_SOURCE_REF_TYPE &&
      item.sourceRefId === entry.id
  );

  return linkedItem?.id ?? entry.assessmentItemId ?? null;
}

export function isExamEntryReadyForAssessmentReporting(
  entry: ExamAssessmentLinkEntryInput,
  linkedItems: ExamAssessmentLinkItemInput[]
) {
  if (!entryRequiresAssessmentLink(entry)) {
    return true;
  }

  return buildExamAssessmentLinkStatus({
    entry,
    linkedItems,
    schoolId: linkedItems[0]?.schoolId ?? "",
  }).isComplete;
}
