import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { buildTeacherImportReviewDto, subjectOfferingIdForReviewIssue } from "@/lib/teachers/teacher-import-review-dto";
import { attentionIssueForSignal, detectTeacherAttentionSignals } from "@/lib/teachers/teacher-attention-review";
import { attentionSimilarityKey, findSimilarRowsForPlan, templateForRelationshipPlan } from "@/lib/teachers/teacher-attention-similarity";

const now = "2026-10-14T00:00:00.000Z";
const source = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

function reviewJob() {
  return {
    importSchemaVersion: 2, analysisVersion: "v2", updatedAt: now,
    analysisSummary: { totalRows: 18, readyRows: 4, needsReviewRows: 14, blockedRows: 0, autoResolutionCount: 46 },
    parsedRows: [
      { sourceRowNumber: 2, rowRef: "T002", firstName: "Abena", lastName: "Asante", homeroomGrade: "Primary 1", homeroomClass: "A", subjects: ["History - Primary"], resolutionStatus: "needs_review", issues: [{}] },
      { sourceRowNumber: 3, rowRef: "T003", firstName: "Kojo", lastName: "Mensah", homeroomGrade: "Primary 1", homeroomClass: "B", subjects: ["History - Primary"], resolutionStatus: "needs_review", issues: [{}] },
      { sourceRowNumber: 4, rowRef: "T004", firstName: "Mariam", lastName: "Sulemana", homeroomGrade: "JHS 3", homeroomClass: "A", subjects: ["French - Primary"], resolutionStatus: "needs_review", issues: [{}] },
    ],
    subjectResolutions: [{ sourceValue: "History - Primary", candidateOptions: [{ id: "507f1f77bcf86cd799439011", label: "Our World and Our People - Lower Primary" }], affectedRows: [2, 3] }],
    analysisIssues: [
      { issueId: "issue_history_lower", domain: "teacher", scope: "group", rowRefs: ["T002", "T003"], fieldKey: "subjects", issueType: "subject_unresolved", severity: "warning", sourceValues: ["History - Primary"], explanation: "No direct offering.", candidateActions: [], resolutionClass: "REVIEW", requiresHumanConfirmation: true, status: "open", context: { gradeBand: "lower_primary" }, affectedCount: 2, createdAt: now, updatedAt: now },
      { issueId: "issue_mariam", domain: "teacher", scope: "row", rowRefs: ["T004"], fieldKey: "subjects", issueType: "stage_mismatch", severity: "warning", sourceValues: ["French - Primary"], explanation: "JHS context.", candidateActions: [], resolutionClass: "REVIEW", requiresHumanConfirmation: true, status: "open", createdAt: now, updatedAt: now },
    ],
  };
}

test("BI.3 review DTO counts decisions, not affected rows, and only exposes opaque catalog choices", () => {
  const job = reviewJob();
  const dto = buildTeacherImportReviewDto(job);
  assert.equal(dto.summary.totalTeachers, 3);
  assert.equal(dto.summary.reviewTeachers, 3);
  assert.equal(dto.summary.decisionCount, 2);
  assert.equal(dto.activeIssues[0]?.affectedCount, 2);
  assert.equal(dto.activeIssues[0]?.affectedTeachers.length, 2);
  assert.equal(dto.activeIssues[0]?.candidates[0]?.key, "SUBJECT_1");
  assert.equal(dto.activeIssues[0]?.candidates[0]?.label, "Our World and Our People - Lower Primary");
  assert.equal(JSON.stringify(dto).includes("507f1f77bcf86cd799439011"), false);
  assert.equal(subjectOfferingIdForReviewIssue(job, "issue_history_lower", "SUBJECT_1"), "507f1f77bcf86cd799439011");
});

test("BI.4 review summary counts are derived from parsed teacher rows", () => {
  const dto = buildTeacherImportReviewDto({
    parsedRows: [
      { rowRef: "T001", firstName: "Ready", lastName: "Teacher", resolutionStatus: "resolved", explicitAssignments: [{ status: "resolved", subjectValue: "Mathematics", classValue: "JHS 1 A" }] },
      { rowRef: "T002", firstName: "Review", lastName: "Teacher", resolutionStatus: "needs_review" },
      { rowRef: "T003", firstName: "Blocked", lastName: "Teacher", resolutionStatus: "blocked" },
    ],
    analysisSummary: { totalRows: 17, readyRows: 17, needsReviewRows: 0, blockedRows: 0 },
    analysisIssues: [],
  });
  assert.deepEqual(dto.summary, { totalTeachers: 3, readyTeachers: 1, reviewTeachers: 1, blockedTeachers: 1, decisionCount: 0, automaticMatches: 0 });
  assert.deepEqual(dto.rows[0]?.assignments, ["Mathematics · JHS 1 A"]);
});

test("BI.4A detects a broad Primary class-teacher pattern without creating assignments", () => {
  const row = {
    sourceRowNumber: 2,
    rowRef: "T002",
    firstName: "Abena",
    lastName: "Asante",
    sourceValues: {},
    middleNames: [],
    email: "",
    subjects: [],
    gradeScopes: [],
    gradeScopeIds: [],
    classScopes: [],
    classScopeIds: [],
    explicitAssignments: [],
    subjectOfferingIds: ["s1", "s2", "s3", "s4", "s5", "s6"],
    subjectIds: [],
    homeroomGrade: "Primary 1",
    homeroomClass: "A",
    homeroomClassGroupId: "class-p1a",
    resolutionStatus: "resolved",
    rowState: "ready",
    issues: [],
  } as never;
  const signals = detectTeacherAttentionSignals({ rows: [row], subjectLabelsById: new Map([
    ["s1", "English Language - Lower Primary"], ["s2", "Mathematics - Lower Primary"], ["s3", "Science - Lower Primary"],
    ["s4", "Creative Arts - Lower Primary"], ["s5", "Ghanaian Language - Lower Primary"], ["s6", "Our World and Our People - Lower Primary"],
  ]) });
  const primary = signals.find((signal) => signal.type === "possible_primary_class_teacher_pattern");
  assert.ok(primary);
  assert.equal(primary.gradeBand, "primary");
  assert.equal(attentionIssueForSignal(primary).resolutionClass, "REVIEW");
});

test("BI.4A2 similarity keeps issue type and curriculum context in the key", () => {
  const row = { sourceRowNumber: 2, subjectOfferingIds: ["s1", "s2"], subjects: [], classScopeIds: [], explicitAssignments: [], homeroomClassGroupId: "c1" } as never;
  const lower = attentionIssueForSignal({ rowRef: "T002", type: "possible_primary_class_teacher_pattern", label: "Possible class-teacher pattern", explanation: "", gradeBand: "primary", similarityKey: "x" });
  const upper = { ...lower, issueType: lower.issueType, context: { gradeBand: "jhs" } };
  assert.notEqual(attentionSimilarityKey(lower, row), attentionSimilarityKey(upper, row));
});

test("BI.4A3 derives the semantic own-homeroom template without copying the representative class", () => {
  const representative = { rowRef: "T002", sourceRowNumber: 2, homeroomClassGroupId: "class-p1a", subjectOfferingIds: ["s1"], classScopeIds: [], explicitAssignments: [], resolutionStatus: "resolved" } as never;
  const similar = { rowRef: "T003", sourceRowNumber: 3, homeroomClassGroupId: "class-p1b", subjectOfferingIds: ["s1"], classScopeIds: [], explicitAssignments: [], resolutionStatus: "needs_review" } as never;
  const issue = { issueId: "attention_primary_T002", issueType: "attention_possible_primary_class_teacher_pattern", status: "resolved", rowRefs: ["T002"], sourceValues: ["Possible class-teacher pattern"], context: { gradeBand: "primary" } } as never;
  const similarIssue = { issueId: "attention_primary_T003", issueType: issue.issueType, status: "open", rowRefs: ["T003"], sourceValues: issue.sourceValues, context: issue.context } as never;
  const plan = { proposalId: "relationship_1", issueId: issue.issueId, status: "confirmed", resolvedActions: [{ type: "add_assignment_proposal", classGroupId: "class-p1a" }] } as never;
  const job = { parsedRows: [representative, similar], analysisIssues: [issue, similarIssue] } as never;
  assert.equal(templateForRelationshipPlan(plan, representative), "TEACH_LISTED_SUBJECTS_IN_OWN_HOMEROOM");
  const result = findSimilarRowsForPlan(job, plan);
  assert.deepEqual(result.rows.map((row) => row.homeroomClassGroupId), ["class-p1b"]);
});

test("BI.3 keeps the V2 review navigator scoped and removes the old giant review surface from the active path", () => {
  const modal = source("src/components/modals/ImportTeachersCSVModal.tsx");
  const review = source("src/components/admin/teachers/import/TeacherImportReviewV2.tsx");
  assert.match(modal, /TeacherImportReviewV2 jobId=\{job\.id\}/);
  assert.match(review, /Decision \{position\} of \{review\.activeIssues\.length\}/);
  assert.match(review, /Tell Leo what you mean/);
  assert.doesNotMatch(review, /AdminLeoEntry/);
  assert.match(review, /dark:bg-amber-400\/10/);
  assert.match(review, /aria-label=\{`Decision/);
  assert.match(review, /Homeroom:<\/span> \{row\.homeroom \|\| "None"\}/);
  assert.match(review, /Subjects:<\/span> \{row\.subjectProfile/);
  assert.match(review, /Review all teachers/);
  assert.match(review, /All imported teachers/);
  assert.match(review, /Assignments:<\/span>/);
  assert.doesNotMatch(review, /subjectCount\} subjects/);
});

test("BI.3 V1 jobs remain outside the V2 review queue", () => {
  const dto = buildTeacherImportReviewDto({ importSchemaVersion: 1, analysisVersion: "v1", parsedRows: [], analysisIssues: [] });
  assert.equal(dto.compatibility.outcome, "restart_required");
});
