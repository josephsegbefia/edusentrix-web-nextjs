import { z } from "zod";
import { LESSON_CONTENT_BLOCK_TYPES } from "@/types/lesson-content-blocks";
import {
  findLessonNoteForTeacher,
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
  }),
});

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
- Produce 3-7 blocks appropriate for a ${parsed.data.session.durationMinutes}-minute lesson.
- Ground content only in the provided note slice.
- Use Ghana-appropriate examples when helpful.
- Do not invent curriculum codes or assessment marks.`,
      userPrompt: `Draft rich lesson content blocks for this session.

Session title: ${parsed.data.session.title}
Duration: ${parsed.data.session.durationMinutes} minutes
Note sections allocated: ${parsed.data.session.noteSectionKeys.join(", ") || "general weekly note"}

Note slice JSON:
${sliceJson}`,
      maxTokens: 4500,
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
