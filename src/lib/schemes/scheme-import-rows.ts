import type { ISchemeImportParsedRow } from "@/models/SchemeImportJob";
import { splitImportList } from "@/lib/schemes/scheme-import-columns";
import { clampSchemeItemShortText, clampSchemeItemShortTextOrNull } from "@/lib/schemes/scheme-item-field-limits";

function cleanString(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function cleanStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
      .slice(0, 20);
  }
  return splitImportList(cleanString(value));
}

function inferTitle(row: ISchemeImportParsedRow): string {
  const explicit = cleanString(row.title);
  if (explicit) return explicit;
  return (
    cleanString(row.subStrand) ||
    cleanString(row.strand) ||
    cleanString(row.contentStandard) ||
    cleanString(row.learningOutcomes?.[0]) ||
    cleanString(row.indicators?.[0]) ||
    ""
  );
}

function inferRowType(row: ISchemeImportParsedRow): NonNullable<ISchemeImportParsedRow["rowType"]> {
  const text = [
    row.title,
    row.strand,
    row.subStrand,
    row.contentStandard,
    row.notes,
    row.rawText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (text.includes("examination") || /\bexam\b/.test(text)) return "examination";
  if (text.includes("revision")) return "revision";
  if (text.includes("holiday") || text.includes("vacation")) return "holiday";
  return row.rowType ?? "teaching";
}

function rowErrors(row: {
  title: string;
  weekNumber: number | null;
  rowType?: ISchemeImportParsedRow["rowType"];
}): string[] {
  const errors: string[] = [];
  const t = row.title.trim();
  if (t.length < 2 && row.rowType === "teaching") {
    errors.push("Title must be at least 2 characters");
  }
  if (row.weekNumber != null && (row.weekNumber < 1 || row.weekNumber > 53)) {
    errors.push("Week must be between 1 and 53");
  }
  return errors;
}

/** Recompute validation errors after client edits. */
export function normalizeParsedImportRows(rows: ISchemeImportParsedRow[]): ISchemeImportParsedRow[] {
  return rows.map((r) => {
    let confidence: number | null = null;
    if (typeof r.confidence === "number" && Number.isFinite(r.confidence)) {
      confidence = Math.min(1, Math.max(0, r.confidence));
    }
    const rowType = inferRowType(r);
    const title = clampSchemeItemShortText(inferTitle({ ...r, rowType }));
    return {
      ...r,
      weekEnding: cleanString(r.weekEnding),
      title,
      strand: clampSchemeItemShortTextOrNull(cleanString(r.strand)),
      subStrand: clampSchemeItemShortTextOrNull(cleanString(r.subStrand)),
      contentStandard: cleanString(r.contentStandard),
      indicators: cleanStringList(r.indicators),
      learningOutcomes: cleanStringList(r.learningOutcomes),
      teachingLearningActivities: cleanString(r.teachingLearningActivities),
      resources: cleanStringList(r.resources),
      assessment: cleanStringList(r.assessment),
      learningObjective: cleanString(r.learningObjective),
      notes: cleanString(r.notes),
      weekNumber: r.weekNumber ?? null,
      rowType,
      confidence,
      rawText: cleanString(r.rawText),
      errors: rowErrors({
        title,
        weekNumber: r.weekNumber ?? null,
        rowType,
      }),
    };
  });
}
