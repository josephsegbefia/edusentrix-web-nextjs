import { z } from "zod";
import { requireLessonsLeoTeacherContext } from "@/lib/leo/lessons-draft-shared";
import { generateLessonIllustrationDraft } from "@/lib/leo/generate-lesson-illustration";

const BodySchema = z
  .object({
    prompt: z.string().trim().max(1200).optional(),
    fact: z.string().trim().max(500).optional(),
    detail: z.string().trim().max(2000).optional(),
    sessionTitle: z.string().trim().max(220).optional(),
  })
  .superRefine((data, ctx) => {
    const hasFactCard = Boolean(data.fact && data.fact.length >= 12 && data.detail && data.detail.length >= 24);
    const hasPrompt = Boolean(data.prompt && data.prompt.length >= 8);
    if (!hasFactCard && !hasPrompt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide fact+detail or a prompt of at least 8 characters.",
      });
    }
  });

export async function POST(req: Request) {
  try {
    const ctx = await requireLessonsLeoTeacherContext();
    if (ctx instanceof Response) return ctx;

    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json({ success: false, error: "Invalid request body." }, { status: 400 });
    }

    const result = await generateLessonIllustrationDraft({
      schoolId: ctx.schoolId,
      prompt: parsed.data.prompt,
      fact: parsed.data.fact,
      detail: parsed.data.detail,
      sessionTitle: parsed.data.sessionTitle,
    });

    if (!result.ok) {
      return Response.json({ success: false, error: result.error }, { status: 502 });
    }

    return Response.json({
      success: true,
      data: {
        imageUrl: result.imageUrl,
        uploadThingKey: result.uploadThingKey,
        generationPrompt: result.generationPrompt,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[leo/lessons/generate-illustration-draft]", error);
    return Response.json({ success: false, error: "Illustration draft failed." }, { status: 500 });
  }
}
