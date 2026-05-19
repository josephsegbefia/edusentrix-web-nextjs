import "server-only";

import mongoose from "mongoose";
import OpenAI from "openai";
import { trackUsage } from "@/lib/billing/trackUsage";
import {
  formatOpenAiImportError,
  isRetryableAiProviderError,
} from "@/lib/schemes/scheme-import-ai-error";
import {
  parseJsonFromModelText,
  parseSchemeRowsFromModelJson,
} from "@/lib/schemes/scheme-import-pdf-map-rows";
import {
  buildSchemePdfUserPrompt,
  clipPdfTextForExtraction,
  SCHEME_PDF_EXTRACTION_SYSTEM_PROMPT,
} from "@/lib/schemes/scheme-import-pdf-prompt";

export async function extractSchemeRowsWithOpenAiFromPdfText(args: {
  rawText: string;
  schoolId: mongoose.Types.ObjectId;
}): Promise<
  { ok: true; rows: ReturnType<typeof parseSchemeRowsFromModelJson> } | { ok: false; error: string }
> {
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, error: "AI extraction is not configured (missing OPENAI_API_KEY)" };
  }

  const clipped = clipPdfTextForExtraction(args.rawText);
  if (!clipped.trim()) {
    return { ok: false, error: "No extractable text from PDF (try a text-based PDF, not a scan)" };
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 120_000,
    maxRetries: 0,
  });

  const request = {
    model: "gpt-4o-mini" as const,
    messages: [
      { role: "system" as const, content: SCHEME_PDF_EXTRACTION_SYSTEM_PROMPT },
      { role: "user" as const, content: buildSchemePdfUserPrompt(clipped) },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" as const },
    max_tokens: 4096,
  };

  const retryDelaysMs = [0, 5_000, 15_000];
  let completion: Awaited<ReturnType<typeof openai.chat.completions.create>> | null = null;
  let lastError = "OpenAI request failed";

  for (let attempt = 0; attempt < retryDelaysMs.length; attempt++) {
    if (retryDelaysMs[attempt] > 0) {
      await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt]));
    }
    try {
      completion = await openai.chat.completions.create(request);
      break;
    } catch (e: unknown) {
      lastError = formatOpenAiImportError(e);
      console.warn("[scheme-import] OpenAI attempt failed", {
        attempt: attempt + 1,
        error: lastError,
      });
      if (!isRetryableAiProviderError(e) || attempt === retryDelaysMs.length - 1) {
        console.error("[scheme-import] OpenAI error", e);
        return { ok: false, error: lastError };
      }
    }
  }

  if (!completion) {
    return { ok: false, error: lastError };
  }

  const responseText = completion.choices[0]?.message?.content;
  if (!responseText) {
    return { ok: false, error: "Empty AI response" };
  }

  let parsedJson: unknown;
  try {
    parsedJson = parseJsonFromModelText(responseText);
  } catch {
    return { ok: false, error: "Invalid JSON from AI" };
  }

  const rows = parseSchemeRowsFromModelJson(parsedJson);
  if (rows.length === 0) {
    return {
      ok: false,
      error:
        "AI could not identify scheme rows in this PDF. Try CSV/XLSX, or a clearer text-based NaCCA export.",
    };
  }

  await trackUsage({
    schoolId: args.schoolId,
    provider: "openai",
    metricKey: "ai_calls",
    quantity: 1,
    unitLabel: "calls",
    allocationMethod: "direct",
    sourceType: "manual",
    notes: "Scheme PDF import OpenAI extraction.",
  });
  await trackUsage({
    schoolId: args.schoolId,
    provider: "openai",
    metricKey: "total_tokens",
    quantity: Math.max(0, Number(completion.usage?.total_tokens || 0)),
    unitLabel: "tokens",
    allocationMethod: "direct",
    sourceType: "manual",
    notes: "Scheme PDF import OpenAI tokens.",
  });

  return { ok: true, rows };
}

/** @deprecated Use extractSchemeRowsWithOpenAiFromPdfText */
export const extractSchemeRowsWithAiFromPdfText = extractSchemeRowsWithOpenAiFromPdfText;
