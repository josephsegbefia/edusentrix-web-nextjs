import type { AssessmentScoreStatus } from "@/types/academics/assessment-engine";

export function markEntryCellKey(studentId: string, assessmentItemId: string) {
  return `${studentId}:${assessmentItemId}`;
}

export function parseMarkEntryInput(raw: string): number | null | "invalid" {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed);
  if (Number.isNaN(numeric)) return "invalid";
  return numeric;
}

export function validateMarkEntryScore(score: number | null, maxScore: number): string | null {
  if (score == null) return null;
  if (score < 0) return "Score cannot be negative.";
  if (score > maxScore) return `Score cannot exceed ${maxScore}.`;
  return null;
}

export function isMissingScoreStatus(status?: AssessmentScoreStatus | null) {
  return status === "missing" || status === "draft";
}

export function scoreStatusLabel(status?: AssessmentScoreStatus | null) {
  if (!status || status === "missing") return "Missing";
  if (status === "draft") return "Draft";
  if (status === "recorded") return "Recorded";
  if (status === "locked") return "Locked";
  return status.replace(/_/g, " ");
}
