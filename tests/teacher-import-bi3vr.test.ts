import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import type { ImportProposedAction } from "@/lib/import-intelligence/types";
import { normalizeTeacherRelationshipClassLabel, validateTeacherRelationshipPlan, type TeacherRelationshipCatalog } from "@/lib/teachers/teacher-relationship-plan";
import type { ITeacherImportJob } from "@/models/TeacherImportJob";

const now = "2026-10-14T00:00:00.000Z";
const catalog: TeacherRelationshipCatalog = {
  grades: [{ key: "GRADE_1", id: "grade-primary6", label: "Primary 6" }, { key: "GRADE_2", id: "grade-jhs1", label: "JHS 1" }],
  classes: [{ key: "CLASS_1", id: "class-primary6a", gradeId: "grade-primary6", label: "Primary 6 A" }, { key: "CLASS_2", id: "class-jhs1a", gradeId: "grade-jhs1", label: "JHS 1 A" }, { key: "CLASS_3", id: "class-jhs1b", gradeId: "grade-jhs1", label: "JHS 1 B", occupied: true }],
  subjects: [{ key: "SUBJECT_1", id: "subject-french-p6", label: "French - Upper Primary", offeringGradeIds: ["grade-primary6"] }, { key: "SUBJECT_2", id: "subject-maths-jhs", label: "Mathematics - JHS", offeringGradeIds: ["grade-jhs1"] }],
};
function job(): ITeacherImportJob {
  return {
    parsedRows: [{ sourceRowNumber: 2, rowRef: "T002", firstName: "Isaac", lastName: "Addo", middleNames: [], sourceValues: {}, email: "isaac@example.test", subjects: [], gradeScopes: [], gradeScopeIds: [], classScopes: [], classScopeIds: [], explicitAssignments: [], subjectOfferingIds: [], subjectIds: [], resolutionStatus: "needs_review", rowState: "pending", issues: [] }],
    analysisIssues: [{ issueId: "issue_isaac", domain: "teacher", scope: "row", rowRefs: ["T002"], fieldKey: "homeroomClass", issueType: "occupied_homeroom", severity: "warning", sourceValues: ["JHS 1 B"], explanation: "Occupied", candidateActions: [], resolutionClass: "REVIEW", requiresHumanConfirmation: true, status: "open", createdAt: now, updatedAt: now }],
  } as unknown as ITeacherImportJob;
}
function action(type: string, extra: Record<string, unknown>): ImportProposedAction { return { actionId: "action_123456", issueId: "issue_isaac", rowRefs: ["T002"], type: type as ImportProposedAction["type"], teacherRef: "T002", ...extra }; }

test("BI.3VR normalizes already-qualified and suffix-only class labels", () => {
  assert.equal(normalizeTeacherRelationshipClassLabel("JHS 1", "JHS 1 A"), "JHS 1 A");
  assert.equal(normalizeTeacherRelationshipClassLabel("JHS 1", "A"), "JHS 1 A");
});

test("BI.3VR retargets the current imported teacher without a domain write", () => {
  const result = validateTeacherRelationshipPlan({ job: job(), issueId: "issue_isaac", catalog, actions: [action("choose_homeroom", { classGroupKey: "CLASS_2" })] });
  assert.equal(result.validation.ok, true);
  assert.deepEqual(result.preview.changes, ["Set Isaac Addo's homeroom to JHS 1 A"]);
  assert.equal(String(result.resolvedActions[0]?.classGroupId), "class-jhs1a");
});

test("BI.3VR rejects an occupied homeroom unless replacement is explicit", () => {
  const result = validateTeacherRelationshipPlan({ job: job(), issueId: "issue_isaac", catalog, actions: [action("choose_homeroom", { classGroupKey: "CLASS_3" })] });
  assert.equal(result.validation.ok, false);
  assert.match(result.validation.message || "", /already has a homeroom teacher/);
});

test("BI.3VR distinguishes grade context from an explicit class teaching proposal", () => {
  const gradeOnly = validateTeacherRelationshipPlan({ job: job(), issueId: "issue_isaac", catalog, actions: [action("add_subject_profile", { subjectOfferingKey: "SUBJECT_1" }), action("add_grade_context", { gradeKey: "GRADE_1" })] });
  const classProposal = validateTeacherRelationshipPlan({ job: job(), issueId: "issue_isaac", catalog, actions: [action("add_assignment_proposal", { subjectOfferingKey: "SUBJECT_1", classGroupKey: "CLASS_1" })] });
  assert.equal(gradeOnly.validation.ok, true);
  assert.equal(gradeOnly.resolvedActions.some((value) => value.type === "add_assignment_proposal"), false);
  assert.equal(classProposal.validation.ok, true);
  assert.equal(classProposal.resolvedActions[0]?.type, "add_assignment_proposal");
});

test("BI.3VR rejects contradictory subject changes and retains no final-domain writers", () => {
  const result = validateTeacherRelationshipPlan({ job: job(), issueId: "issue_isaac", catalog, actions: [action("add_subject_profile", { subjectOfferingKey: "SUBJECT_2" }), action("remove_subject_profile", { subjectOfferingKey: "SUBJECT_2" })] });
  assert.equal(result.validation.ok, false);
  assert.match(result.validation.message || "", /both adds and removes/);
  const source = readFileSync(join(process.cwd(), "src/lib/teachers/teacher-relationship-plan.ts"), "utf8");
  assert.doesNotMatch(source, /from "@\/models\/Teacher"/);
  assert.doesNotMatch(source, /from "@\/models\/TeacherAssignment"/);
  assert.doesNotMatch(source, /Teacher\.update|TeacherAssignment\.(create|update|insert)/);
});

test("BI.3VR accepts explicit occupied-homeroom replacement but records a warning", () => {
  const result = validateTeacherRelationshipPlan({ job: job(), issueId: "issue_isaac", catalog, actions: [action("replace_homeroom", { classGroupKey: "CLASS_3" })] });
  assert.equal(result.validation.ok, true);
  assert.equal(result.resolvedActions[0]?.type, "replace_homeroom");
  assert.match(result.validation.warnings.join(" "), /already has a homeroom teacher/);
});

test("BI.3VR keeps clear homeroom separate from subject and assignment changes", () => {
  const result = validateTeacherRelationshipPlan({ job: job(), issueId: "issue_isaac", catalog, actions: [action("clear_homeroom", {})] });
  assert.equal(result.validation.ok, true);
  assert.equal(result.resolvedActions[0]?.type, "clear_homeroom");
  assert.equal(result.resolvedActions.some((value) => value.type === "add_assignment_proposal"), false);
});

test("BI.3VR rejects an unknown or inactive-equivalent opaque catalog key", () => {
  const result = validateTeacherRelationshipPlan({ job: job(), issueId: "issue_isaac", catalog, actions: [action("add_assignment_proposal", { subjectOfferingKey: "SUBJECT_2", classGroupKey: "CLASS_404" })] });
  assert.equal(result.validation.ok, false);
  assert.match(result.validation.message || "", /no longer available/);
});

test("BI.3VR deduplicates duplicate assignment proposals", () => {
  const item = action("add_assignment_proposal", { subjectOfferingKey: "SUBJECT_2", classGroupKey: "CLASS_2" });
  const result = validateTeacherRelationshipPlan({ job: job(), issueId: "issue_isaac", catalog, actions: [item, { ...item, actionId: "action_654321" }] });
  assert.equal(result.validation.ok, true);
  assert.equal(result.resolvedActions.length, 1);
});

test("BI.3VR does not allow a relationship action to escape the current issue row", () => {
  const result = validateTeacherRelationshipPlan({ job: job(), issueId: "issue_isaac", catalog, actions: [{ ...action("choose_homeroom", { classGroupKey: "CLASS_2" }), teacherRef: "T999", rowRefs: ["T999"] }] });
  assert.equal(result.validation.ok, false);
  assert.match(result.validation.message || "", /outside this decision/);
});
