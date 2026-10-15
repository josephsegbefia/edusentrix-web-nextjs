import type { ImportIssueV2, ImportRowReference } from "@/lib/import-intelligence/types";
import type { ITeacherImportParsedRow } from "@/models/TeacherImportJob";

export type TeacherImportReviewStateInput = {
  parsedRows?: ITeacherImportParsedRow[];
  analysisIssues?: ImportIssueV2[];
};

export type TeacherImportReviewState = {
  totalRows: number;
  readyCount: number;
  attentionCount: number;
  blockedCount: number;
  unresolvedIssues: ImportIssueV2[];
  canProceedToFinalConfirmation: boolean;
};

/** The single effective review-state calculation used by UI and final confirmation. */
export function getTeacherImportReviewState(job: TeacherImportReviewStateInput): TeacherImportReviewState {
  const rows = job.parsedRows || [];
  const unresolvedIssues = (job.analysisIssues || []).filter((issue) => issue.status === "open");
  const globalBlocking = unresolvedIssues.some((issue) => issue.rowRefs.length === 0 && (issue.resolutionClass === "BLOCKING" || issue.severity === "blocking"));
  const openByRow = new Map<string, ImportIssueV2[]>();
  for (const issue of unresolvedIssues) {
    for (const rowRef of issue.rowRefs) {
      const current = openByRow.get(rowRef) || [];
      current.push(issue);
      openByRow.set(rowRef, current);
    }
  }
  let readyCount = 0;
  let attentionCount = 0;
  let blockedCount = 0;
  for (const row of rows) {
    const ref = (row.rowRef || `T${String(row.sourceRowNumber).padStart(3, "0")}`) as ImportRowReference;
    const rowIssues = openByRow.get(ref) || [];
    const status = effectiveRowStatus(row, rowIssues, globalBlocking);
    if (status === "blocked") blockedCount += 1;
    else if (status === "needs_review") attentionCount += 1;
    else readyCount += 1;
  }
  return { totalRows: rows.length, readyCount, attentionCount, blockedCount, unresolvedIssues, canProceedToFinalConfirmation: attentionCount === 0 && blockedCount === 0 };
}

export function effectiveTeacherImportRowStatus(row: ITeacherImportParsedRow, unresolvedIssues: ImportIssueV2[] = [], globalBlocking = false) {
  if (globalBlocking || row.resolutionStatus === "blocked" || unresolvedIssues.some((issue) => issue.resolutionClass === "BLOCKING" || issue.severity === "blocking")) return "blocked" as const;
  if (row.resolutionStatus === "needs_review" || unresolvedIssues.length > 0) return "needs_review" as const;
  return "resolved" as const;
}

function effectiveRowStatus(row: ITeacherImportParsedRow, unresolvedIssues: ImportIssueV2[], globalBlocking: boolean) {
  return effectiveTeacherImportRowStatus(row, unresolvedIssues, globalBlocking);
}

export function refreshTeacherImportReviewState(job: TeacherImportStateInputWithSummary) {
  const state = getTeacherImportReviewState(job);
  if (job.analysisSummary) {
    job.analysisSummary.totalRows = state.totalRows;
    job.analysisSummary.readyRows = state.readyCount;
    job.analysisSummary.needsReviewRows = state.attentionCount;
    job.analysisSummary.blockedRows = state.blockedCount;
    job.analysisSummary.reviewIssues = state.unresolvedIssues.filter((issue) => issue.resolutionClass === "REVIEW").length;
    job.analysisSummary.groupedReviewIssues = state.unresolvedIssues.filter((issue) => issue.scope === "group" && issue.resolutionClass === "REVIEW").length;
    job.analysisSummary.blockingIssues = state.unresolvedIssues.filter((issue) => issue.resolutionClass === "BLOCKING").length;
  }
  return state;
}

type TeacherImportStateInputWithSummary = TeacherImportReviewStateInput & { analysisSummary?: { totalRows?: number; readyRows?: number; needsReviewRows?: number; blockedRows?: number; reviewIssues?: number; groupedReviewIssues?: number; blockingIssues?: number } | null };
