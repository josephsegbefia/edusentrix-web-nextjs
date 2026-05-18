import "server-only";

import type { ISchemeImportParsedRow } from "@/models/SchemeImportJob";
import {
  clampSchemeItemShortText,
  clampSchemeItemShortTextOrNull,
} from "@/lib/schemes/scheme-item-field-limits";

const MAX_ROWS = 80;

function rowErrors(title: string, weekNumber: number | null): string[] {
  const errors: string[] = [];
  const t = title.trim();
  if (t.length < 2) errors.push("Title must be at least 2 characters");
  if (weekNumber != null && (weekNumber < 1 || weekNumber > 53)) {
    errors.push("Week must be between 1 and 53");
  }
  return errors;
}

function cleanList(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, 20);
}

function pickTitle(raw: Record<string, unknown>): string {
  for (const key of ["title", "subStrand", "strand", "contentStandard", "topic", "theme"]) {
    const v = raw[key];
    if (typeof v === "string" && v.trim().length >= 2) return v.trim();
  }
  const indicators = cleanList(raw.indicators);
  if (indicators[0]) return indicators[0];
  const notes = raw.notes;
  if (typeof notes === "string" && notes.trim().length >= 2) {
    return notes.trim().slice(0, 120);
  }
  return "";
}

function parseWeekNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(n) || n < 1 || n > 53) return null;
  return n;
}

function parseRowType(value: unknown): ISchemeImportParsedRow["rowType"] {
  const v = String(value ?? "").toLowerCase();
  if (v === "revision" || v === "examination" || v === "holiday" || v === "other") return v;
  return "teaching";
}

export function rowsFromAiPayload(parsedJson: unknown): Array<Record<string, unknown>> {
  if (!parsedJson || typeof parsedJson !== "object") return [];
  const root = parsedJson as Record<string, unknown>;
  if (Array.isArray(root.rows)) {
    return root.rows.filter((r) => r && typeof r === "object") as Array<Record<string, unknown>>;
  }
  if (Array.isArray(root.data)) {
    return root.data.filter((r) => r && typeof r === "object") as Array<Record<string, unknown>>;
  }
  if (Array.isArray(root.items)) {
    return root.items.filter((r) => r && typeof r === "object") as Array<Record<string, unknown>>;
  }
  return [];
}

export function parseJsonFromModelText(responseText: string): unknown {
  try {
    return JSON.parse(responseText);
  } catch {
    const m = responseText.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Invalid JSON from AI");
    return JSON.parse(m[0]);
  }
}

export function mapAiRowsToSchemeImportRows(rows: Array<Record<string, unknown>>): ISchemeImportParsedRow[] {
  const out: ISchemeImportParsedRow[] = [];
  for (const r of rows.slice(0, MAX_ROWS)) {
    const title = clampSchemeItemShortText(pickTitle(r));
    if (!title) continue;
    const weekNumber = parseWeekNumber(r.weekNumber ?? r.week);
    const learningObjective =
      typeof r.learningObjective === "string"
        ? r.learningObjective.trim() || null
        : typeof r.objective === "string"
          ? r.objective.trim() || null
          : null;
    const notes = typeof r.notes === "string" ? r.notes.trim() || null : null;
    const confidenceRaw = r.confidence;
    const confidence =
      typeof confidenceRaw === "number" && Number.isFinite(confidenceRaw)
        ? Math.min(1, Math.max(0, confidenceRaw))
        : null;

    out.push({
      rowIndex: out.length + 2,
      weekNumber,
      weekEnding: typeof r.weekEnding === "string" ? r.weekEnding.trim() || null : null,
      title,
      strand:
        typeof r.strand === "string"
          ? clampSchemeItemShortTextOrNull(r.strand.trim() || null)
          : null,
      subStrand:
        typeof r.subStrand === "string"
          ? clampSchemeItemShortTextOrNull(r.subStrand.trim() || null)
          : typeof r.substrand === "string"
            ? clampSchemeItemShortTextOrNull(r.substrand.trim() || null)
            : null,
      contentStandard:
        typeof r.contentStandard === "string" ? r.contentStandard.trim() || null : null,
      indicators: cleanList(r.indicators),
      resources: cleanList(r.resources),
      learningObjective,
      notes,
      rowType: parseRowType(r.rowType),
      skipped: false,
      errors: rowErrors(title, weekNumber),
      confidence,
      rawText: typeof r.rawText === "string" ? r.rawText.trim() || null : null,
    });
  }
  return out;
}

export function parseSchemeRowsFromModelJson(parsedJson: unknown): ISchemeImportParsedRow[] {
  return mapAiRowsToSchemeImportRows(rowsFromAiPayload(parsedJson));
}
