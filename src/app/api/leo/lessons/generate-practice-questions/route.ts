import { z } from "zod";
import {
  findLessonWithNoteForTeacher,
  lessonNoteToLeoContext,
  LESSONS_LEO_DISCLAIMER,
  requireLessonsLeoTeacherContext,
  runLessonsLeoCompletion,
} from "@/lib/leo/lessons-draft-shared";

const BodySchema = z.object({
  lessonId: z.string().min(1),
  questionCount: z.number().int().min(3).max(20).optional(),
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

    const pair = await findLessonWithNoteForTeacher(
      parsed.data.lessonId,
      ctx.schoolId,
      ctx.teacherId
    );
    if (!pair) {
      return Response.json({ success: false, error: "Lesson not found" }, { status: 404 });
    }

    const n = parsed.data.questionCount ?? 8;
    const payload = lessonNoteToLeoContext(pair.note);
    const lessonMeta = JSON.stringify({
      lessonTitle: pair.lesson.title,
      lessonStatus: pair.lesson.status,
      scheduledAt: pair.lesson.scheduledAt,
    });

    const result = await runLessonsLeoCompletion({
      context: ctx,
      systemInstruction: `Return JSON only:
{
  "questions": [
    {
      "question": string,
      "type": "multiple-choice" | "short-answer" | "true-false" | "fill-in-blank",
      "options": string[] | null (for multiple-choice only, 3-5 items),
      "answer": string,
      "difficulty": "easy" | "medium" | "hard"
    }
  ]
}
Exactly ${n} items. Answers must be suitable for teacher answer keys.`,
      userPrompt: `Draft practice / quiz questions for this class lesson instance.
Lesson metadata: ${lessonMeta}
Lesson note JSON:\n${payload}`,
      maxTokens: 4000,
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
    console.error("[leo/lessons/generate-practice-questions]", e);
    const message = e instanceof Error ? e.message : "Leo request failed";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
