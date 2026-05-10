import { z } from "zod";
import { EXAM_QUESTION_TYPES } from "@/constants/examinations";
import {
  EXAMS_LEO_DISCLAIMER,
  requireExamsLeoContext,
  runExamsLeoJson,
} from "@/lib/leo/examinations-draft-shared";

const BodySchema = z.object({
  type: z.enum(EXAM_QUESTION_TYPES),
  prompt: z.string().trim().min(1).max(30000),
  marks: z.number().min(0).default(1),
  options: z
    .array(z.object({ label: z.string(), text: z.string(), isCorrect: z.boolean().optional() }))
    .default([]),
  subQuestions: z
    .array(z.object({ label: z.string(), prompt: z.string(), marks: z.number().min(0) }))
    .default([]),
});

export async function POST(req: Request) {
  try {
    const ctx = await requireExamsLeoContext();
    if (ctx instanceof Response) return ctx;
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ success: false, error: "Validation failed" }, { status: 400 });
    }
    const result = await runExamsLeoJson({
      context: ctx,
      systemInstruction: `Return JSON only:
{
  "expectedAnswer": string,
  "markingGuide": string,
  "rubric": [{"criterion": string, "marks": number, "notes": string}],
  "teacherNotes": string[]
}
This is internal teacher material and must not appear on the student question paper PDF.`,
      userPrompt: `Generate an internal marking guide for this question:\n${JSON.stringify(parsed.data)}`,
      maxTokens: 2200,
    });
    if (!result.ok) return Response.json({ success: false, error: result.error }, { status: 502 });
    return Response.json({ success: true, isDraft: true, disclaimer: EXAMS_LEO_DISCLAIMER, data: result.data, usage: result.usage });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Leo request failed" }, { status: 500 });
  }
}
