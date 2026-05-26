import type { AdventureDifficulty } from "@/lib/learn/explore/explore-types";

export const EXPLORE_BADGE_ID = "badge-curious-path";
export const EXPLORE_BADGE_NAME = "Curious Path";
export const EXPLORE_BADGE_MISSIONS_REQUIRED = 3;

const DIFFICULTY_XP_BONUS: Record<AdventureDifficulty, number> = {
  easy: 0,
  standard: 10,
  stretch: 20,
};

export function computeExploreXpAwarded(input: {
  estimatedMinutes: number;
  difficulty: AdventureDifficulty;
  quizScorePercent?: number;
}): number {
  const base = Math.max(40, Math.round(input.estimatedMinutes * 8));
  const quizBonus = Math.round(
    Math.min(100, Math.max(0, input.quizScorePercent ?? 0)) * 0.12
  );
  return base + DIFFICULTY_XP_BONUS[input.difficulty] + quizBonus;
}

export function buildExploreCelebrationMessage(quizScorePercent: number): string {
  if (quizScorePercent >= 75) {
    return "Brilliant exploring! Leo is proud — you went beyond class and nailed the mission quiz.";
  }
  if (quizScorePercent >= 50) {
    return "Mission complete! You explored new ideas today — keep going and your badge will unlock soon.";
  }
  return "You finished the mission! Review the fun facts once more and your next Explore will feel easier.";
}

export type ExploreBadgeProgressPayload = {
  id: string;
  name: string;
  progressPercent: number;
  progressLabel: string;
  earned: boolean;
};

export function buildExploreBadgeProgress(
  completedExploreCount: number
): ExploreBadgeProgressPayload {
  const earned = completedExploreCount >= EXPLORE_BADGE_MISSIONS_REQUIRED;
  const progressPercent = earned
    ? 100
    : Math.min(
        100,
        Math.round((completedExploreCount / EXPLORE_BADGE_MISSIONS_REQUIRED) * 100)
      );
  const remaining = Math.max(0, EXPLORE_BADGE_MISSIONS_REQUIRED - completedExploreCount);

  let progressLabel: string;
  if (earned) {
    progressLabel = "Curious Path badge unlocked — nice exploring!";
  } else if (remaining === 1) {
    progressLabel = "One more Explore mission unlocks your Curious Path badge.";
  } else {
    progressLabel = `${remaining} more Explore missions unlock your Curious Path badge.`;
  }

  return {
    id: EXPLORE_BADGE_ID,
    name: EXPLORE_BADGE_NAME,
    progressPercent,
    progressLabel,
    earned,
  };
}

export type ExploreCompleteRewardPayload = {
  xpAwarded: number;
  badge: ExploreBadgeProgressPayload;
  celebrationMessage: string;
};

export function buildExploreCompleteReward(input: {
  estimatedMinutes: number;
  difficulty: AdventureDifficulty;
  quizScorePercent: number;
  completedExploreCount: number;
}): ExploreCompleteRewardPayload {
  return {
    xpAwarded: computeExploreXpAwarded({
      estimatedMinutes: input.estimatedMinutes,
      difficulty: input.difficulty,
      quizScorePercent: input.quizScorePercent,
    }),
    badge: buildExploreBadgeProgress(input.completedExploreCount),
    celebrationMessage: buildExploreCelebrationMessage(input.quizScorePercent),
  };
}
