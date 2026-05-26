import "server-only";

import { PDFParse } from "pdf-parse";
import { PDFExcavator } from "pdfexcavator";
import { ensurePdfParseWorker, isPdfBuffer } from "@/lib/schemes/scheme-import-pdf-utils";
import type { SchemeTableGrid } from "@/lib/schemes/scheme-import-pdf-table-map";

function tableRowsToGrid(rows: (string | null)[][]): SchemeTableGrid {
  return rows.map((row) => row.map((cell) => String(cell ?? "").trim()));
}

async function extractGridsWithPdfParse(
  buffer: Buffer,
): Promise<{ ok: true; grids: SchemeTableGrid[] } | { ok: false; error: string }> {
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
    return { ok: true, grids };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "pdf-parse table extraction failed",
    };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

async function extractGridsWithPdfExcavator(
  buffer: Buffer,
): Promise<{ ok: true; grids: SchemeTableGrid[] } | { ok: false; error: string }> {
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
    return { ok: true, grids };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "PDFExcavator extraction failed",
    };
  }
}

/** Extract table grids from a PDF for header/column validation or row mapping. */
export async function resolvePdfTableGrids(
  buffer: Buffer,
): Promise<{ ok: true; grids: SchemeTableGrid[] } | { ok: false; error: string }> {
  if (!isPdfBuffer(buffer)) {
    return { ok: false, error: "File is not a valid PDF" };
  }

  const pdfParse = await extractGridsWithPdfParse(buffer);
  if (pdfParse.ok) return pdfParse;

  const excavator = await extractGridsWithPdfExcavator(buffer);
  if (excavator.ok) return excavator;

  return {
    ok: false,
    error: `${pdfParse.error}; ${excavator.error}`,
  };
}
