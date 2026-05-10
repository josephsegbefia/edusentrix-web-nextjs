import { z } from "zod";
import {
  EXAMS_LEO_DISCLAIMER,
  requireExamsLeoContext,
  runExamsLeoJson,
} from "@/lib/leo/examinations-draft-shared";

const BodySchema = z.object({
  examType: z.string().trim().min(1),
  subject: z.string().trim().min(1),
  grade: z.string().trim().min(1),
  durationMinutes: z.number().int().min(10).max(360).optional(),
  totalMarks: z.number().min(1).max(300).optional(),
  topics: z.array(z.string().trim().min(1)).default([]),
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
  "sections": [{"title": string, "purpose": string, "questionTypes": string[], "suggestedMarks": number, "suggestedQuestionCount": number}],
  "coverageNotes": string[],
  "teacherWarnings": string[]
}`,
      userPrompt: `Draft an exam blueprint. Input:\n${JSON.stringify(parsed.data)}`,
      maxTokens: 2400,
    });
    if (!result.ok) return Response.json({ success: false, error: result.error }, { status: 502 });
    return Response.json({ success: true, isDraft: true, disclaimer: EXAMS_LEO_DISCLAIMER, data: result.data, usage: result.usage });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Leo request failed" }, { status: 500 });
  }
}
