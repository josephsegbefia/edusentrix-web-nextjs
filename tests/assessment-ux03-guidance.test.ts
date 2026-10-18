import assert from "node:assert/strict";
import test from "node:test";
import {
  describeAssessAccessBlocker,
  hasAssessActivity,
  PAPER_WORKFLOW_STEPS,
} from "@/lib/assess/assessment-ux-guidance";

test("UX03 explains an inactive-school Premium blocker without weakening the gate", () => {
  const blocker = describeAssessAccessBlocker(
    "Premium Assess publication requires an active school.",
  );

  assert.equal(blocker.kind, "school-not-active");
  assert.match(blocker.title, /not active/i);
  assert.match(blocker.resolution, /platform administrator/i);
  assert.match(blocker.resolution, /Core examinations/i);
});

test("UX03 distinguishes Premium plan and unknown access failures", () => {
  assert.equal(
    describeAssessAccessBlocker(
      "Premium Assess publication requires an Enterprise entitlement.",
    ).kind,
    "premium-plan",
  );
  assert.equal(
    describeAssessAccessBlocker("Unexpected entitlement response").kind,
    "access-unavailable",
  );
});

test("first-use guidance is based only on persisted activity", () => {
  const empty = {
    metrics: {
      publishedExaminations: 0,
      issuedPaperPackets: 0,
      candidateAssignments: 0,
      evidenceRequiringAttention: 0,
      markingAwaitingReview: 0,
      approvedAwaitingHandoff: 0,
    },
    attention: [],
    recentExaminations: [],
  };

  assert.equal(hasAssessActivity(empty), false);
  assert.equal(
    hasAssessActivity({
      ...empty,
      metrics: { ...empty.metrics, publishedExaminations: 1 },
    }),
    true,
  );
});

test("paper journey keeps the operational sequence explicit", () => {
  assert.deepEqual(
    PAPER_WORKFLOW_STEPS.map((step) => step.id),
    ["paper-delivery", "packets", "assignments", "evidence", "marking", "approved-results"],
  );
  assert.equal(PAPER_WORKFLOW_STEPS[0].label, "Prepare paper");
  assert.equal(PAPER_WORKFLOW_STEPS.at(-1)?.label, "Send marks");
});
