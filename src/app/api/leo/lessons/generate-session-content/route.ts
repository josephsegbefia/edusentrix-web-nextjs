import { z } from "zod";
import { LESSON_CONTENT_BLOCK_TYPES } from "@/types/lesson-content-blocks";
import {
  findLessonNoteForTeacher,
  lessonNoteTeachingMetadata,
  LESSONS_LEO_DISCLAIMER,
  requireLessonsLeoTeacherContext,
  runLessonsLeoCompletion,
} from "@/lib/leo/lessons-draft-shared";
import { sliceNoteContextForSections } from "@/lib/lessons/note-sections";
import { normalizeContentBlocks } from "@/lib/lessons/content-blocks";

const BodySchema = z.object({
  lessonNoteId: z.string().min(1),
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

    const slice = sliceNoteContextForSections(note, parsed.data.session.noteSectionKeys);
    const teachingMetadata = await lessonNoteTeachingMetadata(note);
    const sliceJson = JSON.stringify(slice);

    const result = await runLessonsLeoCompletion({
      context: ctx,
      systemInstruction: `Return JSON only:
{
  "contentBlocks": [
    {
      "type": one of ${JSON.stringify(LESSON_CONTENT_BLOCK_TYPES)},
      "title": string (optional short heading),
      "bodyHtml": string (HTML using <p>, <ul>, <li>, <strong>, <em> only; English only),
      "order": number (0-based),
      "estimatedMinutes": number (optional),
      "aiGenerated": true,
      "teacherReviewed": false,
      "resourceUrl": string | null (only for resource_embed)
    }
  ]
}
Rules:
- Produce 8-12 substantial blocks appropriate for a ${parsed.data.session.durationMinutes}-minute ${parsed.data.session.isDoublePeriod ? "double-period" : "single-period"} lesson.
- The output must teach the topic in depth, not merely restate the lesson note.
- Build a coherent teaching sequence:
  1. activate prior knowledge and state the learning target in learner-friendly language;
  2. explain the core concept clearly, including why it works or why it matters;
  3. model at least one full worked example with step-by-step reasoning;
  4. add a second example or variation when the session is longer than 35 minutes;
  5. name common misconceptions and show supportive corrections;
  6. give guided practice with expected answers or solution notes;
  7. include an independent or group activity;
  8. include checks for understanding and an exit ticket.
- Include teachable notes learners can revise from. These notes should define key ideas, explain important steps, and connect examples back to the topic.
- Explanation and example blocks should be detailed enough for absent learners to revise from later. Use short paragraphs and lists, but do not reduce the lesson to headings.
- For Mathematics, include concrete-to-abstract explanation, step-by-step worked solutions, simple number choices before harder ones, common errors, practice questions, and answers where useful.
- For literacy, science, social studies, or other subjects, include concept explanation, vocabulary support, examples from familiar Ghanaian classroom/community contexts, guided application, and a short formative check.
- Ground concepts and objectives in the provided note slice, but you may create safe classroom examples that directly teach the stated topic.
- Use Ghana-appropriate examples when helpful.
- Use clear, encouraging, age- and grade-appropriate language.
- Prefer precise explanations over vague encouragement. Avoid filler.
- Do not use abusive, offensive, profane, demeaning, frightening, discriminatory, or discouraging language.
- Do not shame learners for wrong answers. Give supportive correction language.
- Do not invent curriculum codes or assessment marks.`,
      userPrompt: `Draft rich lesson content blocks for this session.

Session title: ${parsed.data.session.title}
Duration: ${parsed.data.session.durationMinutes} minutes
Period type: ${parsed.data.session.isDoublePeriod ? `double period (${parsed.data.session.periodCount || 2} consecutive periods)` : "single period"}
Schedule: ${parsed.data.session.scheduledDate || "not specified"} ${parsed.data.session.startTime || ""}-${parsed.data.session.endTime || ""}
Teaching focus: ${parsed.data.session.focusSummary || "Use the allocated note sections to teach this session well."}
Note sections allocated: ${parsed.data.session.noteSectionKeys.join(", ") || "general weekly note"}

Teaching context:
${JSON.stringify(teachingMetadata)}

Note slice JSON:
${sliceJson}`,
      maxTokens: parsed.data.session.isDoublePeriod ? 6500 : 5500,
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

    const minimumUsableChars = parsed.data.session.isDoublePeriod ? 1_200 : 800;
    if (contentBlocks.length < 4 || totalPlainTextLength < minimumUsableChars) {
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
