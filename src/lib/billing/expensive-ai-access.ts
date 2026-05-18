import type { SchoolAccessMode } from "@/lib/billing/resolve-school-access-mode";

/** Access modes that may run billable / expensive AI operations. */
export const EXPENSIVE_AI_ACCESS_MODES = new Set<SchoolAccessMode>([
  "full",
  "trial_limited",
  "pilot_limited",
]);

export function canUseExpensiveAi(accessMode: SchoolAccessMode): boolean {
  return EXPENSIVE_AI_ACCESS_MODES.has(accessMode);
}

export function expensiveAiBlockedMessage(accessMode: SchoolAccessMode): string {
  switch (accessMode) {
    case "grace":
      return "Leo AI drafts are paused while your school is in the billing grace period. Ask your school admin to renew, or add flashcards manually in the section below.";
    case "restricted_read_only":
      return "Leo AI drafts are unavailable while your school has read-only access. You can still add flashcards manually below.";
    case "suspended":
      return "Leo AI drafts are unavailable because your school subscription is suspended.";
    default:
      return "This action is not available in the current subscription state.";
  }
}
