import "server-only";

import mongoose from "mongoose";
import OpenAI from "openai";
import { trackUsage } from "@/lib/billing/trackUsage";
import {
  formatOpenAiImportError,
  isOpenAiModelOrAccessError,
  isRetryableAiProviderError,
} from "@/lib/schemes/scheme-import-ai-error";
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

type SchemeRow = ReturnType<typeof parseSchemeRowsFromModelJson>[number];

function schemeImportOpenAiModels(): string[] {
  const configured = process.env.OPENAI_SCHEME_IMPORT_MODEL?.trim();
  if (configured) return [configured];
  return ["gpt-4o", "gpt-4o-mini"];
}

/**
 * Retry delays for transient network errors (ECONNRESET / fetch failed).
 * Exponential: 0s, 8s, 20s, 40s, 60s — five attempts total.
 */
const CONNECTIVITY_RETRY_DELAYS_MS = [0, 8_000, 20_000, 40_000, 60_000];

/**
 * Retry delays for non-connectivity errors (rate-limit, slow response).
 * Three attempts: 0s, 5s, 15s.
 */
const STANDARD_RETRY_DELAYS_MS = [0, 5_000, 15_000];

async function callOpenAiForChunk(
  openai: OpenAI,
  chunk: string,
  chunkIndex: number,
  totalChunks: number,
): Promise<{ rows: SchemeRow[]; totalTokens: number; model: string } | { error: string }> {
  const models = schemeImportOpenAiModels();
  let lastError = "OpenAI request failed";

  for (const model of models) {
    let connectivityFailCount = 0;
    const retryDelaysMs = CONNECTIVITY_RETRY_DELAYS_MS;

    for (let attempt = 0; attempt < retryDelaysMs.length; attempt++) {
      if (retryDelaysMs[attempt] > 0) {
        console.info("[scheme-import] OpenAI retry wait", {
          chunk: chunkIndex,
          model,
          attempt,
          waitMs: retryDelaysMs[attempt],
        });
        await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt]));
      }
      try {
        const completion = await openai.chat.completions.create({
          model,
          messages: [
            { role: "system" as const, content: SCHEME_PDF_EXTRACTION_SYSTEM_PROMPT },
            {
              role: "user" as const,
              content: buildSchemePdfUserPrompt(chunk, chunkIndex, totalChunks),
            },
          ],
          temperature: 0.1,
          response_format: { type: "json_object" as const },
          max_tokens: 8192,
        });

        const responseText = completion.choices[0]?.message?.content;
        if (!responseText) {
          lastError = "Empty AI response";
          break;
        }

        let parsedJson: unknown;
        try {
          parsedJson = parseJsonFromModelText(responseText);
        } catch {
          lastError = "Invalid JSON from AI";
          break;
        }

        console.info("[scheme-import] OpenAI chunk ok", { chunk: chunkIndex, model });
        return {
          rows: parseSchemeRowsFromModelJson(parsedJson),
          totalTokens: Number(completion.usage?.total_tokens || 0),
          model,
        };
      } catch (e: unknown) {
        lastError = formatOpenAiImportError(e);
        const isConnectivity = /econnreset|connection|fetch failed|network|timeout/i.test(lastError);
        if (isConnectivity) connectivityFailCount++;

        console.warn("[scheme-import] OpenAI attempt failed", {
          chunk: chunkIndex,
          model,
          attempt: attempt + 1,
          connectivity: isConnectivity,
          error: lastError,
        });

        if (isOpenAiModelOrAccessError(e)) {
          // Model/permission issue — switch to next model immediately.
          break;
        }

        if (!isRetryableAiProviderError(e)) {
          console.error("[scheme-import] OpenAI non-retryable error", { model, error: e });
          return { error: lastError };
        }

        const maxAttempts = isConnectivity ? retryDelaysMs.length : STANDARD_RETRY_DELAYS_MS.length;
        if (attempt >= maxAttempts - 1) {
          console.error("[scheme-import] OpenAI exhausted retries", {
            model,
            connectivityFailCount,
            attempts: attempt + 1,
          });
          // Only break to next model after exhausting all retries.
          break;
        }
      }
    }
  }

  return { error: lastError };
}

/**
 * Deduplicates rows from multiple chunks by weekNumber (keep first occurrence).
 * For rows without a weekNumber, they are kept as-is.
 */
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

export async function extractSchemeRowsWithOpenAiFromPdfText(args: {
  rawText: string;
  schoolId: mongoose.Types.ObjectId;
}): Promise<
  { ok: true; rows: SchemeRow[] } | { ok: false; error: string }
> {
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, error: "AI extraction is not configured (missing OPENAI_API_KEY)" };
  }

  const rawText = args.rawText.trim();
  if (!rawText) {
    return { ok: false, error: "No extractable text from PDF (try a text-based PDF, not a scan)" };
  }

  // Use SDK defaults: maxRetries=2 (handles ECONNRESET transparently, same
  // as every other OpenAI caller in this codebase). Our outer retry loop
  // provides additional coverage on top of the SDK's built-in retries.
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const chunks =
    rawText.length <= SCHEME_PDF_MAX_INPUT_CHARS
      ? [rawText]
      : chunkPdfText(rawText);

  console.log(`[scheme-import] Processing PDF with ${chunks.length} chunk(s), total chars: ${rawText.length}`);

  const allRows: SchemeRow[] = [];
  let totalTokensUsed = 0;
  let firstChunkError: string | null = null;

  for (let i = 0; i < chunks.length; i++) {
    const result = await callOpenAiForChunk(openai, chunks[i], i, chunks.length);
    if ("error" in result) {
      if (i === 0) {
        firstChunkError = result.error;
        break;
      }
      console.warn(`[scheme-import] Chunk ${i + 1} failed, skipping:`, result.error);
      continue;
    }
    allRows.push(...result.rows);
    totalTokensUsed += result.totalTokens;
  }

  if (firstChunkError) {
    return { ok: false, error: firstChunkError };
  }

  const rows = deduplicateChunkRows(allRows);

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
    quantity: chunks.length,
    unitLabel: "calls",
    allocationMethod: "direct",
    sourceType: "manual",
    notes: `Scheme PDF import OpenAI extraction (${chunks.length} chunk(s)).`,
  });
  await trackUsage({
    schoolId: args.schoolId,
    provider: "openai",
    metricKey: "total_tokens",
    quantity: Math.max(0, totalTokensUsed),
    unitLabel: "tokens",
    allocationMethod: "direct",
    sourceType: "manual",
    notes: "Scheme PDF import OpenAI tokens.",
  });

  return { ok: true, rows };
}

/** @deprecated Use extractSchemeRowsWithOpenAiFromPdfText */
export const extractSchemeRowsWithAiFromPdfText = extractSchemeRowsWithOpenAiFromPdfText;
