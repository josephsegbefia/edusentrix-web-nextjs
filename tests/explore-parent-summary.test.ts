import assert from "node:assert/strict";
import test from "node:test";

import { buildExploreParentSummary } from "../src/lib/learn/explore/explore-parent-summary-builder";

const baseContent = {
  title: "Energy Detective",
  subjectName: "Integrated Science",
  sourceLessonTitle: "Energy transfer",
  gradeName: "JHS 1",
  difficulty: "standard" as const,
  estimatedMinutes: 9,
  missionType: "detective" as const,
  adventureAngle: "Home energy clues beyond class notes.",
  studentPromise: "Spot energy moving at home.",
  intro: "Leo built a home detective mission.",
  category: "go_deeper" as const,
  sourceLessonId: "session-abc",
  deepDiveExplanation: {
    title: "Energy keeps moving",
    conceptBridge: "Class food chains.",
    deeperExplanation: "Energy changes form in kitchens and phones.",
    realWorldConnection: "Solar lamps in Ghana use sunlight.",
  },
  misconceptions: [
    {
      id: "m1",
      misconception: "Energy disappears after use.",
      whyStudentsThinkThis: "Using feels like losing it.",
      leoCorrection: "Energy changes form instead.",
      quickCheckPrompt: "Name one example.",
    },
  ],
  vocabulary: [{ id: "v1", word: "Transfer", meaning: "Moves between things.", simpleExample: "Heat to soup." }],
  funFacts: [
    { id: "f1", headline: "Ghana", fact: "Solar helps lights work.", whyItMatters: "Real life." },
    { id: "f2", headline: "Food", fact: "Breakfast gives movement energy.", whyItMatters: "Body fuel." },
  ],
  curiosityPathways: [{ id: "c1", label: "More", description: "D", nextAdventurePrompt: "P" }],
  endingQuiz: {
    id: "q1",
    title: "Quiz",
    questions: [],
  },
  parentConversationPrompt: {
    title: "Talk at home",
    prompt: "Ask your child to explain one home energy example.",
    expectedLearningOutcome: "Child explains transfer.",
  },
};

test("buildExploreParentSummary returns parent-safe fields without audit metadata", () => {
  const summary = buildExploreParentSummary({
    adventureId: "adventure-abc123",
    studentId: "student-1",
    title: "Energy Detective",
    subjectName: "Integrated Science",
    sourceLessonTitle: "Energy transfer",
    gradeName: "JHS 1",
    exploredAt: new Date().toISOString(),
    record: {
      status: "completed",
      quizScorePercent: 75,
      correctCount: 3,
      totalCount: 4,
    },
    content: baseContent,
  });

  assert.equal(summary.thingsLearned.length >= 2, true);
  assert.ok(summary.whatChildExplored.includes("Leo"));
  assert.ok(summary.possibleStruggle?.includes("Energy"));
  assert.equal(summary.parentConversation?.title, "Talk at home");
  assert.equal(summary.quizSummary?.scorePercent, 75);
  assert.equal("contentSnapshotId" in summary, false);
  assert.equal("generationKey" in summary, false);
  assert.equal("aiMetadata" in summary, false);
});
