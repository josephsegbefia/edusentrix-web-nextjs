import "server-only";

import mongoose from "mongoose";
import { trackUsage } from "@/lib/billing/trackUsage";
import { formatGeminiImportError } from "@/lib/schemes/scheme-import-ai-error";
import {
  parseJsonFromModelText,
  parseSchemeRowsFromModelJson,
} from "@/lib/schemes/scheme-import-pdf-map-rows";
import {
  buildSchemePdfUserPrompt,
  clipPdfTextForExtraction,
  SCHEME_PDF_EXTRACTION_SYSTEM_PROMPT,
} from "@/lib/schemes/scheme-import-pdf-prompt";

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const REQUEST_TIMEOUT_MS = 120_000;

export function getGeminiApiKey(): string | null {
  const key =
    process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_AI_API_KEY?.trim() || null;
  return key || null;
}

function geminiModelId(): string {
  return process.env.GEMINI_SCHEME_IMPORT_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: { message?: string; code?: number; status?: string };
};

async function callGeminiGenerateContent(args: {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
}): Promise<{ text: string; totalTokens: number }> {
  const model = geminiModelId();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(args.apiKey)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: args.systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: args.userPrompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    }),
  });

  const body = (await response.json().catch(() => null)) as GeminiGenerateResponse | null;
  if (!response.ok) {
    const apiMessage = body?.error?.message || `HTTP ${response.status}`;
    const apiStatus = body?.error?.status;
    console.error("[scheme-import] Gemini HTTP error", {
      httpStatus: response.status,
      apiStatus,
      message: apiMessage,
    });
    throw Object.assign(new Error(apiMessage), {
      status: response.status,
      apiStatus,
    });
  }

  const text = body?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) {
    throw new Error("Empty Gemini response");
  }

  const totalTokens = Math.max(
    0,
    Number(
      body?.usageMetadata?.totalTokenCount ??
        (body?.usageMetadata?.promptTokenCount ?? 0) +
          (body?.usageMetadata?.candidatesTokenCount ?? 0),
    ),
  );

  return { text, totalTokens };
}

export async function extractSchemeRowsWithGeminiFromPdfText(args: {
  rawText: string;
  schoolId: mongoose.Types.ObjectId;
}): Promise<{ ok: true; rows: ReturnType<typeof parseSchemeRowsFromModelJson> } | { ok: false; error: string }> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return { ok: false, error: "Gemini is not configured (missing GEMINI_API_KEY or GOOGLE_AI_API_KEY)" };
  }

  const clipped = clipPdfTextForExtraction(args.rawText);
  if (!clipped.trim()) {
    return { ok: false, error: "No extractable text from PDF (try a text-based PDF, not a scan)" };
  }

  const userPrompt = buildSchemePdfUserPrompt(clipped);
  let lastError = "Gemini request failed";

  try {
    const result = await callGeminiGenerateContent({
      apiKey,
      systemPrompt: SCHEME_PDF_EXTRACTION_SYSTEM_PROMPT,
      userPrompt,
    });

    let parsedJson: unknown;
    try {
      parsedJson = parseJsonFromModelText(result.text);
    } catch {
      return { ok: false, error: "Invalid JSON from Gemini" };
    }

    const rows = parseSchemeRowsFromModelJson(parsedJson);
    if (rows.length === 0) {
      return {
        ok: false,
        error:
          "Gemini could not identify scheme rows in this PDF. Try CSV/XLSX, or a clearer text-based NaCCA export.",
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
      notes: "Scheme PDF import Gemini fallback extraction.",
    });
    await trackUsage({
      schoolId: args.schoolId,
      provider: "openai",
      metricKey: "total_tokens",
      quantity: result.totalTokens,
      unitLabel: "tokens",
      allocationMethod: "direct",
      sourceType: "manual",
      notes: "Scheme PDF import Gemini fallback tokens.",
    });

    return { ok: true, rows };
  } catch (e: unknown) {
    const status =
      e && typeof e === "object" && "status" in e ? Number((e as { status?: number }).status) : undefined;
    lastError = formatGeminiImportError(e, status);
    console.error("[scheme-import] Gemini error", e);
    return { ok: false, error: lastError };
  }
}
