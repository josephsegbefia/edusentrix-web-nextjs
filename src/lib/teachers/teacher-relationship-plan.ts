import mongoose from "mongoose";
import { importProposalSchema } from "@/lib/import-intelligence/schemas";
import { createPendingNaturalLanguageResolution, validateImportProposal } from "@/lib/import-intelligence/actions";
import { runLeoImportIntelligence } from "@/lib/import-intelligence/leo";
import type { ImportProposedAction } from "@/lib/import-intelligence/types";
import { bestGradeMatch, bestOfferingForGrade } from "@/lib/leo/parse-teacher-assignment-hint";
import { interpretTeacherTeachingRelationships } from "@/lib/leo/teacher-relationship-interpreter";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { SubjectOffering } from "@/models/SubjectOffering";
import type { ITeacherImportJob, ITeacherImportParsedRow } from "@/models/TeacherImportJob";
import { refreshTeacherImportReviewState } from "@/lib/teachers/teacher-import-review-state";

export type TeacherRelationshipCatalogItem = { key: string; id: string; label: string; gradeId?: string; occupied?: boolean; occupiedTeacherId?: string | null; offeringGradeIds?: string[] };
export type TeacherRelationshipCatalog = { grades: TeacherRelationshipCatalogItem[]; classes: TeacherRelationshipCatalogItem[]; subjects: TeacherRelationshipCatalogItem[] };
type PlanStatus = "interpreted" | "invalid" | "failed" | "confirmed" | "reopened";
type RelationshipPlan = {
  proposalId: string; issueId: string; instructionId: string; submittedBy: string; submittedAt: string;
  status: PlanStatus; proposedActions: ImportProposedAction[]; resolvedActions: Array<Record<string, unknown>>;
  explanation: string | null; validation: { ok: boolean; message: string | null; warnings: string[] };
  preview: { summary: string; changes: string[]; warnings: string[]; affectedTeachers: string[]; requiresConfirmation: boolean };
  confirmedAt: string | null; confirmedBy: string | null; reopenedAt: string | null; beforeRows?: Array<Record<string, unknown>>;
};

function asRecord(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function rowRef(row: ITeacherImportParsedRow) { return row.rowRef || `T${String(row.sourceRowNumber).padStart(3, "0")}`; }
function name(row: ITeacherImportParsedRow) { return [row.firstName, ...(row.middleNames || []), row.lastName].filter(Boolean).join(" ") || "Imported teacher"; }
function id() { return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`; }

/** Formats a class label for display without duplicating an already-qualified grade. */
export function normalizeTeacherRelationshipClassLabel(gradeName: string, className: string): string {
  const grade = gradeName.trim().replace(/\s+/g, " ");
  const group = className.trim().replace(/\s+/g, " ");
  if (!grade) return group;
  if (!group) return grade;
  if (group.toLowerCase() === grade.toLowerCase() || group.toLowerCase().startsWith(`${grade.toLowerCase()} `)) return group;
  return `${grade} ${group}`;
}

export async function loadTeacherRelationshipCatalog(schoolId: mongoose.Types.ObjectId): Promise<TeacherRelationshipCatalog> {
  const [grades, classes, offerings] = await Promise.all([
    Grade.find({ schoolId, isActive: true }).select("_id name").sort({ order: 1, name: 1 }).lean(),
    ClassGroup.find({ schoolId, isActive: true }).select("_id name gradeId homeroomTeacherId").lean(),
    SubjectOffering.find({ schoolId, isActive: true }).select("_id displayName gradeIds").sort({ displayName: 1 }).lean(),
  ]);
  const gradeName = new Map(grades.map((grade) => [String(grade._id), grade.name]));
  const gradeItems: TeacherRelationshipCatalogItem[] = grades.map((grade, index) => ({ key: `GRADE_${index + 1}`, id: String(grade._id), label: grade.name }));
  const classItems: TeacherRelationshipCatalogItem[] = classes
    .map((group) => {
      const currentGradeName = gradeName.get(String(group.gradeId)) || "Grade";
      return { id: String(group._id), gradeId: String(group.gradeId), label: normalizeTeacherRelationshipClassLabel(currentGradeName, String(group.name)), occupied: Boolean(group.homeroomTeacherId), occupiedTeacherId: group.homeroomTeacherId ? String(group.homeroomTeacherId) : null };
    })
    .sort((left, right) => left.label.localeCompare(right.label))
    .map((group, index) => ({ ...group, key: `CLASS_${index + 1}` }));
  const subjectItems: TeacherRelationshipCatalogItem[] = offerings.map((offering, index) => ({ key: `SUBJECT_${index + 1}`, id: String(offering._id), label: offering.displayName, offeringGradeIds: offering.gradeIds.map(String) }));
  return { grades: gradeItems, classes: classItems, subjects: subjectItems };
}

function actionCatalogKeys(action: Record<string, unknown>) {
  return ["catalogKey", "classGroupKey", "subjectOfferingKey", "gradeKey", "academicPeriodKey"]
    .map((key) => action[key]).filter((key): key is string => typeof key === "string");
}

function duplicateKey(action: Record<string, unknown>) {
  return [action.type, action.teacherRef, action.subjectOfferingKey, action.gradeKey, action.classGroupKey].map(String).join("|");
}

export function validateTeacherRelationshipPlan(input: { job: ITeacherImportJob; issueId: string; actions: ImportProposedAction[]; catalog: TeacherRelationshipCatalog }): Omit<RelationshipPlan, "proposalId" | "issueId" | "instructionId" | "submittedBy" | "submittedAt" | "status" | "confirmedAt" | "confirmedBy" | "reopenedAt"> {
  const issue = (input.job.analysisIssues || []).find((item) => item.issueId === input.issueId);
  const rows = new Map(input.job.parsedRows.map((row) => [rowRef(row), row]));
  const all = [...input.catalog.grades, ...input.catalog.classes, ...input.catalog.subjects];
  const byKey = new Map(all.map((item) => [item.key, item]));
  const allowedRows = new Set<string>(issue?.rowRefs || []);
  const warnings: string[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  const subjectAdds = new Set<string>();
  const subjectRemoves = new Set<string>();
  const resolvedActions: Array<Record<string, unknown>> = [];
  for (const proposed of input.actions) {
    const action = proposed as Record<string, unknown>;
    const teacherRef = typeof action.teacherRef === "string" ? action.teacherRef : null;
    if (!teacherRef || !allowedRows.has(teacherRef) || !rows.has(teacherRef)) { errors.push("Leo referenced a teacher outside this decision."); continue; }
    if ((action.rowRefs as unknown[]).some((ref) => ref !== teacherRef)) { errors.push("Each relationship action must apply only to its named imported teacher."); continue; }
    const key = duplicateKey(action);
    if (seen.has(key)) continue;
    seen.add(key);
    const keys = actionCatalogKeys(action);
    if (keys.some((catalogKey) => !byKey.has(catalogKey))) { errors.push("One selected school item is no longer available. Refresh and choose a current option."); continue; }
    const subject = typeof action.subjectOfferingKey === "string" ? byKey.get(action.subjectOfferingKey) : undefined;
    const grade = typeof action.gradeKey === "string" ? byKey.get(action.gradeKey) : undefined;
    const group = typeof action.classGroupKey === "string" ? byKey.get(action.classGroupKey) : undefined;
    if (subject && !subject.key.startsWith("SUBJECT_")) { errors.push("That selected subject is not available in this school."); continue; }
    if (grade && !grade.key.startsWith("GRADE_")) { errors.push("That selected grade is not available in this school."); continue; }
    if (group && !group.key.startsWith("CLASS_")) { errors.push("That selected class is not available in this school."); continue; }
    if (action.type === "add_subject_profile") subjectAdds.add(`${teacherRef}|${subject?.id}`);
    if (action.type === "remove_subject_profile") subjectRemoves.add(`${teacherRef}|${subject?.id}`);
    if (action.type === "add_assignment_proposal" && group && subject && subject.offeringGradeIds?.length && !subject.offeringGradeIds.includes(group.gradeId || "")) {
      errors.push(`That subject is not available for ${group.label.replace(/\s+[A-Za-z]+$/, "")} in this school.`); continue;
    }
    if (action.type === "add_grade_context" && grade && subject && subject.offeringGradeIds?.length && !subject.offeringGradeIds.includes(grade.id)) {
      errors.push(`That subject is not available for ${grade.label} in this school.`); continue;
    }
    if (action.type === "choose_homeroom" && group?.occupied) {
      errors.push(`${group.label} already has a homeroom teacher. Choose another class or explicitly confirm replacing the current teacher.`); continue;
    }
    if (action.type === "replace_homeroom" && group?.occupied) warnings.push(`${group.label} already has a homeroom teacher; the existing teacher will require an explicit replacement decision at import commit.`);
    if (action.type === "add_assignment_proposal" && group?.occupied) warnings.push(`${group.label} already has a homeroom teacher. This is a teaching proposal, not a homeroom replacement.`);
    resolvedActions.push({ ...action, subjectOfferingId: subject?.id, subjectOfferingLabel: subject?.label, gradeId: grade?.id, gradeLabel: grade?.label, classGroupId: group?.id, classGroupLabel: group?.label, expectedHomeroomTeacherId: action.type === "replace_homeroom" ? group?.occupiedTeacherId || null : undefined });
  }
  for (const value of subjectAdds) if (subjectRemoves.has(value)) errors.push("The instruction both adds and removes the same subject. Clarify which change you want.");
  const changes = resolvedActions.map((action) => describe(action, rows));
  const affected = [...new Set(resolvedActions.map((action) => String(action.teacherRef)).filter(Boolean).map((ref) => name(rows.get(ref)!)))];
  return { proposedActions: input.actions, resolvedActions, explanation: errors[0] || null, validation: { ok: !errors.length && resolvedActions.length > 0, message: errors[0] || (resolvedActions.length ? null : "Leo did not identify a supported relationship change."), warnings }, preview: { summary: changes.length ? `This affects ${affected.length} imported ${affected.length === 1 ? "teacher" : "teachers"}.` : "No changes are ready to confirm.", changes, warnings, affectedTeachers: affected, requiresConfirmation: true } };
}

function describe(action: Record<string, unknown>, rows: Map<string, ITeacherImportParsedRow>) {
  const teacher = name(rows.get(String(action.teacherRef))!); const subject = String(action.subjectOfferingLabel || "the subject"); const group = String(action.classGroupLabel || "the class"); const grade = String(action.gradeLabel || "the grade");
  switch (action.type) {
    case "choose_homeroom": case "replace_homeroom": return `Set ${teacher}'s homeroom to ${group}`;
    case "clear_homeroom": return `Remove ${teacher}'s homeroom`;
    case "add_subject_profile": return `Add ${subject} to ${teacher}'s subject profile`;
    case "remove_subject_profile": return `Remove ${subject} from ${teacher}'s subject profile`;
    case "add_grade_context": return `Add ${grade} teaching context for ${teacher}`;
    case "remove_grade_context": return `Remove ${grade} teaching context for ${teacher}`;
    case "add_class_context": return `Add ${group} class context for ${teacher}`;
    case "remove_class_context": return `Remove ${group} class context for ${teacher}`;
    case "add_assignment_proposal": return `Propose ${subject} teaching for ${teacher} in ${group}`;
    case "remove_assignment_proposal": return `Remove the ${subject} teaching proposal for ${teacher} in ${group}`;
    case "confirm_coteaching": return `Confirm co-teaching ${subject} in ${group} for ${teacher}`;
    default: return "Apply the reviewed relationship change";
  }
}

function applyResolvedActions(job: ITeacherImportJob, plan: RelationshipPlan) {
  for (const action of plan.resolvedActions) {
    const row = job.parsedRows.find((candidate) => rowRef(candidate) === action.teacherRef); if (!row) throw new Error("An imported teacher is no longer available.");
    const subjectId = typeof action.subjectOfferingId === "string" ? action.subjectOfferingId : null;
    const gradeId = typeof action.gradeId === "string" ? action.gradeId : null;
    const classId = typeof action.classGroupId === "string" ? action.classGroupId : null;
    if (action.type === "add_subject_profile" && subjectId) row.subjectOfferingIds = [...new Set([...row.subjectOfferingIds, subjectId])];
    if (action.type === "remove_subject_profile" && subjectId) row.subjectOfferingIds = row.subjectOfferingIds.filter((value) => value !== subjectId);
    if (action.type === "add_grade_context" && gradeId) { row.gradeScopeIds = [...new Set([...(row.gradeScopeIds || []), gradeId])]; if (typeof action.gradeLabel === "string") row.gradeScopes = [...new Set([...row.gradeScopes, action.gradeLabel])]; }
    if (action.type === "remove_grade_context" && gradeId) row.gradeScopeIds = (row.gradeScopeIds || []).filter((value) => value !== gradeId);
    if (action.type === "add_class_context" && classId) { row.classScopeIds = [...new Set([...(row.classScopeIds || []), classId])]; if (typeof action.classGroupLabel === "string") row.classScopes = [...new Set([...row.classScopes, action.classGroupLabel])]; }
    if (action.type === "remove_class_context" && classId) row.classScopeIds = (row.classScopeIds || []).filter((value) => value !== classId);
    if ((action.type === "choose_homeroom" || action.type === "replace_homeroom") && classId) { row.homeroomClassGroupId = classId; row.homeroomClass = String(action.classGroupLabel || row.homeroomClass || ""); }
    if (action.type === "clear_homeroom") row.homeroomClassGroupId = null;
    if (action.type === "add_assignment_proposal" && subjectId && classId) {
      const exists = row.explicitAssignments.some((item) => item.subjectOfferingId === subjectId && item.classGroupId === classId);
      if (!exists) row.explicitAssignments.push({ sourceValue: "admin relationship review", subjectValue: String(action.subjectOfferingLabel || ""), classValue: String(action.classGroupLabel || ""), subjectOfferingId: subjectId, classGroupId: classId, gradeId: gradeId || null, source: "admin", status: "resolved", note: "Confirmed relationship proposal; no TeacherAssignment has been created." });
    }
    if (action.type === "remove_assignment_proposal" && subjectId && classId) row.explicitAssignments = row.explicitAssignments.filter((item) => !(item.subjectOfferingId === subjectId && item.classGroupId === classId));
    row.provenance = [...(row.provenance || []), { field: "relationships", source: "admin", note: `Confirmed relationship plan ${plan.proposalId}.` }];
  }
}

export type TeacherRelationshipInterpreterDependencies = {
  /** Internal test seam; HTTP callers always use the canonical shared runner. */
  runImportIntelligence?: typeof runLeoImportIntelligence;
  /** Internal test seam for the already school-scoped relationship catalog. */
  loadRelationshipCatalog?: typeof loadTeacherRelationshipCatalog;
  /** Internal test seam for the shared semantic Leo interpreter. */
  interpretRelationships?: typeof interpretTeacherTeachingRelationships;
};

function semanticActions(input: { instruction: string; issueId: string; teacherRef: string; catalog: TeacherRelationshipCatalog; interpretation: Awaited<ReturnType<typeof interpretTeacherTeachingRelationships>> }): ImportProposedAction[] {
  const grades = input.catalog.grades.map((item) => ({ id: item.id, name: item.label }));
  const offerings = input.catalog.subjects.map((item) => ({ id: item.id, subjectId: item.id, displayName: item.label, shortName: "", code: "", subjectFamily: "", gradeBand: "", gradeIds: item.offeringGradeIds || [] }));
  const actions: ImportProposedAction[] = [];
  const actionId = () => `action_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const gradeKey = (value: string) => bestGradeMatch(value, new Map(grades.map((grade) => [grade.name.trim().toLowerCase(), grade])))?.id;
  const subjectKey = (subject: string, grade: { id: string; label: string }) => bestOfferingForGrade(subject, grade.id, grade.label, offerings)?.id;
  const classKey = (grade: { id: string; label: string }, stream: string) => input.catalog.classes.find((item) => item.gradeId === grade.id && (item.label.trim().toLowerCase().endsWith(` ${stream.trim().toLowerCase()}`) || item.label.trim().toLowerCase() === stream.trim().toLowerCase()))?.key;
  const classItem = (grade: { id: string; label: string }, stream: string) => input.catalog.classes.find((item) => item.gradeId === grade.id && (item.label.trim().toLowerCase().endsWith(` ${stream.trim().toLowerCase()}`) || item.label.trim().toLowerCase() === stream.trim().toLowerCase()));
  const add = (type: ImportProposedAction["type"], fields: Record<string, unknown>) => actions.push({ actionId: actionId(), issueId: input.issueId, rowRefs: [input.teacherRef], type, teacherRef: input.teacherRef, ...fields } as ImportProposedAction);
  for (const relationship of input.interpretation.assignments) {
    const grade = gradeKey(relationship.grade) ? input.catalog.grades.find((item) => item.id === gradeKey(relationship.grade)) : undefined;
    if (!grade) continue;
    const subject = subjectKey(relationship.subject, grade);
    if (!subject) continue;
    add("add_subject_profile", { subjectOfferingKey: input.catalog.subjects.find((item) => item.id === subject)?.key });
    const gKey = input.catalog.grades.find((item) => item.id === grade.id)?.key;
    if (gKey && !relationship.stream) add("add_grade_context", { gradeKey: gKey });
    if (relationship.stream) {
      const group = classItem(grade, relationship.stream);
      const groupKey = classKey(grade, relationship.stream);
      if (group && groupKey) add("add_assignment_proposal", { subjectOfferingKey: input.catalog.subjects.find((item) => item.id === subject)?.key, classGroupKey: groupKey });
    }
  }
  for (const relationship of input.interpretation.homerooms) {
    const gradeId = gradeKey(relationship.grade);
    const grade = gradeId ? input.catalog.grades.find((item) => item.id === gradeId) : undefined;
    const group = grade ? classItem(grade, relationship.stream) : undefined;
    const groupKey = grade ? classKey(grade, relationship.stream) : undefined;
    if (!group || !groupKey) continue;
    add(/\b(replace|take over|remove the current)\b/i.test(input.instruction) ? "replace_homeroom" : "choose_homeroom", { classGroupKey: groupKey });
  }
  return actions;
}

export async function interpretTeacherRelationshipInstruction(input: { job: ITeacherImportJob; issueId: string; instructionText: string; submittedBy: string }, dependencies: TeacherRelationshipInterpreterDependencies = {}) {
  const issue = (input.job.analysisIssues || []).find((item) => item.issueId === input.issueId && item.status === "open");
  if (!issue) throw new Error("That review decision is no longer active.");
  const instruction = input.instructionText.trim(); if (!instruction) throw new Error("Tell Leo what you mean before submitting.");
  const loadRelationshipCatalog = dependencies.loadRelationshipCatalog ?? loadTeacherRelationshipCatalog;
  const catalog = await loadRelationshipCatalog(input.job.schoolId as mongoose.Types.ObjectId);
  const keys = [...catalog.grades, ...catalog.classes, ...catalog.subjects].map((item) => item.key);
  const pending = createPendingNaturalLanguageResolution({ issueId: issue.issueId, instructionText: instruction, submittedBy: input.submittedBy });
  input.job.naturalLanguageResolutions = [...(input.job.naturalLanguageResolutions || []), pending];
  const rows = issue.rowRefs.map((ref) => input.job.parsedRows.find((row) => rowRef(row) === ref)).filter((row): row is ITeacherImportParsedRow => Boolean(row));
  const runImportIntelligence = dependencies.runImportIntelligence ?? runLeoImportIntelligence;
  const interpretRelationships = dependencies.interpretRelationships ?? interpretTeacherTeachingRelationships;
  const index = (input.job.naturalLanguageResolutions || []).findIndex((entry) => entry.instructionId === pending.instructionId);
  const outputContract = {
    returnExactly: ["explanation", "confirmationText", "requiresConfirmation", "proposedActions"],
    topLevel: "explanation and confirmationText are strings; requiresConfirmation is true; proposedActions is an array.",
    everyAction: "Every action must contain actionId like action_123456, issueId set to the current issue ID, and rowRefs containing only the supplied row references.",
    actionFields: {
      choose_homeroom: ["teacherRef", "classGroupKey"],
      replace_homeroom: ["teacherRef", "classGroupKey"],
      clear_homeroom: ["teacherRef"],
      add_subject_profile: ["teacherRef", "subjectOfferingKey"],
      remove_subject_profile: ["teacherRef", "subjectOfferingKey"],
      add_grade_context: ["teacherRef", "gradeKey"],
      remove_grade_context: ["teacherRef", "gradeKey"],
      add_class_context: ["teacherRef", "classGroupKey"],
      remove_class_context: ["teacherRef", "classGroupKey"],
      add_assignment_proposal: ["teacherRef", "subjectOfferingKey", "classGroupKey"],
      remove_assignment_proposal: ["teacherRef", "subjectOfferingKey", "classGroupKey"],
      confirm_coteaching: ["teacherRef", "subjectOfferingKey", "classGroupKey"],
    },
    strictRules: "Use only the allowed action types and opaque catalog keys supplied below. Do not add extra properties. Do not return names where keys are required. If no safe proposal can be made, return proposedActions as an empty array and explain why.",
  };
  let result: Awaited<ReturnType<typeof runLeoImportIntelligence>> | null = null;
  let actions: ImportProposedAction[] = [];
  try {
    if (dependencies.runImportIntelligence) {
      result = await runImportIntelligence({ domain: "teacher", task: "interpret_admin_instruction", schoolId: input.job.schoolId as mongoose.Types.ObjectId, authorized: true, inputCount: rows.length, responseSchema: importProposalSchema, tracing: { schoolId: String(input.job.schoolId), importJobId: String(input.job._id) }, context: JSON.stringify({ instruction: "Interpret this one bounded teacher-import relationship instruction.", administratorInstruction: instruction, issue: { issueId: issue.issueId, rowRefs: issue.rowRefs, type: issue.issueType }, outputContract, teachers: rows.map((row) => ({ teacherRef: rowRef(row), name: name(row) })), catalog: { grades: catalog.grades.map(({ key, label }) => ({ key, label })), classes: catalog.classes.map(({ key, label, occupied }) => ({ key, label, occupied })), subjects: catalog.subjects.map(({ key, label, offeringGradeIds }) => ({ key, label, offeringGradeIds })) } }) });
      if (!result.ok) throw new Error(result.metadata.reason || "Leo could not interpret the instruction.");
      const validated = validateImportProposal({ proposal: result.data, allowedRowRefs: issue.rowRefs, allowedCatalogKeys: keys, allowedIssueIds: [issue.issueId] });
      if (!validated.ok) { input.job.naturalLanguageResolutions[index] = { ...pending, interpretationStatus: "invalid", explanation: "Leo suggested a relationship change that is not allowed for this import review." }; return input.job.naturalLanguageResolutions[index]; }
      actions = validated.proposal.proposedActions as ImportProposedAction[];
    } else {
      const gradeRows = catalog.grades.map(({ id, label }) => ({ id, name: label }));
      const interpretation = await interpretRelationships({ hint: instruction, context: { grades: gradeRows, subjectOfferings: catalog.subjects.map(({ id, label, offeringGradeIds }) => ({ id, displayName: label, shortName: "", code: "", gradeBand: "", gradeNames: [] })), classGroups: catalog.classes.map(({ label }) => ({ stream: label, gradeName: gradeRows.find((grade) => label.toLowerCase().startsWith(grade.name.toLowerCase()))?.name || "" })) }, useDeterministicFirst: false });
      actions = semanticActions({ instruction, issueId: issue.issueId, teacherRef: rowRef(rows[0]), catalog, interpretation });
    }
  } catch (error) {
    console.warn("teacher_import_relationship_leo_failed", {
      importJobId: String(input.job._id),
      issueId: issue.issueId,
      reasonCode: "interpreter_exception",
      reason: "The shared import intelligence runner threw before returning failure metadata.",
      lastErrorCode: "IMPORT_AI_INTERPRETER_EXCEPTION",
      retryable: true,
      provider: "unknown",
      model: process.env.LEO_IMPORT_MODEL || "gpt-4o-mini",
      failureSource: "exception",
      errorType: error instanceof Error ? error.name : "unknown",
    });
    input.job.naturalLanguageResolutions[index] = { ...pending, interpretationStatus: "failed", explanation: "Leo couldn't interpret that instruction right now. Use a manual option or try again." };
    return input.job.naturalLanguageResolutions[index];
  }
  const resolved = validateTeacherRelationshipPlan({ job: input.job, issueId: issue.issueId, actions, catalog });
  const plan: RelationshipPlan = { proposalId: `relationship_${id()}`, issueId: issue.issueId, instructionId: pending.instructionId, submittedBy: input.submittedBy, submittedAt: pending.submittedAt, status: resolved.validation.ok ? "interpreted" : "invalid", ...resolved, confirmedAt: null, confirmedBy: null, reopenedAt: null };
  input.job.relationshipPlans = [...(input.job.relationshipPlans || []), plan];
  input.job.naturalLanguageResolutions[index] = { ...pending, interpretationStatus: plan.status === "interpreted" ? "interpreted" : "invalid", proposedActions: plan.proposedActions, explanation: plan.validation.message || plan.preview.summary, confirmationText: plan.preview.summary };
  return plan;
}

/** Creates the same persisted, confirm-before-apply plan used by Leo without invoking a provider. */
export async function previewManualHomeroomPlan(input: { job: ITeacherImportJob; issueId: string; classGroupKey: string | null; replace?: boolean; submittedBy: string }) {
  const issue = (input.job.analysisIssues || []).find((item) => item.issueId === input.issueId && item.status === "open");
  if (!issue || !issue.rowRefs.length) throw new Error("That homeroom decision is no longer active.");
  const ref = issue.rowRefs[0]; const catalog = await loadTeacherRelationshipCatalog(input.job.schoolId as mongoose.Types.ObjectId);
  const action: ImportProposedAction = input.classGroupKey
    ? { actionId: `action_manual_${id()}`, issueId: issue.issueId, rowRefs: [ref], type: input.replace ? "replace_homeroom" : "choose_homeroom", teacherRef: ref, classGroupKey: input.classGroupKey }
    : { actionId: `action_manual_${id()}`, issueId: issue.issueId, rowRefs: [ref], type: "clear_homeroom", teacherRef: ref };
  const resolved = validateTeacherRelationshipPlan({ job: input.job, issueId: issue.issueId, actions: [action], catalog });
  const plan = { proposalId: `relationship_${id()}`, issueId: issue.issueId, instructionId: `manual_${id()}`, submittedBy: input.submittedBy, submittedAt: new Date().toISOString(), status: resolved.validation.ok ? "interpreted" : "invalid", ...resolved, confirmedAt: null, confirmedBy: null, reopenedAt: null, isReplacement: Boolean(input.replace) } as RelationshipPlan & { isReplacement: boolean };
  input.job.relationshipPlans = [...(input.job.relationshipPlans || []), plan];
  return plan;
}

export async function listManualHomeroomChoices(job: ITeacherImportJob, issueId: string) {
  const issue = (job.analysisIssues || []).find((item) => item.issueId === issueId && item.status === "open");
  if (!issue) throw new Error("That homeroom decision is no longer active.");
  const source = String(issue.sourceValues[0] || "").toLowerCase(); const catalog = await loadTeacherRelationshipCatalog(job.schoolId as mongoose.Types.ObjectId);
  return catalog.classes.map(({ key, label, occupied }) => ({ key, label, occupied: Boolean(occupied), recommended: !occupied && (source.includes(label.toLowerCase().split(" ").slice(0, -1).join(" ")) || false) })).sort((a, b) => Number(b.recommended) - Number(a.recommended) || Number(a.occupied) - Number(b.occupied) || a.label.localeCompare(b.label));
}

export async function confirmTeacherRelationshipPlan(input: { job: ITeacherImportJob; proposalId: string; confirmedBy: string; loadRelationshipCatalog?: typeof loadTeacherRelationshipCatalog }) {
  const plan = (input.job.relationshipPlans || []).find((value) => asRecord(value).proposalId === input.proposalId) as RelationshipPlan | undefined;
  if (!plan || plan.status === "invalid" || plan.status === "failed") throw new Error("That relationship proposal is not ready to confirm.");
  if (plan.confirmedAt) return plan;
  const issue = (input.job.analysisIssues || []).find((item) => item.issueId === plan.issueId && item.status === "open"); if (!issue) throw new Error("That decision has changed. Refresh the review before confirming.");
  const catalog = await (input.loadRelationshipCatalog || loadTeacherRelationshipCatalog)(input.job.schoolId as mongoose.Types.ObjectId);
  for (const action of plan.resolvedActions) {
    if (action.type !== "replace_homeroom") continue;
    const current = catalog.classes.find((item) => item.id === action.classGroupId);
    if (!current || current.occupiedTeacherId !== action.expectedHomeroomTeacherId) {
      throw new Error("This homeroom changed after the replacement preview. Refresh and confirm the current teacher instead.");
    }
  }
  const revalidated = validateTeacherRelationshipPlan({ job: input.job, issueId: plan.issueId, actions: plan.proposedActions, catalog });
  if (!revalidated.validation.ok) throw new Error(revalidated.validation.message || "One selected school item is no longer available.");
  plan.resolvedActions = revalidated.resolvedActions; plan.validation = revalidated.validation; plan.preview = revalidated.preview;
  plan.beforeRows = [...new Set(plan.resolvedActions.map((action) => String(action.teacherRef)))].map((ref) => {
    const row = input.job.parsedRows.find((candidate) => rowRef(candidate) === ref);
    return { rowRef: ref, subjectOfferingIds: [...(row?.subjectOfferingIds || [])], gradeScopeIds: [...(row?.gradeScopeIds || [])], gradeScopes: [...(row?.gradeScopes || [])], classScopeIds: [...(row?.classScopeIds || [])], classScopes: [...(row?.classScopes || [])], explicitAssignments: [...(row?.explicitAssignments || [])], homeroomClassGroupId: row?.homeroomClassGroupId || null, homeroomClass: row?.homeroomClass || null };
  });
  applyResolvedActions(input.job, plan); plan.status = "confirmed"; plan.confirmedAt = new Date().toISOString(); plan.confirmedBy = input.confirmedBy;
  input.job.analysisIssues = (input.job.analysisIssues || []).map((candidate) => candidate.issueId === plan.issueId
    ? { ...candidate, status: "resolved", resolvedBy: "admin_via_leo", resolvedAction: plan.proposedActions[0] || null, updatedAt: plan.confirmedAt! }
    : candidate);
  for (const ref of new Set(plan.resolvedActions.map((action) => String(action.teacherRef)))) {
    const row = input.job.parsedRows.find((candidate) => rowRef(candidate) === ref);
    if (!row) continue;
    const hasHomeroomResolution = plan.resolvedActions.some((action) => String(action.teacherRef) === ref && ["choose_homeroom", "replace_homeroom", "clear_homeroom"].includes(String(action.type)));
    row.issues = row.issues.filter((item) => {
      if (item.groupedIssueId === plan.issueId) return false;
      if (item.field === "teacherRelationships" && (item.code === issue.issueType || item.code.startsWith("attention_"))) return false;
      if (hasHomeroomResolution && ["homeroomClass", "homeroomClassGroupId"].includes(item.field || "") && ["occupied_homeroom", "duplicate_homeroom", "ambiguous", "not_found", "admin_decision_invalidated"].includes(item.code)) return false;
      return true;
    });
    const blocked = row.issues.some((item) => ["blocked", "missing_required", "invalid", "duplicate", "not_found"].includes(item.code));
    row.resolutionStatus = blocked ? "blocked" : row.issues.length ? "needs_review" : "resolved";
    row.rowState = row.resolutionStatus === "resolved" ? "ready" : "pending";
  }
  const remaining = refreshTeacherImportReviewState(input.job);
  console.info("teacher_import_issue_resolution", { importJobId: String(input.job._id), issueId: issue.issueId, issueType: issue.issueType, previousStatus: "open", newStatus: "resolved", resolutionSource: "admin_via_leo", remainingAttentionCount: remaining.attentionCount });
  return plan;
}

export function reopenTeacherRelationshipPlan(job: ITeacherImportJob, proposalId: string) {
  const plan = (job.relationshipPlans || []).find((value) => asRecord(value).proposalId === proposalId) as RelationshipPlan | undefined;
  if (!plan || !plan.confirmedAt) throw new Error("That confirmed relationship proposal is no longer available.");
  for (const snapshot of plan.beforeRows || []) {
    const row = job.parsedRows.find((candidate) => rowRef(candidate) === snapshot.rowRef); if (!row) continue;
    row.subjectOfferingIds = Array.isArray(snapshot.subjectOfferingIds) ? snapshot.subjectOfferingIds.map(String) : row.subjectOfferingIds;
    row.gradeScopeIds = Array.isArray(snapshot.gradeScopeIds) ? snapshot.gradeScopeIds.map(String) : row.gradeScopeIds;
    row.gradeScopes = Array.isArray(snapshot.gradeScopes) ? snapshot.gradeScopes.map(String) : row.gradeScopes;
    row.classScopeIds = Array.isArray(snapshot.classScopeIds) ? snapshot.classScopeIds.map(String) : row.classScopeIds;
    row.classScopes = Array.isArray(snapshot.classScopes) ? snapshot.classScopes.map(String) : row.classScopes;
    row.explicitAssignments = Array.isArray(snapshot.explicitAssignments) ? snapshot.explicitAssignments as ITeacherImportParsedRow["explicitAssignments"] : row.explicitAssignments;
    row.homeroomClassGroupId = typeof snapshot.homeroomClassGroupId === "string" ? snapshot.homeroomClassGroupId : null;
    row.homeroomClass = typeof snapshot.homeroomClass === "string" ? snapshot.homeroomClass : null;
  }
  plan.status = "reopened"; plan.reopenedAt = new Date().toISOString(); plan.confirmedAt = null; plan.confirmedBy = null;
  job.analysisIssues = (job.analysisIssues || []).map((candidate) => candidate.issueId === plan.issueId
    ? { ...candidate, status: "open", resolvedBy: null, resolvedAction: null, updatedAt: plan.reopenedAt! }
    : candidate);
  return plan;
}
