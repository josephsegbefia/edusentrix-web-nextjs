import type { ImportIssueV2 } from "@/lib/import-intelligence/types";
import type { ITeacherImportJob, ITeacherImportParsedRow } from "@/models/TeacherImportJob";

function rowRef(row: ITeacherImportParsedRow) { return row.rowRef || `T${String(row.sourceRowNumber).padStart(3, "0")}`; }
export function attentionSimilarityKey(issue: ImportIssueV2, row: ITeacherImportParsedRow) {
  const profile = [...row.subjectOfferingIds].sort().join(",") || row.subjects.map((value) => value.trim().toLowerCase()).sort().join(",");
  const classes = row.classScopeIds?.length ? "classes" : "no-classes";
  const assignments = row.explicitAssignments.some((item) => item.status === "resolved") ? "assignments" : "no-assignments";
  return [issue.issueType, issue.context?.gradeBand || "unknown", profile, classes, assignments, Boolean(row.homeroomClassGroupId || row.homeroomClass)].join("|");
}
export function findSimilarAttentionRows(job: ITeacherImportJob, issue: ImportIssueV2) {
  const source = job.parsedRows.find((row) => issue.rowRefs.includes(rowRef(row) as never));
  if (!source) return [];
  const key = attentionSimilarityKey(issue, source);
  return job.parsedRows.filter((row) => row.resolutionStatus === "needs_review" && rowRef(row) !== rowRef(source) && (row.issues.some((item) => item.groupedIssueId === issue.issueId) || (job.analysisIssues || []).some((candidate) => candidate.status === "open" && candidate.issueType === issue.issueType && candidate.rowRefs.includes(rowRef(row) as never) && attentionSimilarityKey(candidate, row) === key)));
}

export type SimilarResolutionTemplate = "TEACH_LISTED_SUBJECTS_IN_OWN_HOMEROOM" | "KEEP_BROAD_SUBJECT_PROFILE" | "KEEP_CROSS_STAGE_SUBJECTS";

export function templateForRelationshipPlan(plan: Record<string, unknown>, representative: ITeacherImportParsedRow): SimilarResolutionTemplate | null {
  const actions = Array.isArray(plan.resolvedActions) ? plan.resolvedActions as Array<Record<string, unknown>> : [];
  if (actions.some((action) => action.type === "add_assignment_proposal" && action.classGroupId === representative.homeroomClassGroupId)) return "TEACH_LISTED_SUBJECTS_IN_OWN_HOMEROOM";
  if (actions.length === 0 || actions.every((action) => action.type === "keep_existing" || action.type === "add_subject_profile")) return "KEEP_BROAD_SUBJECT_PROFILE";
  if (actions.some((action) => action.type === "keep_existing") && representative.subjectOfferingIds.length > 1) return "KEEP_CROSS_STAGE_SUBJECTS";
  return null;
}

export function similarityGroupId(plan: Record<string, unknown>) { return `similar_${String(plan.proposalId || plan.issueId)}`; }

export function findSimilarRowsForPlan(job: ITeacherImportJob, plan: Record<string, unknown>) {
  const issue = (job.analysisIssues || []).find((candidate) => candidate.issueId === String(plan.issueId));
  const representative = issue?.rowRefs.map((ref) => job.parsedRows.find((row) => rowRef(row) === ref)).find(Boolean);
  if (!issue || !representative) return { issue: null, representative: null, rows: [] };
  const key = attentionSimilarityKey(issue, representative);
  const rows = job.parsedRows.filter((row) => rowRef(row) !== rowRef(representative) && row.resolutionStatus === "needs_review" && (job.analysisIssues || []).some((candidate) => candidate.status === "open" && candidate.issueType === issue.issueType && candidate.rowRefs.includes(rowRef(row) as never) && attentionSimilarityKey(candidate, row) === key));
  return { issue, representative, rows };
}
