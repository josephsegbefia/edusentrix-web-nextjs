import { z } from "zod";
import {
  findLessonNoteForTeacher,
  lessonNoteToLeoContext,
  LESSONS_LEO_DISCLAIMER,
  requireLessonsLeoTeacherContext,
  runLessonsLeoCompletion,
} from "@/lib/leo/lessons-draft-shared";

const BodySchema = z.object({
  lessonNoteId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const ctx = await requireLessonsLeoTeacherContext();
    if (ctx instanceof Response) return ctx;

    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg =
        parsed.error.issues?.map((i) => i.message).join(", ") || "Invalid body";
      return Response.json({ success: false, error: msg }, { status: 400 });
    }

    const note = await findLessonNoteForTeacher(
      parsed.data.lessonNoteId,
      ctx.schoolId,
      ctx.teacherId
    );
    if (!note) {
      return Response.json({ success: false, error: "Lesson note not found" }, { status: 404 });
    }

    const payload = lessonNoteToLeoContext(note);
    const result = await runLessonsLeoCompletion({
      context: ctx,
      systemInstruction: `Return JSON only:
{
  "strengths": string[] (2-5 items — what looks strong),
  "gaps": string[] (2-6 items — missing clarity, pacing, alignment, assessment, differentiation),
  "suggestions": string[] (3-7 concrete improvements the teacher could make),
  "readinessScore": number (1-5, where 5 = ready to teach; this is advisory only),
  "readinessRationale": string (one short paragraph)
}
Be constructive and specific to the provided JSON.`,
      userPrompt: `Review this lesson note for instructional quality before the teacher shares materials with students.
Lesson note JSON:\n${payload}`,
      maxTokens: 3200,
    });

    if (!result.ok) {
      return Response.json({ success: false, error: result.error }, { status: 502 });
    }

    return Response.json({
      success: true,
      isDraft: true,
      disclaimer: LESSONS_LEO_DISCLAIMER,
      data: result.data,
      usage: result.usage,
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[leo/lessons/check-quality]", e);
    const message = e instanceof Error ? e.message : "Leo request failed";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
