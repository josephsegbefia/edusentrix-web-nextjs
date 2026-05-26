import "server-only";

import { PDFExcavator } from "pdfexcavator";
import type { ISchemeImportParsedRow } from "@/models/SchemeImportJob";
import { isPdfBuffer } from "@/lib/schemes/scheme-import-pdf-utils";
import {
  isViableSchemeImportRows,
  mapTableGridsToSchemeRows,
  type SchemeTableGrid,
} from "@/lib/schemes/scheme-import-pdf-table-map";

function tableRowsToGrid(rows: (string | null)[][]): SchemeTableGrid {
  return rows.map((row) => row.map((cell) => String(cell ?? "").trim()));
}

export async function extractSchemeRowsWithPdfExcavator(
  buffer: Buffer,
): Promise<{ ok: true; rows: ISchemeImportParsedRow[] } | { ok: false; error: string }> {
  if (!isPdfBuffer(buffer)) {
    return { ok: false, error: "File is not a valid PDF" };
  }

  let pdf: Awaited<ReturnType<typeof PDFExcavator.fromBuffer>> | null = null;
  try {
    pdf = await PDFExcavator.fromBuffer(buffer);
    const grids: SchemeTableGrid[] = [];

    for (const page of pdf.pages) {
      const tables = await page.extractTables();
      for (const table of tables) {
        if (table.rows?.length) {
          grids.push(tableRowsToGrid(table.rows));
        }
      }
    }

    if (!grids.length) {
      return { ok: false, error: "PDFExcavator found no tables in this PDF" };
    }

    const rows = mapTableGridsToSchemeRows(grids, { confidence: 0.88 });
    if (!rows.length) {
      return { ok: false, error: "PDFExcavator tables could not be mapped to scheme columns" };
    }
    if (!isViableSchemeImportRows(rows)) {
      return {
        ok: false,
        error: "PDFExcavator tables did not match a NaCCA-style scheme layout",
      };
    }

    console.info("[scheme-import] PDFExcavator ok", {
      tables: grids.length,
      rows: rows.length,
    });

    return { ok: true, rows };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "PDFExcavator extraction failed";
    return { ok: false, error: message };
  } finally {
    await pdf?.close().catch(() => undefined);
  }
}
