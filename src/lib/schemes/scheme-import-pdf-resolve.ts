import "server-only";

import type mongoose from "mongoose";
import type { ISchemeImportParsedRow, SchemeImportSourceKind } from "@/models/SchemeImportJob";
import { EntitlementError, requireEntitlement } from "@/lib/billing/require-entitlement";
import { extractSchemeRowsWithOpenAiFromPdfText } from "@/lib/schemes/scheme-import-pdf-ai";
import {
  extractSchemeRowsWithGeminiFromPdfText,
  getGeminiApiKey,
} from "@/lib/schemes/scheme-import-pdf-gemini";

export type PdfSchemeParseResult =
  | {
      ok: true;
      rows: ISchemeImportParsedRow[];
      sourceKind: Extract<SchemeImportSourceKind, "pdf_ai" | "pdf_gemini">;
      primaryError: string | null;
    }
  | { ok: false; error: string; primaryError: string | null };

/**
 * OpenAI (Leo) first; Gemini fallback when OpenAI fails or returns no rows.
 */
export async function resolvePdfSchemeParsedRows(args: {
  rawText: string;
  schoolId: mongoose.Types.ObjectId;
}): Promise<PdfSchemeParseResult> {
  const hasOpenAi = Boolean(process.env.OPENAI_API_KEY?.trim());
  const hasGemini = Boolean(getGeminiApiKey());

  if (!hasOpenAi && !hasGemini) {
    return {
      ok: false,
      error:
        "PDF import requires OPENAI_API_KEY or GEMINI_API_KEY (GOOGLE_AI_API_KEY). Add at least one and restart the server.",
      primaryError: null,
    };
  }

  try {
    await requireEntitlement({
      schoolId: args.schoolId,
      featureKey: "curriculum_scheme",
      limitKey: "maxAICallsPerMonth",
      expensive: true,
    });
  } catch (error) {
    if (error instanceof EntitlementError) {
      return { ok: false, error: error.message, primaryError: null };
    }
    throw error;
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
  }

  if (hasGemini) {
    console.info("[scheme-import] trying Gemini fallback…");
    const gemini = await extractSchemeRowsWithGeminiFromPdfText({
      rawText: args.rawText,
      schoolId: args.schoolId,
    });
    if (gemini.ok && gemini.rows.length > 0) {
      return {
        ok: true,
        rows: gemini.rows,
        sourceKind: "pdf_gemini",
        primaryError,
      };
    }
    const geminiError = gemini.ok
      ? "Gemini could not identify scheme rows in this PDF"
      : gemini.error;
    return {
      ok: false,
      error: composeFailureMessage(primaryError, geminiError),
      primaryError,
    };
  }

  return {
    ok: false,
    error: primaryError
      ? `${primaryError} Gemini is not configured for fallback.`
      : "OpenAI failed and Gemini is not configured (missing GEMINI_API_KEY).",
    primaryError,
  };
}

function composeFailureMessage(openAiError: string | null, geminiError: string): string {
  if (openAiError && geminiError) {
    return `OpenAI: ${openAiError} Gemini: ${geminiError}`;
  }
  return geminiError || openAiError || "Could not extract scheme rows from this PDF.";
}
