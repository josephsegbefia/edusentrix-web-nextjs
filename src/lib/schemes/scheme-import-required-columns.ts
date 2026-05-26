import {
  SCHEME_IMPORT_COLUMN_LABELS,
  mapSchemeImportHeaderKey,
  type SchemeImportHeaderKey,
} from "@/lib/schemes/scheme-import-columns";

/** Human-readable labels shown in import UI and validation errors. */
export { SCHEME_IMPORT_COLUMN_LABELS };

export type SchemeImportColumnRequirement = {
  anyOf: SchemeImportHeaderKey[];
  label: string;
};

/** Minimum NaCCA/GES scheme table columns required before upload or import. */
export const SCHEME_IMPORT_COLUMN_REQUIREMENTS: SchemeImportColumnRequirement[] = [
  { anyOf: ["weekEnding", "week"], label: "Week or Week ending" },
  { anyOf: ["strand"], label: "Strand" },
  { anyOf: ["subStrand"], label: "Sub-strand" },
  { anyOf: ["contentStandard"], label: "Content standard" },
  {
    anyOf: ["indicatorsAndOutcomes", "indicators", "learningOutcomes"],
    label: "Indicators / Learning outcomes",
  },
  { anyOf: ["teachingActivities"], label: "Teaching & Learning Activities" },
  { anyOf: ["resources"], label: "Resources" },
  { anyOf: ["assessment"], label: "Assessment" },
];

export function evaluateSchemeImportColumnMap(
  colMap: Partial<Record<SchemeImportHeaderKey, number>>,
): { ok: true } | { ok: false; missing: string[] } {
  const missing: string[] = [];
  for (const req of SCHEME_IMPORT_COLUMN_REQUIREMENTS) {
    const found = req.anyOf.some((key) => colMap[key] !== undefined);
    if (!found) missing.push(req.label);
  }
  return missing.length ? { ok: false, missing } : { ok: true };
}

export function buildSchemeImportColumnMapFromHeaderLabels(
  headers: string[],
): Partial<Record<SchemeImportHeaderKey, number>> {
  const colMap: Partial<Record<SchemeImportHeaderKey, number>> = {};
  headers.forEach((header, idx) => {
    const role = mapSchemeImportHeaderKey(header);
    if (!role) return;
    if (colMap[role] === undefined) colMap[role] = idx;
  });
  return colMap;
}

export function formatSchemeImportColumnValidationError(missing: string[]): string {
  const list = missing.join(", ");
  return (
    "This file does not look like a Ghana NaCCA/GES Scheme of Learning table. " +
    `Missing required column${missing.length === 1 ? "" : "s"}: ${list}. ` +
    "Use the official layout with Week, Week ending, Strand, Sub-strand, Content standard, " +
    "Indicators / Learning outcomes, Teaching & Learning Activities, Resources, and Assessment."
  );
}

export function formatSchemeImportNoTableError(fileKind: "pdf" | "spreadsheet"): string {
  if (fileKind === "pdf") {
    return (
      "We could not find a readable scheme table in this PDF. " +
      "Upload a text-based NaCCA/GES Scheme of Learning export (not a scanned photo), " +
      "or use CSV/XLSX with the standard column headers."
    );
  }
  return (
    "We could not find scheme column headers in this spreadsheet. " +
    "The first row should list Week ending, Strand, Sub-strand, Content standard, and the other NaCCA columns."
  );
}
