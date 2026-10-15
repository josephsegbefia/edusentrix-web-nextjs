import assert from "node:assert/strict";
import test from "node:test";
import { getTeacherImportReviewState } from "@/lib/teachers/teacher-import-review-state";

const issue = (overrides: Record<string, unknown> = {}) => ({ issueId: "issue_1", domain: "teacher", scope: "row", rowRefs: ["T001"], issueType: "attention_possible_primary_class_teacher_pattern", severity: "warning", sourceValues: ["pattern"], explanation: "review", candidateActions: [], resolutionClass: "REVIEW", requiresHumanConfirmation: true, status: "open", createdAt: "2026-10-14T00:00:00.000Z", updatedAt: "2026-10-14T00:00:00.000Z", ...overrides }) as never;

test("BI.4B canonical state counts rows from persisted open issues", () => {
  const state = getTeacherImportReviewState({ parsedRows: [
    { sourceRowNumber: 1, rowRef: "T001", resolutionStatus: "resolved" },
    { sourceRowNumber: 2, rowRef: "T002", resolutionStatus: "resolved" },
    { sourceRowNumber: 3, rowRef: "T003", resolutionStatus: "blocked" },
  ] as never, analysisIssues: [issue()] });
  assert.deepEqual({ total: state.totalRows, ready: state.readyCount, attention: state.attentionCount, blocked: state.blockedCount, canProceed: state.canProceedToFinalConfirmation }, { total: 3, ready: 1, attention: 1, blocked: 1, canProceed: false });
});

test("BI.4B resolved historical issues do not block final confirmation", () => {
  const state = getTeacherImportReviewState({ parsedRows: [
    { sourceRowNumber: 1, rowRef: "T001", resolutionStatus: "resolved" },
    { sourceRowNumber: 2, rowRef: "T002", resolutionStatus: "resolved" },
  ] as never, analysisIssues: [issue({ status: "resolved", resolvedBy: "admin_via_leo" }), issue({ issueId: "issue_2", rowRefs: ["T002"], status: "resolved", resolvedBy: "admin_apply_similar" })] });
  assert.equal(state.readyCount, 2);
  assert.equal(state.attentionCount, 0);
  assert.equal(state.blockedCount, 0);
  assert.equal(state.canProceedToFinalConfirmation, true);
});

test("BI.4B one actual open issue blocks final confirmation", () => {
  const state = getTeacherImportReviewState({ parsedRows: [{ sourceRowNumber: 1, rowRef: "T001", resolutionStatus: "resolved" }] as never, analysisIssues: [issue()] });
  assert.equal(state.readyCount + state.attentionCount + state.blockedCount, 1);
  assert.equal(state.canProceedToFinalConfirmation, false);
});
