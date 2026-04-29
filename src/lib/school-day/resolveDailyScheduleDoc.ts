import { ensureConfigV2 } from "@/lib/school-day/migrate-v2";
import type { SchoolDailyScheduleConfigV2 } from "@/types/school-daily-schedule";

export type DailyScheduleMode = "unified" | "grouped";

/** Lean document shape from Mongo or API DTO (before ensureConfigV2). */
export type DailyScheduleDocLike = {
  config?: unknown;
  scheduleMode?: DailyScheduleMode | string | null;
  scheduleGroups?: unknown;
};

export type DailyScheduleGroupLike = {
  groupId?: string;
  id?: string;
  label?: string | null;
  gradeIds?: unknown[];
  config?: unknown;
};

function normalizeMode(m: unknown): DailyScheduleMode {
  return m === "grouped" ? "grouped" : "unified";
}

/**
 * Pick the raw config object for a grade from a school daily document.
 * Unified mode uses root `config`. Grouped mode finds the group containing `gradeId`.
 */
export function pickRawDailyConfigForGrade(
  doc: DailyScheduleDocLike | null | undefined,
  gradeId: string | null | undefined
): unknown | null {
  if (!doc) return null;
  const mode = normalizeMode(doc.scheduleMode);
  if (mode === "grouped" && Array.isArray(doc.scheduleGroups)) {
    const gid = gradeId?.trim();
    if (!gid) return null;
    for (const g of doc.scheduleGroups as DailyScheduleGroupLike[]) {
      const ids = (g.gradeIds ?? []).map((x) => String(x));
      if (ids.includes(gid)) {
        return g.config ?? null;
      }
    }
    return null;
  }
  return doc.config ?? null;
}

export function pickDailyConfigV2ForGrade(
  doc: DailyScheduleDocLike | null | undefined,
  gradeId: string | null | undefined
): SchoolDailyScheduleConfigV2 | null {
  const raw = pickRawDailyConfigForGrade(doc, gradeId);
  if (raw == null) return null;
  try {
    return ensureConfigV2(raw);
  } catch {
    return null;
  }
}

/** Client GET DTO uses `id` per group; normalize to document-like shape. */
export function pickDailyConfigV2FromApiDto(
  dto: {
    scheduleMode?: DailyScheduleMode | string | null;
    config?: unknown;
    scheduleGroups?:
      | Array<{ id: string; label?: string | null; gradeIds: string[]; config: unknown }>
      | null;
  } | null
  | undefined,
  gradeId: string | null | undefined
): SchoolDailyScheduleConfigV2 | null {
  const groups = dto?.scheduleGroups?.map((g) => ({
    groupId: g.id,
    label: g.label,
    gradeIds: g.gradeIds,
    config: g.config,
  }));
  return pickDailyConfigV2ForGrade(
    {
      config: dto?.config,
      scheduleMode: dto?.scheduleMode,
      scheduleGroups: groups,
    },
    gradeId
  );
}
