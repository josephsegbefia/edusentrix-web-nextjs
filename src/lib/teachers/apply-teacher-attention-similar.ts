import mongoose from "mongoose";
import type { ITeacherImportJob, ITeacherImportParsedRow } from "@/models/TeacherImportJob";
import { ClassGroup } from "@/models/ClassGroup";
import { SubjectOffering } from "@/models/SubjectOffering";
import { Grade } from "@/models/Grade";
import { findSimilarRowsForPlan, similarityGroupId, templateForRelationshipPlan, type SimilarResolutionTemplate } from "@/lib/teachers/teacher-attention-similarity";
import { normalizeTeacherRelationshipClassLabel } from "@/lib/teachers/teacher-relationship-plan";
import { refreshTeacherImportReviewState } from "@/lib/teachers/teacher-import-review-state";

function ref(row: ITeacherImportParsedRow) { return row.rowRef || `T${String(row.sourceRowNumber).padStart(3, "0")}`; }
function teacherName(row: ITeacherImportParsedRow) { return [row.firstName, ...row.middleNames, row.lastName].filter(Boolean).join(" ") || "Imported teacher"; }
function issueForRow(job: ITeacherImportJob, row: ITeacherImportParsedRow, issueType: string) { return (job.analysisIssues || []).find((candidate) => candidate.status === "open" && candidate.issueType === issueType && candidate.rowRefs.includes(ref(row) as never)); }
function attentionBlocked(row: ITeacherImportParsedRow) { return row.issues.some((item) => ["blocked", "missing_required", "invalid", "duplicate", "not_found"].includes(item.code)); }

export function previewTeacherAttentionSimilar(job: ITeacherImportJob, plan: Record<string, unknown>) {
  const group = findSimilarRowsForPlan(job, plan);
  const template = group.representative ? templateForRelationshipPlan(plan, group.representative) : null;
  if (!group.issue || !group.representative || !template) return { groupId: similarityGroupId(plan), template: null as SimilarResolutionTemplate | null, rows: [], excluded: [], version: job.updatedAt?.toISOString?.() || String(job.updatedAt || "") };
  const rows = group.rows.map((row) => ({ rowRef: ref(row), name: teacherName(row), homeroom: [row.homeroomGrade, row.homeroomClass].filter(Boolean).join(" ") || null, subjectCount: row.subjectOfferingIds.length || row.subjects.length, signal: group.issue?.sourceValues[0] || group.issue?.issueType }));
  return { groupId: similarityGroupId(plan), template, rows, excluded: [], version: job.updatedAt?.toISOString?.() || String(job.updatedAt || "") };
}

export async function applyTeacherAttentionSimilar(input: { job: ITeacherImportJob; plan: Record<string, unknown>; expectedUpdatedAt: string; confirmedBy: string }) {
  const groupId = similarityGroupId(input.plan);
  const existing = input.job.attentionReview?.similarityGroups?.find((item) => String(item.groupId) === groupId && String(item.planId) === String(input.plan.proposalId));
  if (existing && Array.isArray(existing.appliedRowRefs)) {
    const state = refreshTeacherImportReviewState(input.job);
    return { appliedCount: 0, excludedCount: Array.isArray(existing.excluded) ? existing.excluded.length : 0, excluded: existing.excluded || [], counts: { ready: state.readyCount, attention: state.attentionCount, blocked: state.blockedCount }, nextIssueId: state.unresolvedIssues[0]?.issueId || null, groupId, template: existing.resolutionTemplate || null };
  }
  const currentVersion = input.job.updatedAt?.toISOString?.() || String(input.job.updatedAt || "");
  if (currentVersion !== input.expectedUpdatedAt) throw new Error("This group changed since you reviewed it. Refresh the updated teachers before applying.");
  const group = findSimilarRowsForPlan(input.job, input.plan);
  const template = group.representative ? templateForRelationshipPlan(input.plan, group.representative) : null;
  if (!group.issue || !group.representative || !template) throw new Error("This similarity group is no longer available.");
  const alreadyApplied = new Set<string>();
  const classIds = group.rows.map((row) => row.homeroomClassGroupId).filter((id): id is string => Boolean(id) && mongoose.isValidObjectId(id));
  const classes = await ClassGroup.find({ _id: { $in: classIds }, schoolId: input.job.schoolId, isActive: true }).select("_id gradeId name").lean();
  const classById = new Map(classes.map((item) => [String(item._id), item]));
  const gradeIds = [...new Set(classes.map((item) => String(item.gradeId)).filter((id) => mongoose.isValidObjectId(id)))];
  const activeGrades = new Set((await Grade.find({ _id: { $in: gradeIds }, schoolId: input.job.schoolId, isActive: true }).select("_id").lean()).map((item) => String(item._id)));
  const offeringIds = [...new Set(group.rows.flatMap((row) => row.subjectOfferingIds).filter((id) => mongoose.isValidObjectId(id)))];
  const offerings = await SubjectOffering.find({ _id: { $in: offeringIds }, schoolId: input.job.schoolId, isActive: true }).select("_id displayName gradeIds").lean();
  const offeringById = new Map(offerings.map((item) => [String(item._id), item]));
  const excluded: Array<{ rowRef: string; reason: string }> = [];
  const applied: string[] = [];
  for (const row of group.rows) {
    const rowRef = ref(row);
    const rowIssue = issueForRow(input.job, row, group.issue.issueType);
    if (alreadyApplied.has(rowRef)) continue;
    if (!rowIssue) { excluded.push({ rowRef, reason: "issue_resolved" }); continue; }
    if (attentionBlocked(row)) { excluded.push({ rowRef, reason: "row_blocked" }); continue; }
    if (template === "TEACH_LISTED_SUBJECTS_IN_OWN_HOMEROOM") {
      const classGroup = row.homeroomClassGroupId ? classById.get(row.homeroomClassGroupId) : null;
      if (!classGroup || !activeGrades.has(String(classGroup.gradeId))) { excluded.push({ rowRef, reason: "homeroom_or_grade_unavailable" }); continue; }
      const validSubjects = row.subjectOfferingIds.filter((id) => offeringById.has(id));
      if (!validSubjects.length || validSubjects.length !== row.subjectOfferingIds.length) { excluded.push({ rowRef, reason: "subject_offering_unavailable" }); continue; }
      const compatibleSubjects = validSubjects.filter((subjectId) => {
        const offering = offeringById.get(subjectId)!;
        return !offering.gradeIds?.length || offering.gradeIds.some((gradeId) => String(gradeId) === String(classGroup.gradeId));
      });
      if (compatibleSubjects.length !== validSubjects.length) { excluded.push({ rowRef, reason: "subject_not_valid_for_homeroom_grade" }); continue; }
      for (const subjectId of compatibleSubjects) {
        const offering = offeringById.get(subjectId)!;
        if (!row.explicitAssignments.some((assignment) => assignment.subjectOfferingId === subjectId && assignment.classGroupId === row.homeroomClassGroupId)) row.explicitAssignments.push({ sourceValue: "admin apply similar", subjectValue: offering.displayName, classValue: normalizeTeacherRelationshipClassLabel(row.homeroomGrade || "", String(classGroup.name)), gradeId: String(classGroup.gradeId), classGroupId: row.homeroomClassGroupId, subjectOfferingId: subjectId, source: "admin", status: "resolved", note: "Review-stage proposal adapted from a confirmed similar-case template; no TeacherAssignment created." });
      }
    }
    if (template === "KEEP_BROAD_SUBJECT_PROFILE" || template === "KEEP_CROSS_STAGE_SUBJECTS" || template === "TEACH_LISTED_SUBJECTS_IN_OWN_HOMEROOM") {
      row.issues = row.issues.filter((item) => item.groupedIssueId !== rowIssue.issueId);
      row.resolutionStatus = attentionBlocked(row) ? "blocked" : row.issues.length ? "needs_review" : "resolved";
      row.rowState = row.resolutionStatus === "resolved" ? "ready" : "pending";
      const now = new Date().toISOString();
      row.provenance = [...(row.provenance || []), { field: "relationships", source: "admin", note: `admin_apply_similar:${groupId}`, resolutionSource: "admin_apply_similar", representativeIssueId: group.issue.issueId, similarityGroupId: groupId, confirmedBy: input.confirmedBy, confirmedAt: now, resolutionTemplate: template, adaptedActions: template === "TEACH_LISTED_SUBJECTS_IN_OWN_HOMEROOM" ? row.explicitAssignments.filter((assignment) => assignment.sourceValue === "admin apply similar").map((assignment) => ({ subjectOfferingId: assignment.subjectOfferingId, classGroupId: assignment.classGroupId })) : [] }];
      input.job.analysisIssues = (input.job.analysisIssues || []).map((candidate) => candidate.issueId === rowIssue.issueId ? { ...candidate, status: "resolved", resolvedBy: "admin_apply_similar", resolvedAction: { actionId: `similar_${groupId}_${rowRef}`, type: "keep_existing", issueId: rowIssue.issueId, rowRefs: [rowRef as `T${string}`], similarityGroupId: groupId, resolutionTemplate: template }, updatedAt: now } : candidate);
      applied.push(rowRef);
    }
  }
  input.job.attentionReview = input.job.attentionReview || { assessments: [], similarityGroups: [], lastRowRef: null, updatedAt: null };
  input.job.attentionReview.similarityGroups = [...(input.job.attentionReview.similarityGroups || []).filter((item) => String(item.groupId) !== groupId), { groupId, planId: input.plan.proposalId, representativeIssueId: group.issue.issueId, resolutionTemplate: template, appliedRowRefs: [...alreadyApplied, ...applied], excluded, confirmedBy: input.confirmedBy, confirmedAt: new Date().toISOString() }];
  input.job.attentionReview.updatedAt = new Date();
  const state = refreshTeacherImportReviewState(input.job);
  const nextIssueId = input.job.analysisIssues?.find((candidate) => candidate.status === "open")?.issueId || null;
  return { appliedCount: applied.length, excludedCount: excluded.length, excluded, counts: { ready: state.readyCount, attention: state.attentionCount, blocked: state.blockedCount }, nextIssueId, groupId, template };
}
