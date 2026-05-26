import "server-only";

import type { ISchemeImportParsedRow } from "@/models/SchemeImportJob";
import {
  mapSchemeImportHeaderKey,
  normalizeImportHeaderCell,
  type SchemeImportHeaderKey,
} from "@/lib/schemes/scheme-import-columns";
import {
  buildSchemeImportRowFromFieldRecord,
  isViableSchemeImportRows,
  SCHEME_IMPORT_MAX_ROWS,
} from "@/lib/schemes/scheme-import-row-build";

export type SchemeTableGrid = string[][];

const KNOWN_STRANDS = [
  "Statistics and Probability",
  "Geometry and Measurement",
  "Revision and Examination",
  "REVISION AND EXAMINATION",
  "Algebra",
  "Number",
  "Measurement",
  "Data",
  "Geometry",
];

const CONTENT_STANDARD_CODE = /\b([A-Z]\d+(?:\.\d+){2,})\b/;

function normalizeCell(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeGrid(grid: SchemeTableGrid): SchemeTableGrid {
  return grid
    .map((row) => row.map((cell) => normalizeCell(cell)))
    .filter((row) => row.some(Boolean));
}

function rowLooksLikeSchemeDataRow(cells: string[]): boolean {
  const weekCell = cells[0]?.trim() ?? "";
  if (/^\d{1,2}$/.test(weekCell)) return true;
  const joined = cells.join(" ");
  if (/\bB\d+(?:\.\d+){2,}\b/i.test(joined)) return true;
  if (/\b(revision|examination)\b/i.test(joined) && weekCell) return true;
  return false;
}

function rowLooksLikeSchemeHeaderRow(cells: string[]): boolean {
  if (rowLooksLikeSchemeDataRow(cells)) return false;
  const mapped = cells.filter((c) => mapSchemeImportHeaderKey(c)).length;
  return mapped >= 2;
}

/**
 * PDF tables often split one header across two rows (e.g. "Teaching &" / "Learning Activities").
 * Never merge the first data row into headers — that was turning "Strand" into
 * "Strand Diversity of Matter" and breaking column mapping.
 */
function composeHeaderCells(grid: SchemeTableGrid, headerRowIndex: number): string[] {
  const rowIndices = [headerRowIndex - 1, headerRowIndex, headerRowIndex + 1].filter(
    (i) =>
      i >= 0 &&
      i < grid.length &&
      !rowLooksLikeSchemeDataRow(grid[i] ?? []) &&
      (i === headerRowIndex || rowLooksLikeSchemeHeaderRow(grid[i] ?? [])),
  );
  const maxCols = Math.max(0, ...rowIndices.map((i) => grid[i]?.length ?? 0));

  const composed: string[] = [];
  for (let col = 0; col < maxCols; col++) {
    const parts: string[] = [];
    for (const rowIdx of rowIndices) {
      const cell = grid[rowIdx]?.[col] ?? "";
      if (!cell) continue;
      if (cell.length > 100) continue;
      if (!parts.includes(cell)) parts.push(cell);
    }
    composed[col] = parts.join(" ").trim();
  }
  return composed;
}

/** Merge per-page tables that share the same header row (multi-page schemes). */
export function mergeSchemeTableGridsByHeader(grids: SchemeTableGrid[]): SchemeTableGrid[] {
  const groups = new Map<string, SchemeTableGrid>();

  for (const grid of grids) {
    if (!grid.length) continue;
    const headerCells = grid[0].map((c) => normalizeImportHeaderCell(c));
    const sig = headerCells.join("|");
    const existing = groups.get(sig);
    if (!existing) {
      groups.set(sig, grid.map((row) => [...row]));
      continue;
    }
    for (let i = 1; i < grid.length; i++) {
      if (rowLooksLikeSchemeDataRow(grid[i] ?? []) || grid[i]?.some(Boolean)) {
        existing.push([...grid[i]]);
      }
    }
  }

  return [...groups.values()];
}

function scoreHeaderRow(cells: string[]): {
  colMap: Partial<Record<SchemeImportHeaderKey, number>>;
  score: number;
} {
  const colMap: Partial<Record<SchemeImportHeaderKey, number>> = {};
  let score = 0;

  cells.forEach((cell, idx) => {
    if (!cell) return;
    const role = mapSchemeImportHeaderKey(cell);
    if (!role) return;
    if (colMap[role] === undefined) {
      colMap[role] = idx;
      score += 1;
      if (
        role === "contentStandard" ||
        role === "indicators" ||
        role === "teachingActivities" ||
        role === "subStrand" ||
        role === "strand"
      ) {
        score += 2;
      }
    }
  });

  return { colMap, score };
}

function pickHeaderFromGrid(grid: SchemeTableGrid): {
  headerRowIndex: number;
  colMap: Partial<Record<SchemeImportHeaderKey, number>>;
  composedHeaders: string[];
} | null {
  const scanRows = Math.min(8, grid.length);
  let best: {
    headerRowIndex: number;
    colMap: Partial<Record<SchemeImportHeaderKey, number>>;
    score: number;
    composedHeaders: string[];
  } | null = null;

  for (let i = 0; i < scanRows; i++) {
    const composed = composeHeaderCells(grid, i);
    const { colMap, score } = scoreHeaderRow(composed);
    if (score < 2) continue;
    if (!best || score > best.score) {
      best = { headerRowIndex: i, colMap, score, composedHeaders: composed };
    }
  }

  if (!best) return null;
  return {
    headerRowIndex: best.headerRowIndex,
    colMap: best.colMap,
    composedHeaders: best.composedHeaders,
  };
}

function splitStrandAndSubStrand(value: string): { strand: string; subStrand: string } {
  const text = normalizeCell(value);
  if (!text) return { strand: "", subStrand: "" };

  for (const known of KNOWN_STRANDS) {
    if (text.toLowerCase().startsWith(known.toLowerCase())) {
      return {
        strand: known,
        subStrand: normalizeCell(text.slice(known.length)),
      };
    }
  }

  const [first = "", ...rest] = text.split(/\s+/);
  return { strand: first, subStrand: rest.join(" ") };
}

function looksLikeTeachingActivitiesColumn(samples: string[]): boolean {
  if (!samples.length) return false;
  const joined = samples.join(" ").toLowerCase();
  const avgLen = samples.reduce((sum, s) => sum + s.length, 0) / samples.length;
  if (avgLen < 40) return false;
  return (
    /students?|learners?|teacher|discuss|demonstrat|guide|activity|practice|group work|in pairs/i.test(
      joined,
    ) && !CONTENT_STANDARD_CODE.test(joined)
  );
}

function looksLikeSubStrandColumn(samples: string[]): boolean {
  if (!samples.length) return false;
  const avgLen = samples.reduce((sum, s) => sum + s.length, 0) / samples.length;
  if (avgLen < 3 || avgLen > 120) return false;
  return samples.every((s) => !CONTENT_STANDARD_CODE.test(s) && s.length < 100);
}

/** Map columns whose headers were split, blank, or mis-labelled by the PDF extractor. */
function inferMissingColumnIndices(
  grid: SchemeTableGrid,
  headerRowIndex: number,
  colMap: Partial<Record<SchemeImportHeaderKey, number>>,
  composedHeaders: string[],
): Partial<Record<SchemeImportHeaderKey, number>> {
  const out = { ...colMap };
  const used = new Set(Object.values(out).filter((v) => v != null));
  const dataRows = grid.slice(headerRowIndex + 1, headerRowIndex + 10);
  const maxCols = Math.max(
    composedHeaders.length,
    ...dataRows.map((r) => r.length),
    ...grid.slice(0, headerRowIndex + 2).map((r) => r.length),
  );

  for (let col = 0; col < maxCols; col++) {
    if (used.has(col)) continue;

    const headerLabel = composedHeaders[col] ?? "";
    const roleFromHeader = headerLabel ? mapSchemeImportHeaderKey(headerLabel) : null;
    if (roleFromHeader && out[roleFromHeader] === undefined) {
      out[roleFromHeader] = col;
      used.add(col);
      continue;
    }

    const samples = dataRows.map((row) => row[col] ?? "").filter(Boolean);
    if (!samples.length) continue;

    if (out.teachingActivities === undefined && looksLikeTeachingActivitiesColumn(samples)) {
      out.teachingActivities = col;
      used.add(col);
      continue;
    }

    if (
      out.subStrand === undefined &&
      out.strand !== col &&
      col !== out.week &&
      col !== out.weekEnding &&
      looksLikeSubStrandColumn(samples) &&
      !looksLikeTeachingActivitiesColumn(samples)
    ) {
      out.subStrand = col;
      used.add(col);
    }

    if (
      out.strand === undefined &&
      out.subStrand !== col &&
      col !== out.week &&
      col !== out.weekEnding &&
      looksLikeSubStrandColumn(samples) &&
      !looksLikeTeachingActivitiesColumn(samples)
    ) {
      out.strand = col;
      used.add(col);
    }
  }

  return out;
}

function recordFromRow(
  cells: string[],
  colMap: Partial<Record<SchemeImportHeaderKey, number>>,
): Record<string, unknown> {
  const rec: Record<string, unknown> = {};
  for (const [role, idx] of Object.entries(colMap) as [SchemeImportHeaderKey, number][]) {
    if (idx == null || idx < 0 || idx >= cells.length) continue;
    const val = cells[idx];
    if (!val) continue;
    rec[role] = val;
  }

  // Only split combined strand cell when there is no dedicated sub-strand column.
  if (!rec.subStrand && typeof rec.strand === "string" && colMap.subStrand === undefined) {
    const split = splitStrandAndSubStrand(String(rec.strand));
    if (split.subStrand) {
      rec.strand = split.strand || rec.strand;
      rec.subStrand = split.subStrand;
    }
  }

  return rec;
}

function scoreTableGrid(grid: SchemeTableGrid): number {
  const header = pickHeaderFromGrid(grid);
  if (!header) return 0;
  const colMap = inferMissingColumnIndices(
    grid,
    header.headerRowIndex,
    header.colMap,
    header.composedHeaders,
  );
  const dataRows = grid.slice(header.headerRowIndex + 1);
  if (dataRows.length < 2) return Object.keys(colMap).length;

  let filledTail = 0;
  for (const row of dataRows.slice(0, 12)) {
    const rec = recordFromRow(row, colMap);
    if (rec.contentStandard || rec.indicators || rec.teachingActivities) filledTail++;
    if (rec.subStrand) filledTail++;
  }

  return Object.keys(colMap).length * 2 + dataRows.length + filledTail * 3;
}

export function mapTableGridsToSchemeRows(
  grids: SchemeTableGrid[],
  options?: { confidence?: number | null },
): ISchemeImportParsedRow[] {
  const normalized = mergeSchemeTableGridsByHeader(
    grids.map(normalizeGrid).filter((g) => g.length >= 2),
  );
  if (!normalized.length) return [];

  const bestGrid = normalized.sort((a, b) => scoreTableGrid(b) - scoreTableGrid(a))[0];
  const header = pickHeaderFromGrid(bestGrid);
  if (!header) return [];

  const colMap = inferMissingColumnIndices(
    bestGrid,
    header.headerRowIndex,
    header.colMap,
    header.composedHeaders,
  );
  const dataRows = bestGrid.slice(header.headerRowIndex + 1);
  const out: ISchemeImportParsedRow[] = [];

  for (let i = 0; i < dataRows.length && out.length < SCHEME_IMPORT_MAX_ROWS; i++) {
    const rec = recordFromRow(dataRows[i], colMap);
    const row = buildSchemeImportRowFromFieldRecord(rec, out.length + 2, {
      confidence: options?.confidence ?? 0.85,
    });
    if (row) out.push(row);
  }

  return out;
}

export function mapSingleTableToSchemeRows(
  grid: SchemeTableGrid,
  options?: { confidence?: number | null },
): ISchemeImportParsedRow[] {
  const rows = mapTableGridsToSchemeRows([grid], options);
  return isViableSchemeImportRows(rows) ? rows : [];
}

/** Detect mapped NaCCA columns from PDF/spreadsheet table grids (header scan only). */
export function detectSchemeImportColumnMapFromGrids(
  grids: SchemeTableGrid[],
): Partial<Record<SchemeImportHeaderKey, number>> | null {
  const normalized = mergeSchemeTableGridsByHeader(
    grids.map(normalizeGrid).filter((g) => g.length >= 2),
  );
  if (!normalized.length) return null;

  const bestGrid = normalized.sort((a, b) => scoreTableGrid(b) - scoreTableGrid(a))[0];
  const header = pickHeaderFromGrid(bestGrid);
  if (!header) return null;

  return inferMissingColumnIndices(
    bestGrid,
    header.headerRowIndex,
    header.colMap,
    header.composedHeaders,
  );
}

export { isViableSchemeImportRows };
