import type { SchoolAccessMode } from "@/lib/billing/resolve-school-access-mode";

export function canUseExpensiveAi(_accessMode?: SchoolAccessMode): boolean {
  return true;
}

export function expensiveAiBlockedMessage(_accessMode?: SchoolAccessMode): string {
  return "This action is not available.";
}
