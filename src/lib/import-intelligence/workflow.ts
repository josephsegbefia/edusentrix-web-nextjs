import type { ImportDomain } from "./types";

export type ImportNotificationPhase = "analysis" | "review" | "commit";
export type ImportWorkflowState = "active" | "paused" | "discarded" | "cancel_requested" | "cancelled" | "committing" | "completed" | "failed";

export function importNotificationPhase(domainStatus: string): ImportNotificationPhase {
  if (["review_ready"].includes(domainStatus)) return "review";
  if (["committing", "completed", "completed_with_errors"].includes(domainStatus)) return "commit";
  return "analysis";
}

export function importNotificationCopy(input: { domain: ImportDomain; phase: ImportNotificationPhase; result?: "success" | "partial" | "failed" | "cancelled" }) {
  const label = input.domain === "teacher" ? "teacher" : "student";
  if (input.phase === "review") return { title: `${label} import ready for review`, body: `Review the analysed ${label} import before confirming it.` };
  if (input.result === "partial") return { title: `${label} import completed with issues`, body: `Some ${label} rows need follow-up.` };
  if (input.result === "cancelled") return { title: `${label} import cancelled`, body: `The ${label} import was cancelled before completion.` };
  if (input.result === "failed") return { title: `${label} import failed`, body: `The ${label} import could not be completed. Retry may be available.` };
  return { title: `${label} import completed`, body: `The ${label} import has finished.` };
}
