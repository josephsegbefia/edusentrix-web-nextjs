import "server-only";
import mongoose from "mongoose";
import OpenAI from "openai";
import { z } from "zod";
import type { ISchemeImportParsedRow } from "@/models/SchemeImportJob";
import { trackUsage } from "@/lib/billing/trackUsage";

const AI_ROW_SCHEMA = z.object({
  weekNumber: z.union([z.number().min(1).max(53), z.null()]).optional(),
  title: z.string(),
  learningObjective: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const AI_PAYLOAD_SCHEMA = z.object({
  rows: z.array(AI_ROW_SCHEMA).max(80),
});

const MAX_INPUT_CHARS = 18_000;

function rowErrors(title: string, weekNumber: number | null): string[] {
  const errors: string[] = [];
  const t = title.trim();
  if (t.length < 2) errors.push("Title must be at least 2 characters");
  if (weekNumber != null && (weekNumber < 1 || weekNumber > 53)) {
    errors.push("Week must be between 1 and 53");
  }
  return errors;
}

export async function extractSchemeRowsWithAiFromPdfText(args: {
  rawText: string;
  schoolId: mongoose.Types.ObjectId;
}): Promise<{ ok: true; rows: ISchemeImportParsedRow[] } | { ok: false; error: string }> {
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, error: "AI extraction is not configured (missing OPENAI_API_KEY)" };
  }

  const clipped =
    args.rawText.length > MAX_INPUT_CHARS
      ? `${args.rawText.slice(0, MAX_INPUT_CHARS)}\n\n[…text truncated for AI…]`
      : args.rawText;

  if (!clipped.trim()) {
    return { ok: false, error: "No extractable text from PDF (try a text-based PDF, not a scan)" };
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You extract scheme-of-work / weekly plan ROWS from messy PDF text for a school.
Return JSON only with shape: { "rows": [ { "weekNumber": number|null, "title": string, "learningObjective": string|null, "notes": string|null, "confidence": number } ] }
Rules:
- Each row is one teaching block/week/topic line from the document.
- weekNumber: infer week number (1–53) only when clearly indicated; otherwise null.
- title: short topic/unit title (required, min 2 chars after trim).
- learningObjective: objectives/outcomes if present, else null.
- notes: resources, assessment hints, duration, subtopics — else null.
- confidence: your certainty this row is a real scheme row (0–1). Lower for guesses.
- Skip cover pages, headers-only lines, and footers. Max 80 rows.`,
        },
        {
          role: "user",
          content: `PDF extracted text:\n\n${clipped}`,
        },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
      max_tokens: 8000,
    });
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "OpenAI request failed" };
  }

  const responseText = completion.choices[0]?.message?.content;
  if (!responseText) {
    return { ok: false, error: "Empty AI response" };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(responseText);
  } catch {
    const m = responseText.match(/\{[\s\S]*\}/);
    if (!m) return { ok: false, error: "Invalid JSON from AI" };
    try {
      parsedJson = JSON.parse(m[0]);
    } catch {
      return { ok: false, error: "Invalid JSON from AI" };
    }
  }

  const parsed = AI_PAYLOAD_SCHEMA.safeParse(parsedJson);
  if (!parsed.success) {
    return { ok: false, error: "AI returned an unexpected shape" };
  }

  const rows: ISchemeImportParsedRow[] = parsed.data.rows.map((r, i) => {
    const title = (r.title || "").trim();
    const weekNumber =
      r.weekNumber === undefined || r.weekNumber === null ? null : r.weekNumber;
    const learningObjective =
      r.learningObjective === undefined || r.learningObjective === null
        ? null
        : String(r.learningObjective).trim() || null;
    const notes =
      r.notes === undefined || r.notes === null ? null : String(r.notes).trim() || null;
    const confidence =
      typeof r.confidence === "number" && Number.isFinite(r.confidence)
        ? Math.min(1, Math.max(0, r.confidence))
        : null;

    return {
      rowIndex: i + 2,
      weekNumber,
      title,
      learningObjective,
      notes,
      skipped: false,
      errors: rowErrors(title, weekNumber),
      confidence,
    };
  });

  await trackUsage({
    schoolId: args.schoolId,
    provider: "openai",
    metricKey: "ai_calls",
    quantity: 1,
    unitLabel: "calls",
    allocationMethod: "direct",
    sourceType: "manual",
    notes: "Scheme PDF import AI extraction.",
  });
  await trackUsage({
    schoolId: args.schoolId,
    provider: "openai",
    metricKey: "total_tokens",
    quantity: Math.max(0, Number(completion.usage?.total_tokens || 0)),
    unitLabel: "tokens",
    allocationMethod: "direct",
    sourceType: "manual",
    notes: "Scheme PDF import AI tokens.",
  });

  return { ok: true, rows };
}
