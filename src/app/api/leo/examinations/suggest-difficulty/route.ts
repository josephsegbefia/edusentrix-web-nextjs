import { z } from "zod";
import {
  EXAMS_LEO_DISCLAIMER,
  requireExamsLeoContext,
  runExamsLeoJson,
} from "@/lib/leo/examinations-draft-shared";

const BodySchema = z.object({
  prompt: z.string().trim().min(1).max(30000),
  grade: z.string().trim().min(1).optional(),
  subject: z.string().trim().min(1).optional(),
  marks: z.number().min(0).optional(),
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
  "difficulty": "easy" | "medium" | "hard" | "mixed",
  "confidence": number,
  "reason": string,
  "improvements": string[]
}`,
      userPrompt: `Estimate question difficulty:\n${JSON.stringify(parsed.data)}`,
      maxTokens: 1200,
    });
    if (!result.ok) return Response.json({ success: false, error: result.error }, { status: 502 });
    return Response.json({ success: true, isDraft: true, disclaimer: EXAMS_LEO_DISCLAIMER, data: result.data, usage: result.usage });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Leo request failed" }, { status: 500 });
  }
}
