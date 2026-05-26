import assert from "node:assert/strict";
import test from "node:test";

import {
  buildExploreBadgeProgress,
  buildExploreCompleteReward,
  computeExploreXpAwarded,
  EXPLORE_BADGE_MISSIONS_REQUIRED,
} from "../src/lib/learn/explore/explore-completion-rewards";

test("computeExploreXpAwarded scales with minutes, difficulty, and quiz score", () => {
  const standard = computeExploreXpAwarded({
    estimatedMinutes: 9,
    difficulty: "standard",
    quizScorePercent: 75,
  });
  assert.equal(standard, 72 + 10 + 9);

  const stretch = computeExploreXpAwarded({
    estimatedMinutes: 10,
    difficulty: "stretch",
    quizScorePercent: 100,
  });
  assert.ok(stretch > standard);
});

test("buildExploreBadgeProgress tracks missions toward unlock", () => {
  const first = buildExploreBadgeProgress(1);
  assert.equal(first.progressPercent, 33);
  assert.match(first.progressLabel, /2 more/);

  const unlocked = buildExploreBadgeProgress(EXPLORE_BADGE_MISSIONS_REQUIRED);
  assert.equal(unlocked.earned, true);
  assert.equal(unlocked.progressPercent, 100);
});

test("buildExploreCompleteReward bundles xp, badge, and message", () => {
  const reward = buildExploreCompleteReward({
    estimatedMinutes: 8,
    difficulty: "easy",
    quizScorePercent: 80,
    completedExploreCount: 2,
  });
  assert.ok(reward.xpAwarded >= 40);
  assert.equal(reward.badge.earned, false);
  assert.match(reward.celebrationMessage, /Brilliant/i);
});
