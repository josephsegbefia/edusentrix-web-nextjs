import { z } from "zod";
import { requireLessonsLeoTeacherContext } from "@/lib/leo/lessons-draft-shared";
import { enqueueLessonIllustration } from "@/lib/lessons/enqueue-lesson-illustration";

const BodySchema = z
  .object({
    prompt: z.string().trim().max(1200).optional(),
    fact: z.string().trim().max(500).optional(),
    detail: z.string().trim().max(2000).optional(),
    sessionTitle: z.string().trim().max(220).optional(),
    regenerate: z.boolean().optional(),
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

    const result = await enqueueLessonIllustration({
      context: ctx,
      prompt: parsed.data.prompt,
      fact: parsed.data.fact,
      detail: parsed.data.detail,
      sessionTitle: parsed.data.sessionTitle,
      regenerate: parsed.data.regenerate,
    });

    return Response.json(
      {
        success: true,
        accepted: true,
        data: result,
      },
      { status: 202 }
    );
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[leo/lessons/generate-illustration-draft]", error);
    return Response.json({ success: false, error: "Illustration draft failed." }, { status: 500 });
  }
}
