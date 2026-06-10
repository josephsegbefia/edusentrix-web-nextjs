import "server-only";

import type { ISchemeImportParsedRow, SchemeImportSourceKind } from "@/models/SchemeImportJob";
import { extractSchemeRowsWithPdfExcavator } from "@/lib/schemes/scheme-import-pdf-excavator";
import { extractSchemeRowsWithPdfParseTables } from "@/lib/schemes/scheme-import-pdf-parse-tables";
import { extractSchemeTableGridsFromPdfText } from "@/lib/schemes/scheme-import-pdf-text-grid";
import {
  isViableSchemeImportRows,
  mapTableGridsToSchemeRows,
} from "@/lib/schemes/scheme-import-pdf-table-map";

export type PdfStructuredParseResult =
  | {
      ok: true;
      rows: ISchemeImportParsedRow[];
      sourceKind: Extract<
        SchemeImportSourceKind,
        "pdf_parse_tables" | "pdf_excavator" | "pdf_text_grid"
      >;
    }
  | { ok: false; errors: string[] };

/**
 * Local PDF table extraction — no network, no API keys.
 * Order: pdf-parse getTable → PDFExcavator.
 */
export async function resolvePdfStructuredRows(
  buffer: Buffer,
): Promise<PdfStructuredParseResult> {
  const errors: string[] = [];

  console.info("[scheme-import] trying pdf-parse getTable…");
  const pdfParse = await extractSchemeRowsWithPdfParseTables(buffer);
  if (pdfParse.ok && pdfParse.rows.length > 0) {
    return { ok: true, rows: pdfParse.rows, sourceKind: "pdf_parse_tables" };
  }
  if (!pdfParse.ok) {
    errors.push(pdfParse.error);
    console.info("[scheme-import] pdf-parse getTable failed", { error: pdfParse.error });
  }

  console.info("[scheme-import] trying PDFExcavator…");
  const excavator = await extractSchemeRowsWithPdfExcavator(buffer);
  if (excavator.ok && excavator.rows.length > 0) {
    return { ok: true, rows: excavator.rows, sourceKind: "pdf_excavator" };
  }
  if (!excavator.ok) {
    errors.push(excavator.error);
    console.info("[scheme-import] PDFExcavator failed", { error: excavator.error });
  }

  console.info("[scheme-import] trying PDF text grid fallback…");
  const textGrid = await extractSchemeTableGridsFromPdfText(buffer);
  if (textGrid.ok) {
    const rows = mapTableGridsToSchemeRows(textGrid.grids, { confidence: 0.8 });
    if (rows.length > 0 && isViableSchemeImportRows(rows)) {
      return { ok: true, rows, sourceKind: "pdf_text_grid" };
    }
    errors.push("PDF text grid could not be mapped to viable scheme rows");
  } else {
    errors.push(textGrid.error);
    console.info("[scheme-import] PDF text grid failed", { error: textGrid.error });
  }

  return { ok: false, errors };
}
