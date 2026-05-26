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
  chunkPdfText,
  SCHEME_PDF_EXTRACTION_SYSTEM_PROMPT,
  SCHEME_PDF_MAX_INPUT_CHARS,
} from "@/lib/schemes/scheme-import-pdf-prompt";

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const REQUEST_TIMEOUT_MS = 120_000;
const GEMINI_RETRY_DELAYS_MS = [0, 8_000, 20_000, 40_000, 60_000];

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
        temperature: 0.1,
        maxOutputTokens: 16384,
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

type SchemeRow = ReturnType<typeof parseSchemeRowsFromModelJson>[number];

function deduplicateChunkRows(rows: SchemeRow[]): SchemeRow[] {
  const seenWeekNumbers = new Set<number>();
  const result: SchemeRow[] = [];
  for (const row of rows) {
    if (row.weekNumber != null) {
      if (seenWeekNumbers.has(row.weekNumber)) continue;
      seenWeekNumbers.add(row.weekNumber);
    }
    result.push(row);
  }
  return result;
}

export async function extractSchemeRowsWithGeminiFromPdfText(args: {
  rawText: string;
  schoolId: mongoose.Types.ObjectId;
}): Promise<{ ok: true; rows: SchemeRow[] } | { ok: false; error: string }> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return { ok: false, error: "Gemini is not configured (missing GEMINI_API_KEY or GOOGLE_AI_API_KEY)" };
  }

  const rawText = args.rawText.trim();
  if (!rawText) {
    return { ok: false, error: "No extractable text from PDF (try a text-based PDF, not a scan)" };
  }

  const chunks =
    rawText.length <= SCHEME_PDF_MAX_INPUT_CHARS
      ? [rawText]
      : chunkPdfText(rawText);

  console.log(`[scheme-import] Gemini processing PDF with ${chunks.length} chunk(s), total chars: ${rawText.length}`);

  const allRows: SchemeRow[] = [];
  let totalTokensUsed = 0;
  let firstChunkError: string | null = null;

  for (let i = 0; i < chunks.length; i++) {
    let chunkSuccess = false;

    for (let attempt = 0; attempt < GEMINI_RETRY_DELAYS_MS.length; attempt++) {
      if (GEMINI_RETRY_DELAYS_MS[attempt] > 0) {
        console.info("[scheme-import] Gemini retry wait", {
          chunk: i,
          attempt,
          waitMs: GEMINI_RETRY_DELAYS_MS[attempt],
        });
        await new Promise((resolve) => setTimeout(resolve, GEMINI_RETRY_DELAYS_MS[attempt]));
      }

      try {
        const result = await callGeminiGenerateContent({
          apiKey,
          systemPrompt: SCHEME_PDF_EXTRACTION_SYSTEM_PROMPT,
          userPrompt: buildSchemePdfUserPrompt(chunks[i], i, chunks.length),
        });

        let parsedJson: unknown;
        try {
          parsedJson = parseJsonFromModelText(result.text);
        } catch {
          if (i === 0) firstChunkError = "Invalid JSON from Gemini";
          break;
        }

        allRows.push(...parseSchemeRowsFromModelJson(parsedJson));
        totalTokensUsed += result.totalTokens;
        chunkSuccess = true;
        break;
      } catch (e: unknown) {
        const status =
          e && typeof e === "object" && "status" in e
            ? Number((e as { status?: number }).status)
            : undefined;
        const err = formatGeminiImportError(e, status);
        const isConnectivity = /connection|fetch failed|econnreset|network|timeout/i.test(err);

        console.warn("[scheme-import] Gemini attempt failed", {
          chunk: i,
          attempt: attempt + 1,
          connectivity: isConnectivity,
          error: err,
        });

        const isAuth = status === 401 || status === 403 || /api key|unauthenticated/i.test(err);
        if (isAuth) {
          // Key/auth errors won't resolve with retries.
          if (i === 0) firstChunkError = err;
          break;
        }

        if (attempt >= GEMINI_RETRY_DELAYS_MS.length - 1) {
          console.error("[scheme-import] Gemini chunk exhausted retries", { chunk: i, error: e });
          if (i === 0) firstChunkError = err;
        }
      }
    }

    if (!chunkSuccess && i === 0 && firstChunkError) break;
  }

  if (firstChunkError) {
    return { ok: false, error: firstChunkError };
  }

  const rows = deduplicateChunkRows(allRows);

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
    quantity: chunks.length,
    unitLabel: "calls",
    allocationMethod: "direct",
    sourceType: "manual",
    notes: `Scheme PDF import Gemini fallback extraction (${chunks.length} chunk(s)).`,
  });
  await trackUsage({
    schoolId: args.schoolId,
    provider: "openai",
    metricKey: "total_tokens",
    quantity: totalTokensUsed,
    unitLabel: "tokens",
    allocationMethod: "direct",
    sourceType: "manual",
    notes: "Scheme PDF import Gemini fallback tokens.",
  });

  return { ok: true, rows };
}
