import type { ISchemeImportParsedRow } from "@/models/SchemeImportJob";
import {
  mapSchemeImportHeaderKey,
  splitImportList,
  splitProseBlock,
  type SchemeImportHeaderKey,
} from "@/lib/schemes/scheme-import-columns";

const MAX_ROWS = 500;

function parseWeek(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number.parseInt(String(value).trim(), 10);
  if (Number.isNaN(n)) return null;
  return n;
}

export function schemeImportRowErrors(row: { title: string; weekNumber: number | null }): string[] {
  const errors: string[] = [];
  const t = row.title.trim();
  if (t.length < 2) errors.push("Title must be at least 2 characters");
  if (row.weekNumber != null && (row.weekNumber < 1 || row.weekNumber > 53)) {
    errors.push("Week must be between 1 and 53");
  }
  return errors;
}

function inferRowType(value: string): ISchemeImportParsedRow["rowType"] {
  const text = value.toLowerCase();
  if (text.includes("examination") || /\bexam\b/.test(text)) return "examination";
  if (text.includes("revision")) return "revision";
  if (text.includes("holiday") || text.includes("vacation")) return "holiday";
  return "teaching";
}

function mergeListText(existing: string | null, next: string): string | null {
  const parts = [existing, next].map((v) => v?.trim()).filter(Boolean);
  return parts.length ? parts.join("\n") : null;
}

/** Build a scheme import row from a record keyed by canonical header roles or raw header labels. */
export function buildSchemeImportRowFromFieldRecord(
  rec: Record<string, unknown>,
  rowIndex: number,
  options?: { confidence?: number | null },
): ISchemeImportParsedRow | null {
  let title = "";
  let weekNumber: number | null = null;
  let weekEnding: string | null = null;
  let strand: string | null = null;
  let subStrand: string | null = null;
  let contentStandard: string | null = null;
  let indicatorsText: string | null = null;
  let learningOutcomesText: string | null = null;
  let teachingActivitiesText: string | null = null;
  let resourcesText: string | null = null;
  let assessmentText: string | null = null;
  let learningObjective: string | null = null;
  let notes: string | null = null;

  for (const key of Object.keys(rec)) {
    const role = mapSchemeImportHeaderKey(key);
    if (!role) continue;
    const val = rec[key];
    const str = val === null || val === undefined ? "" : String(val).trim();
    if (!str) continue;

    if (role === "title" && !title) title = str;
    else if (role === "week" && weekNumber === null) weekNumber = parseWeek(val);
    else if (role === "weekEnding" && weekEnding === null) weekEnding = str || null;
    else if (role === "strand" && strand === null) strand = str || null;
    else if (role === "subStrand" && subStrand === null) subStrand = str || null;
    else if (role === "contentStandard" && contentStandard === null) contentStandard = str || null;
    else if (role === "indicators" && indicatorsText === null) indicatorsText = str || null;
    else if (role === "indicatorsAndOutcomes") {
      if (indicatorsText === null) indicatorsText = str || null;
      if (learningOutcomesText === null) learningOutcomesText = str || null;
    } else if (role === "learningOutcomes" && learningOutcomesText === null)
      learningOutcomesText = str || null;
    else if (role === "teachingActivities")
      teachingActivitiesText = mergeListText(teachingActivitiesText, str);
    else if (role === "resources" && resourcesText === null) resourcesText = str || null;
    else if (role === "assessment" && assessmentText === null) assessmentText = str || null;
    else if (role === "objective" && learningObjective === null) learningObjective = str || null;
    else if (role === "notes" && notes === null) notes = str || null;
  }

  const indicators = splitImportList(indicatorsText);
  const learningOutcomes = splitImportList(learningOutcomesText);
  const resources = splitImportList(resourcesText);
  const assessment = splitProseBlock(assessmentText);

  if (!title) {
    title =
      subStrand ||
      strand ||
      contentStandard ||
      learningOutcomes[0] ||
      indicators[0] ||
      "";
  }

  if (!title) {
    const vals = Object.values(rec);
    title = String(vals[0] ?? "").trim();
    if (vals.length > 1 && weekNumber === null) weekNumber = parseWeek(vals[1]);
    if (vals.length > 2 && learningObjective === null)
      learningObjective = String(vals[2] ?? "").trim() || null;
    if (vals.length > 3 && notes === null) notes = String(vals[3] ?? "").trim() || null;
  }

  if (title.trim().length < 2) return null;

  const rawText = Object.values(rec)
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" | ");

  return {
    rowIndex,
    title: title.trim(),
    weekNumber,
    weekEnding,
    strand,
    subStrand,
    contentStandard,
    indicators,
    learningOutcomes,
    teachingLearningActivities: teachingActivitiesText,
    resources,
    assessment,
    learningObjective,
    notes,
    rowType: inferRowType(rawText || title),
    skipped: false,
    errors: schemeImportRowErrors({ title, weekNumber }),
    confidence: options?.confidence ?? null,
    rawText: rawText || null,
  };
}

export function isViableSchemeImportRows(rows: ISchemeImportParsedRow[]): boolean {
  if (rows.length < 2) return false;

  const schemeLikeHeaders = rows.filter((row) => {
    const hasWeek = row.weekNumber != null && row.weekNumber >= 1 && row.weekNumber <= 53;
    const hasCurriculum =
      Boolean(row.strand?.trim()) ||
      Boolean(row.subStrand?.trim()) ||
      Boolean(row.contentStandard?.trim());
    const hasTail =
      (row.indicators?.length ?? 0) > 0 ||
      (row.learningOutcomes?.length ?? 0) > 0 ||
      Boolean(row.teachingLearningActivities?.trim()) ||
      (row.resources?.length ?? 0) > 0 ||
      (row.assessment?.length ?? 0) > 0;
    return hasWeek || hasCurriculum || hasTail;
  }).length;

  return schemeLikeHeaders >= Math.min(2, Math.ceil(rows.length * 0.25));
}

export { MAX_ROWS as SCHEME_IMPORT_MAX_ROWS };
