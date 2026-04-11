/**
 * Copy for term/period selectors (parent, admin, student) — keep wording aligned across surfaces.
 */
export type TermSelectorSchoolLevel = "Basic" | "SHS" | null | undefined;

export function termSelectorTooltip(
  schoolLevel: TermSelectorSchoolLevel,
  options?: { noTermsAvailable?: boolean }
): string {
  if (options?.noTermsAvailable) {
    const base =
      "No academic periods are on the calendar yet. When your school adds terms, you can pick one here to view results for that period.";
    if (schoolLevel === "SHS") {
      return `${base} Senior High progress in this app is term-by-term; national exams (e.g. WASSCE) follow WAEC separately.`;
    }
    return base;
  }

  const base =
    "Each option is an academic period from your school's calendar. Choose a term to view averages and grades recorded for that period.";
  if (schoolLevel === "SHS") {
    return `${base} School-reported results are separate from national exams (e.g. WASSCE) administered by WAEC.`;
  }
  return base;
}
