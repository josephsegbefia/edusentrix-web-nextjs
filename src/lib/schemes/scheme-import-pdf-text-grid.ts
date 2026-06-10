import "server-only";

import type { ISchemeImportParsedRow } from "@/models/SchemeImportJob";
import { parseSchemeRowsFromPdfTextManually } from "@/lib/schemes/scheme-import-pdf-manual";
import { extractTextFromPdfBuffer } from "@/lib/schemes/scheme-import-pdf-text";
import type { SchemeTableGrid } from "@/lib/schemes/scheme-import-pdf-table-map";

/** Canonical NaCCA headers used when rebuilding a table grid from PDF text. */
export const SCHEME_IMPORT_STANDARD_GRID_HEADERS = [
  "Week",
  "Week ending",
  "Strand",
  "Sub-strand",
  "Content standard",
  "Indicators / Learning outcomes",
  "Teaching & Learning Activities",
  "Resources",
  "Assessment",
] as const;

function rowToGridCells(row: ISchemeImportParsedRow): string[] {
  const indicators = [...(row.indicators ?? []), ...(row.learningOutcomes ?? [])]
    .map((item) => item.trim())
    .filter(Boolean)
    .join("\n");

  return [
    row.weekNumber != null ? String(row.weekNumber) : "",
    row.weekEnding ?? "",
    row.strand ?? "",
    row.subStrand ?? "",
    row.contentStandard ?? "",
    indicators,
    row.teachingLearningActivities ?? "",
    (row.resources ?? []).join("\n"),
    (row.assessment ?? []).join("\n"),
  ];
}

export function buildSchemeTableGridFromParsedRows(rows: ISchemeImportParsedRow[]): SchemeTableGrid | null {
  if (rows.length < 2) return null;
  return [Array.from(SCHEME_IMPORT_STANDARD_GRID_HEADERS), ...rows.map(rowToGridCells)];
}

/**
 * pdf-lib and some official exports produce text-based PDFs without PDF table objects.
 * Rebuild a scheme table grid from extractable text so validation and row mapping can proceed.
 */
export async function extractSchemeTableGridsFromPdfText(
  buffer: Buffer,
): Promise<{ ok: true; grids: SchemeTableGrid[] } | { ok: false; error: string }> {
  try {
    const text = await extractTextFromPdfBuffer(buffer);
    const rows = parseSchemeRowsFromPdfTextManually(text);
    const grid = buildSchemeTableGridFromParsedRows(rows);
    if (!grid) {
      return {
        ok: false,
        error: "Text-based PDF parser found fewer than 2 scheme weeks",
      };
    }
    return { ok: true, grids: [grid] };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "PDF text grid extraction failed",
    };
  }
}
