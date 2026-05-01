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
      const msg = parsed.error.issues?.map((i) => i.message).join(", ") || "Invalid body";
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
  "tiers": [
    {
      "tier": "support" | "core" | "extension",
      "learnerProfile": string,
      "adjustments": string[] (3-8 practical instruction adaptations),
      "tasks": string[] (2-6 classwork tasks),
      "checksForUnderstanding": string[] (2-5 quick checks),
      "homework": string | null
    }
  ],
  "groupingStrategy": string,
  "teacherNotes": string[] (2-6 implementation notes)
}`,
      userPrompt: `Create differentiated learning materials from this lesson note for mixed-ability learners in one class.
Include practical supports for struggling learners, core pathway for most learners, and extension challenge for advanced learners.
Lesson note JSON:\n${payload}`,
      maxTokens: 3600,
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
    console.error("[leo/lessons/generate-differentiated-materials]", e);
    const message = e instanceof Error ? e.message : "Leo request failed";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
