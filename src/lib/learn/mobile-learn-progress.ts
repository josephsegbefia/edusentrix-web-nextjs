import "server-only";

import type { ILearnActivityEvent } from "@/models/LearnActivityEvent";

export const XP_PER_QUEST = 80;
export const XP_PER_FLASHCARD = 12;
export const XP_PER_ACTIVITY = 10;
export const XP_PER_LEVEL = 300;

export const LEVEL_TITLES = [
  "Bright Starter",
  "Curious Explorer",
  "Steady Learner",
  "Revision Hero",
  "Topic Champion",
];

export type ActivityRow = Pick<
  ILearnActivityEvent,
  "eventType" | "occurredAt" | "durationSeconds" | "topic" | "metadata" | "score"
>;

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function xpForEvent(event: ActivityRow): number {
  const metaXp =
    typeof event.metadata?.xpAwarded === "number" ? event.metadata.xpAwarded : null;
  if (metaXp !== null) return metaXp;
  if (event.eventType === "quest_completed") return XP_PER_QUEST;
  if (event.eventType === "flashcard_reviewed") return XP_PER_FLASHCARD;
  return XP_PER_ACTIVITY;
}

export function computeStreakDays(activityDates: Date[], now = new Date()): number {
  if (activityDates.length === 0) return 0;

  const dayKeys = new Set(activityDates.map((d) => startOfDay(d).toISOString()));
  const sorted = [...dayKeys].sort((a, b) => (a < b ? 1 : -1));

  const today = startOfDay(now);
  const latest = startOfDay(new Date(sorted[0]));
  const diffDays = Math.floor((today.getTime() - latest.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays > 1) return 0;

  let streak = 0;
  let cursor = latest;
  for (const key of sorted) {
    const day = startOfDay(new Date(key));
    if (day.getTime() !== cursor.getTime()) break;
    streak += 1;
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }
  return streak;
}

export function computeBestStreakDays(activityDates: Date[]): number {
  if (activityDates.length === 0) return 0;

  const sorted = [...new Set(activityDates.map((d) => startOfDay(d).toISOString()))].sort();
  let best = 1;
  let current = 1;

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = startOfDay(new Date(sorted[i - 1]));
    const next = startOfDay(new Date(sorted[i]));
    const diff = Math.round((next.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000));
    if (diff === 1) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 1;
    }
  }

  return best;
}

export function levelFromXp(totalXp: number) {
  const level = Math.max(1, Math.floor(totalXp / XP_PER_LEVEL) + 1);
  const levelTitle = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
  const nextLevelXp = level * XP_PER_LEVEL;
  return { level, levelTitle, nextLevelXp };
}

export function formatActivityWin(event: ActivityRow): string {
  const topic = event.topic?.trim();
  switch (event.eventType) {
    case "quest_completed":
      return topic ? `Completed quest: ${topic}` : "Completed a learning quest";
    case "flashcard_reviewed":
      return topic ? `Reviewed flashcards for ${topic}` : "Reviewed flashcards";
    case "revision_session":
      return topic ? `Finished revision: ${topic}` : "Finished a revision session";
    case "exam_prep_practice":
      return "Practiced for an upcoming test";
    case "explore_with_leo":
      return "Explored a topic with Leo";
    case "language_practice":
      return topic ? `Practiced ${topic}` : "Practiced a Ghanaian language";
    default:
      return "Made progress in EduSentrix Learn";
  }
}

export function timelineTypeFromEvent(
  eventType: ActivityRow["eventType"]
): "quest" | "badge" | "revision" | "flashcards" | "certificate" | "project" {
  switch (eventType) {
    case "quest_completed":
      return "quest";
    case "flashcard_reviewed":
      return "flashcards";
    case "revision_session":
    case "exam_prep_practice":
      return "revision";
    default:
      return "project";
  }
}
