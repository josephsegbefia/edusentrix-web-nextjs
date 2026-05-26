import "server-only";

import type mongoose from "mongoose";
import type { ISchemeImportParsedRow, SchemeImportSourceKind } from "@/models/SchemeImportJob";
import { EntitlementError, requireEntitlement } from "@/lib/billing/require-entitlement";
import { extractSchemeRowsWithOpenAiFromPdfText } from "@/lib/schemes/scheme-import-pdf-ai";
import {
  extractSchemeRowsWithGeminiFromPdfText,
  getGeminiApiKey,
} from "@/lib/schemes/scheme-import-pdf-gemini";
import { isAiConfigurationError } from "@/lib/schemes/scheme-import-ai-error";
import { parseSchemeRowsFromPdfTextManually } from "@/lib/schemes/scheme-import-pdf-manual";

export type PdfSchemeParseResult =
  | {
      ok: true;
      rows: ISchemeImportParsedRow[];
      sourceKind: Extract<SchemeImportSourceKind, "pdf_ai" | "pdf_gemini" | "pdf_manual">;
      primaryError: string | null;
    }
  | { ok: false; error: string; primaryError: string | null };

/**
 * PDF extraction order:
 *   If SCHEME_IMPORT_PRIMARY_PROVIDER=gemini → Gemini first, then OpenAI.
 *   Otherwise → OpenAI first, then Gemini.
 * Manual text parser is always last.
 *
 * Set SCHEME_IMPORT_PRIMARY_PROVIDER=gemini in .env.local when OpenAI is
 * blocked by a VPN/proxy (e.g. HTTP 421 from api.openai.com).
 */
function preferGemini(): boolean {
  return process.env.SCHEME_IMPORT_PRIMARY_PROVIDER?.trim().toLowerCase() === "gemini";
}

export async function resolvePdfSchemeParsedRows(args: {
  rawText: string;
  schoolId: mongoose.Types.ObjectId;
}): Promise<PdfSchemeParseResult> {
  const hasOpenAi = Boolean(process.env.OPENAI_API_KEY?.trim());
  const hasGemini = Boolean(getGeminiApiKey());
  let aiEntitlementOk = false;

  if (hasOpenAi || hasGemini) {
    try {
      await requireEntitlement({
        schoolId: args.schoolId,
        featureKey: "curriculum_scheme",
        limitKey: "maxAICallsPerMonth",
        expensive: true,
      });
      aiEntitlementOk = true;
    } catch (error) {
      if (error instanceof EntitlementError) {
        return parseWithManualFallback(
          args.rawText,
          `${error.message} AI extraction was skipped; using the manual PDF parser instead.`,
        );
      }
      throw error;
    }
  }

  let primaryError: string | null = null;
  const geminiFirst = preferGemini();

  type AiResult =
    | { rows: ISchemeImportParsedRow[]; sourceKind: "pdf_ai" | "pdf_gemini" }
    | null;

  async function tryOpenAi(): Promise<AiResult> {
    if (!hasOpenAi || !aiEntitlementOk) {
      if (!hasOpenAi) primaryError = "OpenAI is not configured (missing OPENAI_API_KEY)";
      return null;
    }
    console.info("[scheme-import] trying OpenAI for row extraction…");
    const openAi = await extractSchemeRowsWithOpenAiFromPdfText({
      rawText: args.rawText,
      schoolId: args.schoolId,
    });
    if (openAi.ok && openAi.rows.length > 0) {
      return { rows: openAi.rows, sourceKind: "pdf_ai" };
    }
    primaryError = openAi.ok
      ? "OpenAI could not identify scheme rows in this PDF"
      : openAi.error;
    console.info("[scheme-import] OpenAI did not produce rows", { primaryError });
    return null;
  }

  async function tryGemini(): Promise<AiResult> {
    if (!hasGemini || !aiEntitlementOk) return null;
    console.info("[scheme-import] trying Gemini for row extraction…", { primaryError });
    const gemini = await extractSchemeRowsWithGeminiFromPdfText({
      rawText: args.rawText,
      schoolId: args.schoolId,
    });
    if (gemini.ok && gemini.rows.length > 0) {
      return { rows: gemini.rows, sourceKind: "pdf_gemini" };
    }
    const geminiError = gemini.ok
      ? "Gemini could not identify scheme rows in this PDF"
      : gemini.error;
    primaryError = primaryError ? `${primaryError}; ${geminiError}` : geminiError;
    console.info("[scheme-import] Gemini did not produce rows", { primaryError });
    return null;
  }

  const steps = geminiFirst ? [tryGemini, tryOpenAi] : [tryOpenAi, tryGemini];

  for (const step of steps) {
    const result = await step();
    if (result) {
      return { ok: true, rows: result.rows, sourceKind: result.sourceKind, primaryError: null };
    }
  }

  if (isAiConfigurationError(primaryError)) {
    return {
      ok: false,
      error: `${primaryError} Fix API keys in .env.local (OPENAI_API_KEY and/or GEMINI_API_KEY / GOOGLE_AI_API_KEY), restart the dev server, then re-upload. CSV/XLSX import does not require AI.`,
      primaryError,
    };
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
