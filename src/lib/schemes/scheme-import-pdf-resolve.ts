import "server-only";

import type mongoose from "mongoose";
import type { ISchemeImportParsedRow, SchemeImportSourceKind } from "@/models/SchemeImportJob";
import { EntitlementError, requireEntitlement } from "@/lib/billing/require-entitlement";
import { extractSchemeRowsWithOpenAiFromPdfText } from "@/lib/schemes/scheme-import-pdf-ai";
import { parseSchemeRowsFromPdfTextManually } from "@/lib/schemes/scheme-import-pdf-manual";

export type PdfSchemeParseResult =
  | {
      ok: true;
      rows: ISchemeImportParsedRow[];
      sourceKind: Extract<SchemeImportSourceKind, "pdf_ai" | "pdf_manual">;
      primaryError: string | null;
    }
  | { ok: false; error: string; primaryError: string | null };

/**
 * OpenAI (Leo) first; deterministic PDF text fallback when OpenAI fails or returns no rows.
 */
export async function resolvePdfSchemeParsedRows(args: {
  rawText: string;
  schoolId: mongoose.Types.ObjectId;
}): Promise<PdfSchemeParseResult> {
  const hasOpenAi = Boolean(process.env.OPENAI_API_KEY?.trim());

  if (hasOpenAi) {
    try {
      await requireEntitlement({
        schoolId: args.schoolId,
        featureKey: "curriculum_scheme",
        limitKey: "maxAICallsPerMonth",
        expensive: true,
      });
    } catch (error) {
      if (error instanceof EntitlementError) {
        return parseWithManualFallback(args.rawText, error.message);
      }
      throw error;
    }
  }

  let primaryError: string | null = null;

  if (hasOpenAi) {
    console.info("[scheme-import] trying OpenAI for row extraction…");
    const openAi = await extractSchemeRowsWithOpenAiFromPdfText({
      rawText: args.rawText,
      schoolId: args.schoolId,
    });
    if (openAi.ok && openAi.rows.length > 0) {
      return { ok: true, rows: openAi.rows, sourceKind: "pdf_ai", primaryError: null };
    }
    primaryError = openAi.ok
      ? "OpenAI could not identify scheme rows in this PDF"
      : openAi.error;
    console.info("[scheme-import] OpenAI did not produce rows", { primaryError });
  } else {
    primaryError = "OpenAI is not configured (missing OPENAI_API_KEY)";
  }

  return parseWithManualFallback(args.rawText, primaryError);
}

function parseWithManualFallback(rawText: string, primaryError: string | null): PdfSchemeParseResult {
  console.info("[scheme-import] trying manual PDF text parser…", { primaryError });
  const rows = parseSchemeRowsFromPdfTextManually(rawText);
  if (rows.length > 0) {
    return {
      ok: true,
      rows,
      sourceKind: "pdf_manual",
      primaryError,
    };
  }
  return {
    ok: false,
    error: primaryError
      ? `${primaryError} Manual PDF parsing also could not identify scheme rows. Use a text-based table PDF or CSV/XLSX.`
      : "Manual PDF parsing could not identify scheme rows. Use a text-based table PDF or CSV/XLSX.",
    primaryError,
  };
}
