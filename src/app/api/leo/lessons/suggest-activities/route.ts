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

    const payload = lessonNoteToLeoContext(pair.note);
    const lessonMeta = JSON.stringify({
      lessonTitle: pair.lesson.title,
      lessonStatus: pair.lesson.status,
    });

    const result = await runLessonsLeoCompletion({
      context: ctx,
      systemInstruction: `Return JSON only:
{
  "activities": [
    {
      "title": string,
      "description": string,
      "durationMinutes": number,
      "grouping": "whole-class" | "pairs" | "small-groups" | "individual",
      "materials": string[],
      "teacherMoves": string (what teacher does),
      "studentMoves": string (what students do)
    }
  ]
}
Provide 4-7 practical classroom activities grounded in the note.`,
      userPrompt: `Suggest teaching activities for this lesson.
Lesson metadata: ${lessonMeta}
Lesson note JSON:\n${payload}`,
      maxTokens: 3500,
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
    console.error("[leo/lessons/suggest-activities]", e);
    const message = e instanceof Error ? e.message : "Leo request failed";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
