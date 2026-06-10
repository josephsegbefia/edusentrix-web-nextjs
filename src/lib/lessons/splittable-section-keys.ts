/** Keys that may be assigned to individual timetable sessions (Phase A). */
export const SPLITTABLE_STANDARD_KEYS = ["body", "resources", "assessment"] as const;

export const WEEK_REFERENCE_SECTION_KEYS = ["context", "curriculum"] as const;

const NON_SPLITTABLE = new Set<string>(WEEK_REFERENCE_SECTION_KEYS);

export function isSplittableSectionKey(key: string): boolean {
  return !NON_SPLITTABLE.has(key);
}

/** Resources ride with body sessions; context/curriculum are excluded. */
export function normalizeSplittableSectionKeys(
  keys: string[],
  allowedKeys: string[],
): string[] {
  const allowed = new Set(allowedKeys.filter(isSplittableSectionKey));
  const out = new Set(keys.filter((k) => allowed.has(k)));
  if (out.has("body")) out.add("resources");
  return [...out];
}
