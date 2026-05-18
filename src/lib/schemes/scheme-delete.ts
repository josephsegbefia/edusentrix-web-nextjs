/** Shared delete eligibility rules for schemes of learning (client + server). */

export function getSchemeDeleteBlockReason(status: string): string | null {
  if (status === "active") {
    return "Active schemes are used by Lesson Notes. Archive the scheme before deleting it.";
  }
  return null;
}

export function adminCanDeleteSchemeStatus(status: string): boolean {
  return getSchemeDeleteBlockReason(status) === null;
}
