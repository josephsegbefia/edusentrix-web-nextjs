import { z } from "zod";
import { EXAM_QUESTION_TYPES } from "@/constants/examinations";
import {
  EXAMS_LEO_DISCLAIMER,
  requireExamsLeoContext,
  runExamsLeoJson,
} from "@/lib/leo/examinations-draft-shared";

const BodySchema = z.object({
  subject: z.string().trim().min(1),
  grade: z.string().trim().min(1),
  examType: z.string().trim().min(1),
  topics: z.array(z.string().trim().min(1)).default([]),
  difficulty: z.enum(["easy", "medium", "hard", "mixed"]).default("mixed"),
  questionPlan: z
    .array(
      z.object({
        type: z.enum(EXAM_QUESTION_TYPES),
        count: z.number().int().min(1).max(25),
        marksPerQuestion: z.number().min(0.5).max(30).optional(),
        numberOfChoices: z.number().int().min(2).max(6).optional(),
      })
    )
    .min(1),
  sourceSummary: z.string().trim().max(12000).optional(),
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
  "questions": [
    {
      "type": string,
      "prompt": string,
      "options": [{"label": string, "text": string, "isCorrect": boolean}] | [],
      "subQuestions": [{"label": string, "prompt": string, "marks": number, "expectedAnswer": string, "markingGuide": string}] | [],
      "marks": number,
      "difficulty": "easy" | "medium" | "hard" | "mixed",
      "topic": string,
      "expectedAnswer": string,
      "markingGuide": string,
      "explanation": string
    }
  ],
  "teacherNotes": string[]
}
Questions are draft only. Include answer/marking fields for internal teacher review, not for student PDF printing.`,
      userPrompt: `Generate draft exam questions from this plan:\n${JSON.stringify(parsed.data)}`,
      maxTokens: 6000,
    });
    if (!result.ok) return Response.json({ success: false, error: result.error }, { status: 502 });
    return Response.json({ success: true, isDraft: true, disclaimer: EXAMS_LEO_DISCLAIMER, data: result.data, usage: result.usage });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Leo request failed" }, { status: 500 });
  }
}
