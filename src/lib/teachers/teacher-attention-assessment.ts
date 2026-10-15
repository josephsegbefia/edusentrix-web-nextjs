import { z } from "zod";
import type { Types } from "mongoose";
import type { ImportIssueV2 } from "@/lib/import-intelligence/types";
import { runLeoImportIntelligence, type RunLeoImportIntelligenceResult } from "@/lib/import-intelligence/leo";
import type { ITeacherImportJob, ITeacherImportParsedRow } from "@/models/TeacherImportJob";

export const teacherAttentionAssessmentSchema = z.object({
  summary: z.string().max(600),
  likelyInterpretation: z.string().max(800),
  explanation: z.string().max(1200),
  confidence: z.enum(["high", "medium", "low"]),
  suggestedResolutionType: z.enum(["keep_profile", "own_homeroom", "choose_subjects", "keep_both_stages", "review_assignments", "manual_review"]),
  suggestedActions: z.array(z.string().max(300)).max(6),
}).strict();

export type TeacherAttentionAssessment = z.infer<typeof teacherAttentionAssessmentSchema> & {
  status: "completed" | "unavailable";
  cached: boolean;
  reason?: string | null;
};

function rowRef(row: ITeacherImportParsedRow) { return row.rowRef || `T${String(row.sourceRowNumber).padStart(3, "0")}`; }
function name(row: ITeacherImportParsedRow) { return [row.firstName, ...row.middleNames, row.lastName].filter(Boolean).join(" ") || "Imported teacher"; }
function safeRow(row: ITeacherImportParsedRow) {
  return { teacherRef: rowRef(row), displayName: name(row), subjects: row.subjectOfferingIds.slice(0, 12), subjectCount: row.subjectOfferingIds.length || row.subjects.length, gradeContext: row.gradeScopes.slice(0, 6), classContext: row.classScopes.slice(0, 6), homeroom: [row.homeroomGrade, row.homeroomClass].filter(Boolean).join(" ") || null, explicitAssignments: row.explicitAssignments.filter((item) => item.status === "resolved").slice(0, 8).map((item) => ({ subject: item.subjectValue, grade: item.gradeValue || null, class: item.classValue || null })) };
}

export async function assessTeacherAttention(input: {
  job: ITeacherImportJob;
  issue: ImportIssueV2;
  schoolId: Types.ObjectId;
  subjectLabelsById?: Map<string, string>;
  provider?: Parameters<typeof runLeoImportIntelligence>[1];
}): Promise<TeacherAttentionAssessment> {
  const cached = input.job.attentionReview?.assessments?.find((item) => String(item.issueId) === input.issue.issueId && String(item.contextFingerprint) === fingerprint(input.issue, input.job));
  if (cached) return { ...(cached.assessment as TeacherAttentionAssessment), cached: true };
  const rows = input.issue.rowRefs.map((ref) => input.job.parsedRows.find((row) => rowRef(row) === ref)).filter((row): row is ITeacherImportParsedRow => Boolean(row));
  const subjectLabels = rows.flatMap((row) => row.subjectOfferingIds.map((id) => input.subjectLabelsById?.get(id)).filter(Boolean));
  const context = JSON.stringify({ task: "Assess one bounded teacher attention pattern.", issue: { type: input.issue.issueType, label: input.issue.sourceValues[0] || null, explanation: input.issue.explanation, gradeBand: input.issue.context?.gradeBand || null }, teachers: rows.map(safeRow), subjectProfileLabels: [...new Set(subjectLabels)].slice(0, 16), rules: ["Do not create assignments.", "Do not infer a homeroom.", "Return a suggestion only; the administrator must confirm."] });
  const result = await runLeoImportIntelligence({ domain: "teacher", task: "attention_assessment", schoolId: input.schoolId, authorized: true, inputCount: rows.length, responseSchema: teacherAttentionAssessmentSchema, tracing: { schoolId: String(input.schoolId), importJobId: String(input.job._id) }, context }, input.provider);
  const assessment: TeacherAttentionAssessment = result.ok ? { ...result.data, status: "completed", cached: false } : { summary: "Leo could not suggest an interpretation right now.", likelyInterpretation: "Use the manual review options for this attention item.", explanation: result.metadata.reason || "Leo is unavailable.", confidence: "low", suggestedResolutionType: "manual_review", suggestedActions: ["Review the source profile", "Use a manual option", "Tell Leo what the spreadsheet means"], status: "unavailable", cached: false, reason: result.metadata.reason };
  input.job.attentionReview = input.job.attentionReview || { assessments: [], similarityGroups: [], lastRowRef: null, updatedAt: null };
  input.job.attentionReview.assessments = [...(input.job.attentionReview.assessments || []).filter((item) => String(item.issueId) !== input.issue.issueId), { issueId: input.issue.issueId, contextFingerprint: fingerprint(input.issue, input.job), assessment, createdAt: new Date().toISOString() }];
  input.job.attentionReview.updatedAt = new Date();
  return assessment;
}

function fingerprint(issue: ImportIssueV2, job: ITeacherImportJob) {
  const rows = issue.rowRefs.map((ref) => job.parsedRows.find((row) => rowRef(row) === ref)).filter(Boolean).map((row) => ({ subjects: row!.subjectOfferingIds.slice().sort(), grades: row!.gradeScopeIds?.slice().sort(), classes: row!.classScopeIds?.slice().sort(), homeroom: row!.homeroomClassGroupId || row!.homeroomClass || null }));
  return JSON.stringify({ issue: issue.issueType, band: issue.context?.gradeBand || null, rows });
}

export function attentionAssessmentForJob(job: ITeacherImportJob, issueId: string) {
  return job.attentionReview?.assessments?.find((item) => String(item.issueId) === issueId)?.assessment as TeacherAttentionAssessment | undefined;
}
