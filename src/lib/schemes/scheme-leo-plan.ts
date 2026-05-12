import "server-only";
import mongoose from "mongoose";
import OpenAI from "openai";
import { z } from "zod";
import type { ICurriculumNode } from "@/models/CurriculumNode";
import type { ISchemeItem } from "@/models/SchemeItem";
import type { ISchemeOfWork } from "@/models/SchemeOfWork";
import { EntitlementError, requireEntitlement } from "@/lib/billing/require-entitlement";
import { trackUsage } from "@/lib/billing/trackUsage";
import type { LeoSchemePlanMode, LeoSchemePlanResult, LeoSchemePlanRow } from "@/types/scheme-leo";
export type { LeoSchemePlanMode, LeoSchemePlanResult, LeoSchemePlanRow } from "@/types/scheme-leo";

const AI_RESULT_SCHEMA = z.object({
  assistantSummary: z.string(),
  suggestedRows: z
    .array(
      z.object({
        weekNumber: z.union([z.number().min(1).max(53), z.null()]).optional(),
        title: z.string(),
        learningObjective: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        curriculumNodeIds: z.array(z.string()).optional(),
      })
    )
    .max(80),
  pacingNotes: z.string().nullable().optional(),
  uncoveredTopics: z.array(z.string()).max(200).optional(),
  revisionFocus: z.array(z.string()).max(80).optional(),
  catchUpNotes: z.string().nullable().optional(),
});

const MAX_CURRICULUM_CONTEXT_CHARS = 24_000;
const MAX_ITEMS_CONTEXT_CHARS = 12_000;

const DISCLAIMER =
  "This is an AI draft for review only. It does not change your scheme until you add or edit rows yourself.";

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n\n[…truncated…]`;
}

function serializeItemsForPrompt(items: ISchemeItem[]): string {
  const lines = items
    .filter((i) => i.status !== "dropped")
    .sort((a, b) => {
      const wa = a.weekNumber ?? 999;
      const wb = b.weekNumber ?? 999;
      if (wa !== wb) return wa - wb;
      return a.sequence - b.sequence;
    })
    .map((i) =>
      JSON.stringify({
        id: String(i._id),
        weekNumber: i.weekNumber,
        title: i.title,
        learningObjective: i.learningObjective,
        notes: i.notes,
        curriculumNodeIds: (i.curriculumNodeIds || []).map(String),
        coverageStatus: i.coverageStatus ?? "not_started",
      })
    );
  return clip(lines.join("\n"), MAX_ITEMS_CONTEXT_CHARS);
}

function serializeNodesForPrompt(nodes: ICurriculumNode[]): string {
  const lines = nodes.map((n) =>
    JSON.stringify({
      id: String(n._id),
      kind: n.kind,
      title: n.title,
      code: n.code,
      parentNodeId: n.parentNodeId ? String(n.parentNodeId) : null,
      order: n.order,
    })
  );
  return clip(lines.join("\n"), MAX_CURRICULUM_CONTEXT_CHARS);
}

function modeInstructions(mode: LeoSchemePlanMode): string {
  switch (mode) {
    case "draft_from_curriculum":
      return `Mode: DRAFT_FROM_CURRICULUM
Build a plausible weekly scheme outline from the curriculum nodes. Output suggestedRows only — one row per major teaching week/topic where sensible.
Map curriculumNodeIds to the provided node ids when a row clearly aligns with specific nodes.`;
    case "missing_objectives":
      return `Mode: MISSING_OBJECTIVES
The teacher already has scheme rows. Suggest learningObjective text for rows that lack objectives or need clearer outcomes.
Prefer updating via suggestedRows that mirror existing titles/weeks; include curriculumNodeIds when relevant.`;
    case "pacing":
      return `Mode: PACING
Recommend term pacing: pacingNotes (paragraph), and optional suggestedRows adjustments if weeks look overloaded or sparse.
Do not delete user content — suggest additions or notes only.`;
    case "uncovered":
      return `Mode: UNCOVERED
Compare curriculum nodes to existing scheme rows (titles + curriculumNodeIds). List uncoveredTopics (strings).
Add suggestedRows for gap topics that should be planned if missing.`;
    case "catch_up":
      return `Mode: CATCH_UP
Assume some rows may be behind. Produce catchUpNotes and compact suggestedRows for consolidation/reordering suggestions (draft only).`;
    case "revision":
      return `Mode: REVISION
Suggest revisionFocus bullets and optional suggestedRows for revision/reteach weeks before assessments.`;
    default:
      return "";
  }
}

export async function runLeoSchemePlan(args: {
  mode: LeoSchemePlanMode;
  scheme: ISchemeOfWork;
  items: ISchemeItem[];
  curriculumNodes: ICurriculumNode[];
  schoolId: mongoose.Types.ObjectId;
}): Promise<{ ok: true; result: LeoSchemePlanResult } | { ok: false; error: string }> {
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, error: "AI planning is not configured (missing OPENAI_API_KEY)" };
  }

  try {
    await requireEntitlement({
      schoolId: args.schoolId,
      featureKey: "ai_leo_copilot",
      limitKey: "maxAICallsPerMonth",
      expensive: true,
    });
  } catch (error) {
    if (error instanceof EntitlementError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  const nodeIdSet = new Set(args.curriculumNodes.map((n) => String(n._id)));
  const schemeMeta = {
    title: args.scheme.title,
    description: args.scheme.description ?? null,
    academicYearLabel: args.scheme.academicYearLabel ?? null,
    termLabel: args.scheme.termLabel ?? null,
    curriculumId: args.scheme.curriculumId ? String(args.scheme.curriculumId) : null,
    curriculumSubjectId: args.scheme.curriculumSubjectId
      ? String(args.scheme.curriculumSubjectId)
      : null,
  };

  const userPayload = [
    `MODE_INSTRUCTIONS:\n${modeInstructions(args.mode)}`,
    `SCHEME_META:\n${JSON.stringify(schemeMeta)}`,
    `EXISTING_ITEMS:\n${serializeItemsForPrompt(args.items)}`,
    `CURRICULUM_NODES:\n${serializeNodesForPrompt(args.curriculumNodes)}`,
  ].join("\n\n");

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are Leo, an academic planning assistant for teachers. You NEVER activate or publish schemes.
Return JSON only with this exact shape:
{
  "assistantSummary": string (markdown allowed, concise),
  "suggestedRows": [ { "weekNumber": number|null, "title": string, "learningObjective": string|null, "notes": string|null, "curriculumNodeIds": string[]? } ],
  "pacingNotes": string|null,
  "uncoveredTopics": string[],
  "revisionFocus": string[],
  "catchUpNotes": string|null
}
Rules:
- suggestedRows are DRAFT suggestions; the teacher must confirm before saving.
- Only use curriculumNodeIds from the CURRICULUM_NODES ids list when referencing nodes.
- Keep suggestedRows under 40 unless mode needs more; max 80.
- Be practical for classroom use; avoid policy/legal claims.
- For missing_objectives, align suggestions with existing row titles where possible.`,
        },
        { role: "user", content: userPayload },
      ],
      temperature: 0.35,
      response_format: { type: "json_object" },
      max_tokens: 6000,
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

  const parsed = AI_RESULT_SCHEMA.safeParse(parsedJson);
  if (!parsed.success) {
    return { ok: false, error: "AI returned an unexpected shape" };
  }

  const suggestedRows: LeoSchemePlanRow[] = parsed.data.suggestedRows.map((r) => {
    const weekNumber =
      r.weekNumber === undefined
        ? null
        : r.weekNumber === null
          ? null
          : r.weekNumber;
    const title = (r.title || "").trim();
    const rawNodeIds = r.curriculumNodeIds || [];
    const curriculumNodeIds = rawNodeIds.filter((id) => nodeIdSet.has(id));

    return {
      weekNumber,
      title: title.length >= 2 ? title : "Untitled row",
      learningObjective:
        r.learningObjective === undefined || r.learningObjective === null
          ? null
          : String(r.learningObjective).trim() || null,
      notes:
        r.notes === undefined || r.notes === null ? null : String(r.notes).trim() || null,
      curriculumNodeIds,
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
    notes: "Leo scheme academic planner.",
  });
  await trackUsage({
    schoolId: args.schoolId,
    provider: "openai",
    metricKey: "total_tokens",
    quantity: Math.max(0, Number(completion.usage?.total_tokens || 0)),
    unitLabel: "tokens",
    allocationMethod: "direct",
    sourceType: "manual",
    notes: "Leo scheme planner tokens.",
  });

  return {
    ok: true,
    result: {
      mode: args.mode,
      isDraft: true,
      disclaimer: DISCLAIMER,
      assistantSummary: parsed.data.assistantSummary.trim() || "—",
      suggestedRows,
      pacingNotes:
        parsed.data.pacingNotes === undefined || parsed.data.pacingNotes === null
          ? null
          : String(parsed.data.pacingNotes).trim() || null,
      uncoveredTopics: parsed.data.uncoveredTopics ?? [],
      revisionFocus: parsed.data.revisionFocus ?? [],
      catchUpNotes:
        parsed.data.catchUpNotes === undefined || parsed.data.catchUpNotes === null
          ? null
          : String(parsed.data.catchUpNotes).trim() || null,
    },
  };
}
