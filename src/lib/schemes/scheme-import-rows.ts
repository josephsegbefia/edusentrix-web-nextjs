import type { ISchemeImportParsedRow } from "@/models/SchemeImportJob";

function rowErrors(row: { title: string; weekNumber: number | null }): string[] {
  const errors: string[] = [];
  const t = row.title.trim();
  if (t.length < 2) errors.push("Title must be at least 2 characters");
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
    return {
      ...r,
      title: r.title.trim(),
      learningObjective: r.learningObjective?.trim() || null,
      notes: r.notes?.trim() || null,
      weekNumber: r.weekNumber ?? null,
      confidence,
      errors: rowErrors({
        title: r.title,
        weekNumber: r.weekNumber ?? null,
      }),
    };
  });
}
