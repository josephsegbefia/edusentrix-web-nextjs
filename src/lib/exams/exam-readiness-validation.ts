import type {
  ExamConflictDTO,
  ExamEntryMissingAssessmentLinkDTO,
  ExamPublishReadinessIssueDTO,
} from "@/types/academics/exam-scheduling-engine";
import {
  computeExamReadinessScore,
  summarizeActiveConflicts,
} from "@/lib/exams/exam-conflict-detection";

export type ExamPublishReadinessEntryInput = {
  id: string;
  isUnscheduled: boolean;
  status: string;
};

export function conflictToReadinessIssue(conflict: ExamConflictDTO): ExamPublishReadinessIssueDTO {
  return {
    key: conflict.key,
    type: conflict.type,
    severity: conflict.severity,
    message: conflict.message,
    affectedEntryIds: conflict.affectedEntryIds,
    canOverride: conflict.canOverride,
    isOverridden: Boolean(conflict.isOverridden),
    suggestion: conflict.suggestion,
  };
}

export function buildUnscheduledEntryIssues(
  entries: ExamPublishReadinessEntryInput[]
): ExamPublishReadinessIssueDTO[] {
  return entries
    .filter((entry) => entry.isUnscheduled && entry.status !== "cancelled")
    .map((entry) => ({
      key: `unscheduled:${entry.id}`,
      type: "unscheduled_entry",
      severity: "error" as const,
      message: "Exam paper is not scheduled with a date and time.",
      affectedEntryIds: [entry.id],
      canOverride: false,
      isOverridden: false,
      suggestion: "Schedule the paper before publishing the timetable.",
    }));
}

export function buildMissingAssessmentLinkIssues(
  missing: ExamEntryMissingAssessmentLinkDTO[]
): ExamPublishReadinessIssueDTO[] {
  return missing.map((entry) => ({
    key: `missing_assessment_link:${entry.entryId}`,
    type: "missing_assessment_link",
    severity: "error" as const,
    message: entry.title
      ? `${entry.title} is missing assessment links for one or more class groups.`
      : "A report-contributing exam paper is missing assessment links.",
    affectedEntryIds: [entry.entryId],
    canOverride: false,
    isOverridden: false,
    suggestion: "Create or link assessment items before publishing.",
  }));
}

export function buildNoEntriesIssue(): ExamPublishReadinessIssueDTO {
  return {
    key: "no_entries",
    type: "no_entries",
    severity: "error",
    message: "Add at least one exam paper before publishing.",
    affectedEntryIds: [],
    canOverride: false,
    isOverridden: false,
    suggestion: "Create exam papers or generate draft entries first.",
  };
}

export function computePublishEligibility(input: {
  entryCount: number;
  blockingIssues: ExamPublishReadinessIssueDTO[];
}) {
  if (input.entryCount <= 0) {
    return false;
  }

  return input.blockingIssues.length === 0;
}

export function buildPublishReadinessSummary(input: {
  entries: ExamPublishReadinessEntryInput[];
  conflicts: ExamConflictDTO[];
  missingAssessmentLinks: ExamEntryMissingAssessmentLinkDTO[];
  requiredEntryCount: number;
  completeEntryCount: number;
}) {
  const activeEntries = input.entries.filter((entry) => entry.status !== "cancelled");
  const { grouped } = summarizeActiveConflicts(input.conflicts);

  const conflictBlocking = grouped.errors.map(conflictToReadinessIssue);
  const conflictWarnings = grouped.warnings.map(conflictToReadinessIssue);
  const conflictInfo = grouped.info.map(conflictToReadinessIssue);

  const unscheduledIssues = buildUnscheduledEntryIssues(activeEntries);
  const assessmentIssues = buildMissingAssessmentLinkIssues(input.missingAssessmentLinks);

  const blockingIssues = [
    ...(activeEntries.length === 0 ? [buildNoEntriesIssue()] : []),
    ...conflictBlocking,
    ...unscheduledIssues,
    ...assessmentIssues,
  ];

  const warnings = conflictWarnings;
  const infoNotices = conflictInfo;

  const readinessScore = computeExamReadinessScore({
    errorCount: blockingIssues.length,
    warningCount: warnings.length,
    entryCount: activeEntries.length,
  });

  return {
    entryCount: activeEntries.length,
    scheduledEntryCount: activeEntries.filter((entry) => !entry.isUnscheduled).length,
    unscheduledEntryCount: activeEntries.filter((entry) => entry.isUnscheduled).length,
    blockingIssues,
    warnings,
    infoNotices,
    blockingCount: blockingIssues.length,
    warningCount: warnings.length,
    infoCount: infoNotices.length,
    missingAssessmentLinkCount: input.missingAssessmentLinks.length,
    readinessScore,
    canPublish: computePublishEligibility({
      entryCount: activeEntries.length,
      blockingIssues,
    }),
    assessmentLinks: {
      requiredEntryCount: input.requiredEntryCount,
      completeEntryCount: input.completeEntryCount,
      missing: input.missingAssessmentLinks,
    },
    conflictSummary: {
      total: input.conflicts.length,
      errors: grouped.errors.length,
      warnings: grouped.warnings.length,
      info: grouped.info.length,
      overridden: input.conflicts.filter((row) => row.isOverridden).length,
    },
  };
}
