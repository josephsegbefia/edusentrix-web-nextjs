import type { ISchemeImportParsedRow } from "@/models/SchemeImportJob";
import {
  clampSchemeItemShortText,
  clampSchemeItemShortTextOrNull,
} from "@/lib/schemes/scheme-item-field-limits";

export function buildSchemeItemTitle(row: ISchemeImportParsedRow): string {
  const raw =
    row.title?.trim() ||
    row.subStrand?.trim() ||
    row.strand?.trim() ||
    row.contentStandard?.trim() ||
    row.indicators?.[0]?.trim() ||
    "Scheme row";
  return clampSchemeItemShortText(raw);
}

export function schemeImportRowFieldsForItem(row: ISchemeImportParsedRow) {
  return {
    title: buildSchemeItemTitle(row),
    strand: clampSchemeItemShortTextOrNull(row.strand),
    subStrand: clampSchemeItemShortTextOrNull(row.subStrand),
    contentStandard: row.contentStandard?.trim() || null,
  };
}
