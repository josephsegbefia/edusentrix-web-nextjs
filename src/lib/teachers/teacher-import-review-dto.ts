import type { ImportIssueV2 } from "@/lib/import-intelligence/types";
import { importCompatibility, toImportPlainJson } from "@/lib/import-intelligence/serialize";
import { effectiveTeacherImportRowStatus, getTeacherImportReviewState } from "@/lib/teachers/teacher-import-review-state";
import type { ITeacherImportParsedRow } from "@/models/TeacherImportJob";

type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
}

function text(value: unknown, fallback = "") { return value === null || value === undefined ? fallback : String(value); }
function strings(value: unknown) { return Array.isArray(value) ? value.map(String) : []; }
function rowRef(row: RecordValue) { return text(row.rowRef, `T${String(row.sourceRowNumber || 0).padStart(3, "0")}`); }
function titleCase(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }

export type TeacherReviewDto = {
  compatibility: { outcome: string; reason: string };
  summary: { totalTeachers: number; readyTeachers: number; reviewTeachers: number; blockedTeachers: number; decisionCount: number; automaticMatches: number };
  columnMappings: Array<{ sourceHeader: string; canonicalField: string | null; source: string; confidence: number; status: string; explanation: string | null }>;
  columnMappingReviewRequired: boolean;
  activeIssues: TeacherReviewIssueDto[];
  resolvedIssues: TeacherReviewIssueDto[];
  rows: Array<{ rowRef: string; name: string; homeroom: string | null; subjectProfile: string[]; assignments: string[]; attentionReason: string | null; status: string; issueCount: number }>;
  leoStatus: { status: string; available: boolean; message: string | null } | null;
  updatedAt: string | null;
  attentionReview: { lastRowRef: string | null };
};

export type TeacherReviewIssueDto = {
  issueId: string;
  type: string;
  severity: "review" | "blocking";
  title: string;
  attentionReason: string | null;
  description: string;
  sourceValue: string | null;
  context: { gradeBand: string | null };
  affectedCount: number;
  affectedTeachers: Array<{ rowRef: string; name: string; homeroom: string | null }>;
  candidates: Array<{ key: string; label: string; recommended: boolean }>;
  recommendedKey: string | null;
  resolved: boolean;
  updatedAt: string;
};

/** Purpose-built, plain JSON review shape. No Mongoose internals or raw provider payloads. */
export function buildTeacherImportReviewDto(jobValue: unknown): TeacherReviewDto {
  const job = record(toImportPlainJson(jobValue));
  const compatibility = importCompatibility(job);
  const rows = (Array.isArray(job.parsedRows) ? job.parsedRows : []).map(record);
  const issues = (Array.isArray(job.analysisIssues) ? job.analysisIssues : []) as ImportIssueV2[];
  const summary = record(job.analysisSummary);
  const byRef = new Map(rows.map((row) => [rowRef(row), row]));
  const offeringNames = new Map<string, string>();
  for (const resolution of (Array.isArray(job.subjectResolutions) ? job.subjectResolutions : []).map(record)) {
    const ids = strings(resolution.subjectOfferingIds); const names = strings(resolution.resolvedNames);
    ids.forEach((value, index) => offeringNames.set(value, names[index] || "Recognised subject"));
  }
  const toIssue = (issue: ImportIssueV2): TeacherReviewIssueDto => {
    const sourceValue = issue.sourceValues?.[0] || null;
    const subjectOptions = candidateOptionsForIssue(issue, job);
    const affectedTeachers = issue.rowRefs.map((ref) => {
      const row = byRef.get(ref) || {};
      return {
        rowRef: ref,
        name: [text(row.firstName), ...strings(row.middleNames), text(row.lastName)].filter(Boolean).join(" ") || "Imported teacher",
        homeroom: [text(row.homeroomGrade), text(row.homeroomClass)].filter(Boolean).join(" ") || null,
      };
    });
    const isBlock = issue.resolutionClass === "BLOCKING" || issue.severity === "blocking";
    return {
      issueId: issue.issueId,
      type: issue.issueType,
      severity: isBlock ? "blocking" : "review",
      title: issueTitle(issue, affectedTeachers),
      attentionReason: issue.issueType.startsWith("attention_") ? issue.sourceValues?.[0] || null : null,
      description: issueDescription(issue, affectedTeachers),
      sourceValue,
      context: { gradeBand: issue.context?.gradeBand || null },
      affectedCount: issue.affectedCount || issue.rowRefs.length,
      affectedTeachers,
      candidates: subjectOptions.map((option, index) => ({ key: `SUBJECT_${index + 1}`, label: option.label, recommended: index === 0 })),
      recommendedKey: subjectOptions.length ? "SUBJECT_1" : null,
      resolved: issue.status !== "open",
      updatedAt: issue.updatedAt,
    };
  };
  const mapped = issues.map(toIssue).sort((left, right) => issuePriority(left) - issuePriority(right));
  const attentionReasonByRef = new Map<string, string>();
  for (const issue of mapped.filter((item) => item.attentionReason && !item.resolved)) {
    for (const ref of issue.affectedTeachers.map((teacher) => teacher.rowRef)) attentionReasonByRef.set(ref, issue.attentionReason!);
  }
  const leo = record(job.leoAnalysis);
  const interpretations = new Map(
    (Array.isArray(job.columnInterpretations) ? job.columnInterpretations : [])
      .map(record)
      .map((item) => [text(item.sourceColumn), text(item.explanation) || null])
  );
  const columnMappings = (Array.isArray(job.columnMappings) ? job.columnMappings : []).map(record).map((mapping) => ({
    sourceHeader: text(mapping.sourceHeader),
    canonicalField: typeof mapping.canonicalField === "string" && mapping.canonicalField ? mapping.canonicalField : null,
    source: text(mapping.source, "inferred"),
    confidence: Number(mapping.confidence || 0),
    status: text(mapping.status, "needs_review"),
    explanation: interpretations.get(text(mapping.sourceHeader)) || null,
  }));
  const effectiveState = getTeacherImportReviewState({ parsedRows: rows as unknown as ITeacherImportParsedRow[], analysisIssues: issues });
  const issueByRow = new Map<string, ImportIssueV2[]>();
  for (const issue of effectiveState.unresolvedIssues) for (const ref of issue.rowRefs) issueByRow.set(ref, [...(issueByRow.get(ref) || []), issue]);
  return {
    compatibility,
    summary: {
      totalTeachers: rows.length,
      readyTeachers: effectiveState.readyCount,
      reviewTeachers: effectiveState.attentionCount,
      blockedTeachers: effectiveState.blockedCount,
      decisionCount: mapped.filter((issue) => !issue.resolved).length,
      automaticMatches: Number(summary.autoResolutionCount || 0),
    },
    columnMappings,
    columnMappingReviewRequired: columnMappings.some((mapping) => mapping.status !== "resolved"),
    activeIssues: mapped.filter((issue) => !issue.resolved),
    resolvedIssues: mapped.filter((issue) => issue.resolved),
    rows: rows.map((row) => ({
      rowRef: rowRef(row),
      name: [text(row.firstName), ...strings(row.middleNames), text(row.lastName)].filter(Boolean).join(" ") || "Imported teacher",
      homeroom: [text(row.homeroomGrade), text(row.homeroomClass)].filter(Boolean).join(" ") || null,
      subjectProfile: strings(row.subjectOfferingIds).map((id) => offeringNames.get(id)).filter((value): value is string => Boolean(value)),
      assignments: (Array.isArray(row.explicitAssignments) ? row.explicitAssignments : []).map(record).filter((assignment) => text(assignment.status) === "resolved").map((assignment) => [text(assignment.subjectValue), text(assignment.classValue)].filter(Boolean).join(" · ")).filter(Boolean),
      attentionReason: attentionReasonByRef.get(rowRef(row)) || null,
      status: effectiveTeacherImportRowStatus(row as unknown as ITeacherImportParsedRow, issueByRow.get(rowRef(row)) || []),
      issueCount: Array.isArray(row.issues) ? row.issues.length : 0,
    })),
    leoStatus: Object.keys(leo).length ? { status: text(leo.status), available: !["unavailable", "degraded"].includes(text(leo.status)), message: typeof leo.reason === "string" ? leo.reason : null } : null,
    attentionReview: { lastRowRef: text(record(job.attentionReview).lastRowRef) || null },
    updatedAt: typeof job.updatedAt === "string" ? job.updatedAt : null,
  };
}

export function subjectOfferingIdForReviewIssue(jobValue: unknown, issueId: string, catalogKey: string) {
  const match = /^SUBJECT_(\d+)$/.exec(catalogKey);
  if (!match) return null;
  const job = record(toImportPlainJson(jobValue));
  const issue = ((Array.isArray(job.analysisIssues) ? job.analysisIssues : []) as ImportIssueV2[]).find((item) => item.issueId === issueId);
  if (!issue || issue.fieldKey !== "subjects") return null;
  const optionIds = candidateOptionsForIssue(issue, job).map((item) => item.id);
  return optionIds[Number(match[1]) - 1] || null;
}

function candidateOptionsForIssue(issue: ImportIssueV2, job: RecordValue) {
  if (issue.fieldKey !== "subjects") return [];
  const source = issue.sourceValues?.[0] || "";
  const issueRows = new Set(issue.rowRefs.map((rowRef) => Number(rowRef.slice(1))));
  const options = new Map<string, string>();
  for (const resolution of (Array.isArray(job.subjectResolutions) ? job.subjectResolutions : []).map(record)) {
    if (text(resolution.sourceValue).trim().toLowerCase() !== source.trim().toLowerCase()) continue;
    if (Array.isArray(resolution.affectedRows) && !resolution.affectedRows.some((rowNumber) => issueRows.has(Number(rowNumber)))) continue;
    for (const candidate of (Array.isArray(resolution.candidateOptions) ? resolution.candidateOptions : []).map(record)) {
      options.set(text(candidate.id), text(candidate.label));
    }
  }
  return [...options.entries()].map(([id, label]) => ({ id, label })).sort((left, right) => left.label.localeCompare(right.label));
}

function issueTitle(issue: ImportIssueV2, teachers: Array<{ name: string; homeroom: string | null }>) {
  if (issue.issueType.startsWith("attention_")) return teachers.length === 1 ? `${teachers[0].name}: ${issue.sourceValues?.[0] || "Review relationship context"}` : issue.sourceValues?.[0] || "Review relationship context";
  if (issue.issueType === "missing_required" && issue.fieldKey === "email") return "Email address is missing";
  if (issue.issueType === "stage_mismatch") return "One subject looks unusual";
  if (issue.issueType === "subject_unresolved" || issue.issueType === "semantic_substitution_review") return issue.sourceValues?.[0] || "Choose a subject";
  return teachers.length === 1 ? `${teachers[0].name}: ${titleCase(issue.issueType)}` : titleCase(issue.issueType);
}

function issueDescription(issue: ImportIssueV2, teachers: Array<{ name: string; homeroom: string | null }>) {
  if (issue.issueType === "stage_mismatch") {
    const teacher = teachers[0];
    return `${teacher?.name || "This teacher"} is linked to ${teacher?.homeroom || "a known class"}, but the spreadsheet also lists "${issue.sourceValues?.[0] || "this subject"}". Confirm what the spreadsheet means.`;
  }
  if (issue.issueType === "missing_required" && issue.fieldKey === "email") return "EduSentrix needs an email address to create this teacher's account.";
  return issue.explanation;
}

function issuePriority(issue: TeacherReviewIssueDto) {
  if (issue.severity === "blocking") return 1;
  if (issue.type.includes("duplicate")) return 2;
  if (issue.type.includes("homeroom")) return 3;
  if (["stage_mismatch", "subject_unresolved", "semantic_substitution_review"].includes(issue.type)) return 4;
  return 5;
}
