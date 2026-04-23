/**
 * Accept legacy { gradeId } in grade overrides and normalize to { gradeIds: [...] }.
 */
export function normalizeLegacySchoolDailyConfig(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const c = { ...input } as Record<string, unknown>;
  if (!Array.isArray(c.gradeOverrides)) return c;
  c.gradeOverrides = c.gradeOverrides.map((raw: unknown) => {
    if (!raw || typeof raw !== "object") return raw;
    const g = { ...(raw as Record<string, unknown>) };
    if (Array.isArray(g.gradeIds) && g.gradeIds.length > 0) {
      if ("gradeId" in g) delete g.gradeId;
      return g;
    }
    if (typeof g.gradeId === "string" && g.gradeId) {
      const { gradeId, ...rest } = g;
      return { ...rest, gradeIds: [gradeId] };
    }
    return g;
  });
  return c;
}
