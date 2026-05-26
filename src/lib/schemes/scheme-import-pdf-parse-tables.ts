import "server-only";

import { PDFParse } from "pdf-parse";
import type { ISchemeImportParsedRow } from "@/models/SchemeImportJob";
import { ensurePdfParseWorker, isPdfBuffer } from "@/lib/schemes/scheme-import-pdf-utils";
import {
  isViableSchemeImportRows,
  mapTableGridsToSchemeRows,
  type SchemeTableGrid,
} from "@/lib/schemes/scheme-import-pdf-table-map";

export async function extractSchemeRowsWithPdfParseTables(
  buffer: Buffer,
): Promise<{ ok: true; rows: ISchemeImportParsedRow[] } | { ok: false; error: string }> {
  if (!isPdfBuffer(buffer)) {
    return { ok: false, error: "File is not a valid PDF" };
  }

  ensurePdfParseWorker();

  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getTable();
    const grids: SchemeTableGrid[] = [];

    for (const page of result.pages ?? []) {
      for (const table of page.tables ?? []) {
        if (table?.length) grids.push(table);
      }
    }
    for (const table of result.mergedTables ?? []) {
      if (table?.length) grids.push(table);
    }

    if (!grids.length) {
      return { ok: false, error: "pdf-parse found no tables in this PDF" };
    }

    console.info("[scheme-import] pdf-parse table fragments", { count: grids.length });

    const rows = mapTableGridsToSchemeRows(grids, { confidence: 0.82 });
    if (!rows.length) {
      return { ok: false, error: "pdf-parse tables could not be mapped to scheme columns" };
    }
    if (!isViableSchemeImportRows(rows)) {
      return {
        ok: false,
        error: "pdf-parse tables did not match a NaCCA-style scheme layout",
      };
    }

    console.info("[scheme-import] pdf-parse getTable ok", {
      tables: grids.length,
      rows: rows.length,
    });

    return { ok: true, rows };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "pdf-parse table extraction failed";
    return { ok: false, error: message };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
