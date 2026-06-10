import type { ISchemeImportParsedRow } from "@/models/SchemeImportJob";
import {
  clampSchemeItemShortText,
  clampSchemeItemShortTextOrNull,
} from "@/lib/schemes/scheme-item-field-limits";
import { getWeekStartMondayUtc } from "@/lib/lessons/week-dates";
import {
  computePlannedDatesForSchemeWeek,
  type AcademicPeriodWeekInput,
} from "@/lib/schemes/resolve-scheme-week";

export function buildSchemeItemTitle(row: ISchemeImportParsedRow): string {
  const raw =
    row.title?.trim() ||
    row.subStrand?.trim() ||
    row.strand?.trim() ||
    row.contentStandard?.trim() ||
    row.learningOutcomes?.[0]?.trim() ||
    row.indicators?.[0]?.trim() ||
    "Scheme row";
  return clampSchemeItemShortText(raw);
}

export function schemeImportRowFieldsForItem(row: ISchemeImportParsedRow) {
  return {
    title: buildSchemeItemTitle(row),
    strand: clampSchemeItemShortTextOrNull(row.strand),
    subStrand: clampSchemeItemShortTextOrNull(row.subStrand),
    contentStandard: row.contentStandard?.trim() || null,
  };
}

/** Notes only — structured columns are stored on their own SchemeItem fields. */
export function buildSchemeImportRowNotes(row: ISchemeImportParsedRow): string | null {
  const notes = row.notes?.trim();
  return notes || null;
}

export function schemeImportRowToSchemeItemPayload(row: ISchemeImportParsedRow) {
  const fields = schemeImportRowFieldsForItem(row);
  const indicators = (row.indicators || []).map((i) => i.trim()).filter(Boolean);
  const learningOutcomes = (row.learningOutcomes || []).map((o) => o.trim()).filter(Boolean);
  const resources = (row.resources || []).map((r) => r.trim()).filter(Boolean);
  const assessment = (row.assessment || []).map((a) => a.trim()).filter(Boolean);

  const indicatorLines = [...indicators];
  const objectiveLines = [...learningOutcomes];
  if (row.learningObjective?.trim()) {
    objectiveLines.unshift(row.learningObjective.trim());
  }

  return {
    ...fields,
    indicator: indicatorLines.length ? indicatorLines.join("\n") : null,
    learningObjectives: objectiveLines,
    learningObjective: row.learningObjective?.trim() || objectiveLines[0] || null,
    teachingResources: resources,
    teachingLearningActivities: row.teachingLearningActivities?.trim() || null,
    assessmentIdeas: assessment,
    notes: buildSchemeImportRowNotes(row),
  };
}

export function resolveSchemeImportItemPlannedDates(args: {
  row: { weekNumber: number | null; weekEnding?: string | null };
  period: AcademicPeriodWeekInput | null;
  parseWeekEnding: (value: string | null | undefined) => Date | null;
}): { plannedStartDate: Date | null; plannedEndDate: Date | null } {
  const parsedEnd = args.parseWeekEnding(args.row.weekEnding);
  if (typeof args.row.weekNumber === "number" && args.period) {
    const computed = computePlannedDatesForSchemeWeek(
      args.period,
      args.row.weekNumber,
      args.row.weekEnding
    );
    return {
      plannedStartDate: computed.plannedStartDate,
      plannedEndDate: parsedEnd ?? computed.plannedEndDate,
    };
  }
  if (parsedEnd) {
    return {
      plannedStartDate: getWeekStartMondayUtc(parsedEnd),
      plannedEndDate: parsedEnd,
    };
  }
  return { plannedStartDate: null, plannedEndDate: null };
}
