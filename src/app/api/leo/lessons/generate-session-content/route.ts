import { z } from "zod";
import mongoose from "mongoose";
import { LESSON_CONTENT_BLOCK_TYPES } from "@/types/lesson-content-blocks";
import {
  findLessonNoteForTeacher,
  lessonNoteTeachingMetadata,
  LESSONS_LEO_DISCLAIMER,
  requireLessonsLeoTeacherContext,
  runLessonsLeoCompletion,
} from "@/lib/leo/lessons-draft-shared";
import { connectToDatabase } from "@/db/connectToDatabase";
import { LessonSession } from "@/models/LessonSession";
import { enrichSliceWithSchemeItems, sliceNoteContextForSections } from "@/lib/lessons/note-sections";
import { normalizeContentBlocks } from "@/lib/lessons/content-blocks";

const BodySchema = z.object({
  lessonNoteId: z.string().min(1),
  /** Optional: if provided, scheme items linked to this session are added to the context. */
  sessionId: z.string().optional(),
  session: z.object({
    title: z.string().trim().min(1).max(220),
    durationMinutes: z.number().int().min(1).max(240),
    noteSectionKeys: z.array(z.string().min(1)).default([]),
    coverageWeight: z.number().min(0).max(1).optional(),
    scheduledDate: z.string().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    periodCount: z.number().int().min(1).max(8).optional(),
    isDoublePeriod: z.boolean().optional(),
    focusSummary: z.string().trim().max(500).optional(),
  }),
});

const UNSAFE_LANGUAGE_PATTERN =
  /\b(stupid|idiot|dumb|useless|worthless|shut up|fool|foolish|lazy learners?|hopeless|nonsense)\b/i;

function hasUnsafeLanguage(blocks: Array<{ bodyHtml?: unknown; title?: unknown }>) {
  return blocks.some((block) =>
    UNSAFE_LANGUAGE_PATTERN.test(`${String(block.title || "")} ${String(block.bodyHtml || "")}`),
  );
}

function plainTextLength(value: unknown) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}

export async function POST(req: Request) {
  try {
    const ctx = await requireLessonsLeoTeacherContext();
    if (ctx instanceof Response) return ctx;

    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ") || "Invalid body";
      return Response.json({ success: false, error: msg }, { status: 400 });
    }

    const note = await findLessonNoteForTeacher(
      parsed.data.lessonNoteId,
      ctx.schoolId,
      ctx.teacherId,
    );
    if (!note) {
      return Response.json({ success: false, error: "Lesson note not found" }, { status: 404 });
    }

    // Load scheme items from an existing session if sessionId provided
    let schemeItemIds: mongoose.Types.ObjectId[] = [];
    if (parsed.data.sessionId) {
      try {
        const sessionOid = new mongoose.Types.ObjectId(parsed.data.sessionId);
        const existingSession = await LessonSession.findOne({
          _id: sessionOid,
          schoolId: ctx.schoolId,
        })
          .select("noteSectionAllocation.schemeItemIds")
          .lean();
        schemeItemIds = existingSession?.noteSectionAllocation?.schemeItemIds ?? [];
      } catch {
        // invalid id — ignore
      }
    }

    let slice = sliceNoteContextForSections(note, parsed.data.session.noteSectionKeys);
    slice = await enrichSliceWithSchemeItems(
      slice,
      schemeItemIds,
      ctx.schoolId,
      (note.schemeItemIds ?? []) as string[],
    );
    const teachingMetadata = await lessonNoteTeachingMetadata(note);
    const sliceJson = JSON.stringify(slice);

    const isDouble = parsed.data.session.isDoublePeriod ?? false;
    const minBlocks = isDouble ? 14 : 10;
    const maxBlocks = isDouble ? 18 : 14;
    const minChars = isDouble ? 2500 : 1500;

    const result = await runLessonsLeoCompletion({
      context: ctx,
      model: "gpt-4o",
      systemInstruction: `Return JSON only:
{
  "contentBlocks": [
    {
      "type": one of ${JSON.stringify(LESSON_CONTENT_BLOCK_TYPES)},
      "title": string (short, specific heading — not a generic label),
      "bodyHtml": string (HTML using <p>, <ul>, <li>, <strong>, <em> only; English only),
      "order": number (0-based),
      "estimatedMinutes": number (optional),
      "aiGenerated": true,
      "teacherReviewed": false,
      "resourceUrl": string | null (only for resource_embed)
    }
  ]
}
Rules — REQUIRED STRUCTURE (produce ${minBlocks}–${maxBlocks} blocks for this ${parsed.data.session.durationMinutes}-minute ${isDouble ? "double-period" : "single-period"} lesson):
1. STARTER block (type "explanation"): Activate relevant prior knowledge with a direct recall question or quick activity. State the learning target in plain learner language ("By the end of this session you will be able to…"). Do not just re-read the topic.
2. CORE EXPLANATION block(s) (type "explanation"): Explain the concept clearly with definition, reasoning, and context. Break complex ideas into short paragraphs. Use subject vocabulary and define new terms.
3. WORKED EXAMPLE block(s) (type "example"): At least ONE fully worked example with numbered step-by-step reasoning. For maths, show concrete numbers → abstract rule. For science/social studies, show a real observation/case → principle. Include expected answers.
${isDouble ? "4. SECOND WORKED EXAMPLE block (type \"example\"): A variation or harder example building on the first." : ""}
5. MISCONCEPTION BLOCK (type "explanation" or "check"): Name 1–2 common errors or misconceptions. Give supportive, specific correction language. Never shame learners.
6. GUIDED PRACTICE block (type "activity"): A structured practice task learners attempt with teacher support. Include 2–3 questions or tasks with expected answers in teacher notes (use <strong> tags for expected answers within the block).
7. INDEPENDENT or GROUP ACTIVITY block (type "activity"): A short activity learners complete on their own or in groups.
8. TEACHER NOTE block (type "teacher_note"): A concise revision-ready summary of the key points from this session — what a learner needs to know, not just headings. Written for learner revision.
9. DID YOU KNOW block (type "did_you_know"): One interesting, curiosity-provoking fact rooted in the topic. Use a real-world connection or surprising application.
10. FORMATIVE CHECK block(s) (type "check"): 2–3 specific questions to check understanding during the session. Include expected correct answers.
11. EXIT TICKET block (type "exit_ticket"): One focused task/question that reveals whether learners met the learning target. State what a correct response looks like.

Additional rules:
- Explanation and example blocks must be detailed enough for absent learners to revise from. Avoid thin headings-only content.
- For Mathematics: concrete → abstract sequence, full step-by-step worked solutions, simple numbers first then harder, common error callout, practice questions with answers.
- For science/social studies/literacy: concept explanation with vocabulary support, Ghana-appropriate examples, guided application, formative check.
- Use Ghana-appropriate classroom and community examples where helpful.
- Use clear, encouraging, age- and grade-appropriate language.
- Do not invent curriculum codes or assessment marks.
- Do not use abusive, demeaning, frightening, or discouraging language.
- Do not shame learners for wrong answers.`,
      userPrompt: `Draft deep, classroom-ready lesson content blocks for this session.

Session title: ${parsed.data.session.title}
Duration: ${parsed.data.session.durationMinutes} minutes
Period type: ${isDouble ? `double period (${parsed.data.session.periodCount || 2} consecutive periods)` : "single period"}
Schedule: ${parsed.data.session.scheduledDate || "not specified"} ${parsed.data.session.startTime || ""}–${parsed.data.session.endTime || ""}
Teaching focus: ${parsed.data.session.focusSummary || "Cover the allocated note sections thoroughly."}
Note sections allocated: ${parsed.data.session.noteSectionKeys.join(", ") || "general weekly note"}

Teaching context:
${JSON.stringify(teachingMetadata)}

Note slice + scheme items:
${sliceJson}`,
      maxTokens: isDouble ? 11000 : 8000,
    });

    if (!result.ok) {
      return Response.json({ success: false, error: result.error }, { status: 502 });
    }

    const data = result.data as { contentBlocks?: unknown[] };
    const contentBlocks = normalizeContentBlocks(
      (data.contentBlocks ?? []).map((b) => ({
        ...(typeof b === "object" && b ? b : {}),
        aiGenerated: true,
        teacherReviewed: false,
      })),
    );

    if (contentBlocks.length === 0) {
      return Response.json(
        { success: false, error: "Leo did not return usable content blocks." },
        { status: 502 },
      );
    }

    const blockTypes = new Set(contentBlocks.map((block) => block.type));
    const totalPlainTextLength = contentBlocks.reduce(
      (sum, block) => sum + plainTextLength(block.bodyHtml),
      0,
    );
    const hasTeachingShape =
      blockTypes.has("explanation") &&
      blockTypes.has("example") &&
      blockTypes.has("activity") &&
      blockTypes.has("check");
    if (!hasTeachingShape) {
      return Response.json(
        {
          success: false,
          error:
            "Leo did not return a complete teachable lesson. Try generating again.",
        },
        { status: 502 },
      );
    }

    if (contentBlocks.length < 6 || totalPlainTextLength < minChars) {
      return Response.json(
        {
          success: false,
          error:
            "Leo returned too little lesson content to use. Try generating again.",
        },
        { status: 502 },
      );
    }

    if (hasUnsafeLanguage(contentBlocks)) {
      return Response.json(
        {
          success: false,
          error:
            "Leo returned wording that does not meet the safe classroom language standard. Try generating again.",
        },
        { status: 502 },
      );
    }

    return Response.json({
      success: true,
      isDraft: true,
      disclaimer: LESSONS_LEO_DISCLAIMER,
      data: { contentBlocks },
      usage: result.usage,
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[leo/lessons/generate-session-content]", e);
    const message = e instanceof Error ? e.message : "Leo request failed";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
