import type { ImportDomain, ImportIssueV2, ImportReviewDto } from "./types";
import { createImportIssue } from "./issues";
import { compatibilityForImportJob } from "./versioning";

type PlainRecord = Record<string, unknown>;

export function toImportPlainJson(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Uint8Array && !Buffer.isBuffer(value)) return Array.from(value);
  if (Buffer.isBuffer(value)) return `[buffer:${value.length}]`;
  const candidate = value as { toObject?: (options?: { flattenMaps?: boolean }) => unknown };
  if (typeof candidate.toObject === "function") return toImportPlainJson(candidate.toObject({ flattenMaps: true }), seen);
  if (seen.has(value)) return undefined;
  seen.add(value);
  if (value instanceof Map) return Object.fromEntries([...value.entries()].map(([key, item]) => [String(key), toImportPlainJson(item, seen)]));
  if (Array.isArray(value)) return value.map((item) => toImportPlainJson(item, seen));
  const result: PlainRecord = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === "_doc" || key === "$__" || key === "$isNew" || key.startsWith("$")) continue;
    const plain = toImportPlainJson(item, seen);
    if (plain !== undefined) result[key] = plain;
  }
  return result;
}

export function serializeImportLeoMetadata(value: unknown) {
  const plain = toImportPlainJson(value);
  return plain && typeof plain === "object" && !Array.isArray(plain) ? plain : null;
}

export function buildImportReviewDto(input: {
  domain: ImportDomain;
  job: Record<string, unknown>;
}): ImportReviewDto {
  const job = toImportPlainJson(input.job) as PlainRecord;
  const existing = Array.isArray(job.analysisIssues) ? job.analysisIssues : [];
  const legacyIssues = existing.length ? [] : legacyIssuesForJob(input.domain, job);
  const currentIssues = [...existing, ...legacyIssues].filter(isIssue) as ImportIssueV2[];
  const resolvedCounts = {
    automatic: currentIssues.filter((issue) => issue.resolutionClass === "AUTO" && issue.status === "resolved").length,
    admin: currentIssues.filter((issue) => ["admin", "admin_via_leo", "admin_apply_similar"].includes(issue.resolvedBy || "") && issue.status === "resolved").length,
    leo: currentIssues.filter((issue) => issue.resolvedBy === "leo" && issue.status === "resolved").length,
    open: currentIssues.filter((issue) => issue.status === "open").length,
  };
  return {
    state: workflowState(String(job.status || "")),
    summary: isRecord(job.analysisSummary) ? job.analysisSummary : null,
    currentIssues,
    resolvedCounts,
  };
}

export function importCompatibility(job: Record<string, unknown>) {
  return compatibilityForImportJob(job);
}

function legacyIssuesForJob(domain: ImportDomain, job: PlainRecord): ImportIssueV2[] {
  const issues: ImportIssueV2[] = [];
  for (const key of ["analysisErrors", "analysisWarnings"]) {
    const values = Array.isArray(job[key]) ? job[key] : [];
    for (const item of values) {
      if (!isRecord(item)) continue;
      const rows = Array.isArray(item.affectedRows) ? item.affectedRows.filter((row): row is number => typeof row === "number") : [];
      const field = typeof item.field === "string" ? item.field : null;
      const code = typeof item.code === "string" ? item.code : "import_issue";
      issues.push(createImportIssue({
        domain,
        issueType: code,
        scope: rows.length ? "row" : field ? "column" : "file",
        rowRefs: rows.map((row) => `${domain === "teacher" ? "T" : "S"}${String(row).padStart(3, "0")}` as `${"T" | "S"}${string}`),
        fieldKey: field,
        severity: key === "analysisErrors" ? "blocking" : "warning",
        sourceValues: typeof item.value === "string" ? [item.value] : [],
        explanation: typeof item.message === "string" ? item.message : "Review this import issue.",
        resolutionClass: key === "analysisErrors" ? "BLOCKING" : "REVIEW",
      }));
    }
  }
  return issues;
}

function isIssue(value: unknown): value is ImportIssueV2 {
  return isRecord(value) && typeof value.issueId === "string" && Array.isArray(value.candidateActions);
}

function isRecord(value: unknown): value is PlainRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function workflowState(status: string): ImportReviewDto["state"] {
  if (status === "committing") return "committing";
  if (status === "completed" || status === "completed_with_errors") return "completed";
  if (status === "failed") return "failed";
  if (status === "cancelled") return "cancelled";
  if (status === "cancel_requested") return "cancel_requested";
  return "active";
}
