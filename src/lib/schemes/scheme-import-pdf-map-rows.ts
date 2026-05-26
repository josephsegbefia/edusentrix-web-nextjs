import "server-only";

import type { ISchemeImportParsedRow } from "@/models/SchemeImportJob";
import {
  clampSchemeItemShortText,
  clampSchemeItemShortTextOrNull,
} from "@/lib/schemes/scheme-item-field-limits";
import { splitImportList } from "@/lib/schemes/scheme-import-columns";

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
  if (Array.isArray(items)) {
    return items.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, 20);
  }
  const text = String(items ?? "").trim();
  if (!text) return [];
  return splitImportList(text);
}

function cleanText(value: unknown, maxLen: number): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

function pickTitle(raw: Record<string, unknown>): string {
  for (const key of ["title", "subStrand", "substrand", "strand", "contentStandard", "topic", "theme"]) {
    const v = raw[key];
    if (typeof v === "string" && v.trim().length >= 2) return v.trim();
  }
  const indicators = cleanList(raw.indicators);
  if (indicators[0]) return indicators[0];
  const outcomes = cleanList(raw.learningOutcomes);
  if (outcomes[0]) return outcomes[0];
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

    const indicators = cleanList(r.indicators);
    const learningOutcomes = cleanList(r.learningOutcomes ?? r.learning_outcomes);
    let teachingLearningActivities =
      cleanText(
        r.teachingLearningActivities ??
          r.teaching_learning_activities ??
          r.teachingActivities ??
          r.activities,
        8000,
      ) ?? null;
    const resources = cleanList(r.resources);
    let assessment = cleanList(r.assessment ?? r.assessments);

    // ── Recovery: rescue TLA/assessment that the model placed in `notes` ────
    // Some models drop non-standard column labels into notes. We detect
    // activity-keyword phrases and extract them if the real fields are empty.
    const notesText = typeof r.notes === "string" ? r.notes.trim() : "";
    if (!teachingLearningActivities && notesText) {
      const activitySignal =
        /activit|guided\s+practice|demonstration|discussion|group\s+work|hands[- ]on|explore|investigate|observ/i;
      if (activitySignal.test(notesText)) {
        teachingLearningActivities = notesText;
        // notes will be cleared below since we rescued it
      }
    }
    if (assessment.length === 0 && notesText && !teachingLearningActivities) {
      const assessmentSignal =
        /assessment|evaluation|classwork|homework|exercise|quiz|test|project\s+work/i;
      if (assessmentSignal.test(notesText)) {
        assessment = [notesText];
      }
    }
    // If we rescued TLA from notes, clear notes so it isn't duplicated.
    const finalNotes =
      notesText && notesText === teachingLearningActivities ? null : (notes ?? null);

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
      indicators,
      learningOutcomes,
      teachingLearningActivities,
      resources,
      assessment,
      learningObjective,
      notes: finalNotes,
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
