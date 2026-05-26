import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  LESSONS_LEO_DISCLAIMER,
  requireLessonsLeoTeacherContext,
  runLessonsLeoCompletion,
} from "@/lib/leo/lessons-draft-shared";
import { LessonSession } from "@/models/LessonSession";
import { LessonNote } from "@/models/LessonNote";
import { enrichSliceWithSchemeItems } from "@/lib/lessons/note-sections";
import { normalizeContentBlocks } from "@/lib/lessons/content-blocks";
import type { LessonAssessmentItemType } from "@/models/LessonSession";

const ASSESSMENT_ITEM_TYPES: LessonAssessmentItemType[] = [
  "multiple_choice",
  "short_answer",
  "fill_blank",
  "practical_task",
  "project",
];

const BodySchema = z.object({
  sessionId: z.string().min(1),
  count: z.number().int().min(3).max(10).default(6),
  preferredTypes: z.array(z.enum(ASSESSMENT_ITEM_TYPES)).optional(),
});

function toObjectId(id: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireLessonsLeoTeacherContext();
    if (ctx instanceof Response) return ctx;

    await connectToDatabase();

    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ") || "Invalid body";
      return Response.json({ success: false, error: msg }, { status: 400 });
    }

    const sessionOid = toObjectId(parsed.data.sessionId);
    if (!sessionOid) {
      return Response.json({ success: false, error: "Invalid session ID" }, { status: 400 });
    }

    const session = await LessonSession.findOne({
      _id: sessionOid,
      schoolId: ctx.schoolId,
      ownerTeacherId: ctx.teacherId,
    }).lean();

    if (!session) {
      return Response.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    // Load the linked lesson note for curriculum indicators
    const note = session.lessonNoteId
      ? await LessonNote.findOne({
          _id: session.lessonNoteId,
          schoolId: ctx.schoolId,
        })
          .select("topic curriculum body templateType durationMinutes")
          .lean()
      : null;

    const blocks = normalizeContentBlocks(session.contentBlocks ?? []);
    const blockSummary = blocks
      .slice(0, 16)
      .map(
        (b) =>
          `${b.type}: ${b.title || ""}\n${b.bodyHtml.replace(/<[^>]+>/g, " ").slice(0, 600)}`,
      )
      .join("\n\n");

    // Enrich context with scheme items (fall back to note-level links when session has none)
    let schemeContext = "";
    const schemeItemIds = session.noteSectionAllocation?.schemeItemIds ?? [];
    const noteSchemeItemIds = (note?.schemeItemIds ?? []) as string[];
    const enriched = await enrichSliceWithSchemeItems(
      {},
      schemeItemIds,
      ctx.schoolId,
      noteSchemeItemIds,
    );
    if (enriched.schemeItems) {
      schemeContext = `\nLinked scheme items:\n${String(enriched.schemeItems)}`;
    }

    const curriculumContext = note?.curriculum
      ? `\nCurriculum context: ${JSON.stringify(note.curriculum)}`
      : "";

    const count = parsed.data.count;
    const preferredTypes = parsed.data.preferredTypes ?? [];
    const typeGuidance =
      preferredTypes.length > 0
        ? `Prefer these item types: ${preferredTypes.join(", ")}.`
        : `Mix the types appropriately: use multiple_choice for recall (2-3 items), short_answer for application (2-3 items), and at least one practical_task or project for higher-order thinking when the content supports it.`;

    const result = await runLessonsLeoCompletion({
      context: ctx,
      model: "gpt-4o",
      systemInstruction: `Return JSON only:
{
  "assessmentItems": [
    {
      "id": string (UUID v4),
      "type": one of ${JSON.stringify(ASSESSMENT_ITEM_TYPES)},
      "title": string (short descriptive title for the item),
      "question": string (HTML — the full question or task description),
      "options": string[] | null (MCQ only — 4 options),
      "correctAnswer": string | null (model answer or rubric summary),
      "rubric": string | null (marking guidance; useful for open-ended and project items),
      "estimatedMinutes": number | null,
      "aiGenerated": true
    }
  ]
}
Rules:
- Produce exactly ${count} items.
- ${typeGuidance}
- Ground every item in the session's content blocks and curriculum indicators. Do not invent facts.
- multiple_choice: 4 plausible options; one clearly correct; distractors reflect common errors.
- short_answer: a question requiring a 1–3 sentence written response; include the expected answer.
- fill_blank: a sentence with one key term missing; include the correct answer.
- practical_task: a hands-on task students complete (experiment, measurement, construction, artwork, etc.); include what to observe/submit.
- project: a multi-step task or mini-investigation; include clear steps and what students should produce.
- correctAnswer/rubric must be present for all types — never null for MCQ or fill_blank.
- Use clear, age-appropriate language. Do not shame learners. No abusive or discouraging wording.
- Do not invent curriculum codes or assessment marks.`,
      userPrompt: `Generate ${count} assessment items for this lesson session.

Session title: ${session.title}
Duration: ${session.durationMinutes} minutes

Teaching content (summarised):
${blockSummary || "(no content blocks — use curriculum context only)"}
${curriculumContext}
${schemeContext}`,
      maxTokens: 4000,
    });

    if (!result.ok) {
      return Response.json({ success: false, error: result.error }, { status: 502 });
    }

    const data = result.data as { assessmentItems?: unknown[] };
    const rawItems = Array.isArray(data.assessmentItems) ? data.assessmentItems : [];

    const assessmentItems = rawItems
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item, index) => ({
        id: String(item.id || crypto.randomUUID()),
        type: ASSESSMENT_ITEM_TYPES.includes(item.type as LessonAssessmentItemType)
          ? (item.type as LessonAssessmentItemType)
          : "short_answer",
        title: String(item.title || `Item ${index + 1}`).slice(0, 300),
        question: String(item.question || "").slice(0, 8000),
        options: Array.isArray(item.options)
          ? (item.options as unknown[]).map((o) => String(o)).slice(0, 6)
          : undefined,
        correctAnswer: item.correctAnswer ? String(item.correctAnswer).slice(0, 2000) : null,
        rubric: item.rubric ? String(item.rubric).slice(0, 4000) : null,
        estimatedMinutes:
          typeof item.estimatedMinutes === "number" ? item.estimatedMinutes : null,
        aiGenerated: true,
      }));

    if (assessmentItems.length === 0) {
      return Response.json(
        { success: false, error: "Leo did not return any assessment items. Try again." },
        { status: 502 },
      );
    }

    return Response.json({
      success: true,
      isDraft: true,
      disclaimer: LESSONS_LEO_DISCLAIMER,
      data: { assessmentItems },
      usage: result.usage,
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[leo/lessons/generate-session-assessment]", e);
    const message = e instanceof Error ? e.message : "Leo request failed";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
