import {
  EXAMS_LEO_DISCLAIMER,
  ExamPaperIdBodySchema,
  examPaperContextForLeo,
  requireExamsLeoContext,
  runExamsLeoJson,
} from "@/lib/leo/examinations-draft-shared";

export async function POST(req: Request) {
  try {
    const ctx = await requireExamsLeoContext();
    if (ctx instanceof Response) return ctx;
    const parsed = ExamPaperIdBodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ success: false, error: "Validation failed" }, { status: 400 });
    }
    const paperContext = await examPaperContextForLeo({
      schoolId: ctx.schoolId,
      examPaperId: parsed.data.examPaperId,
    });
    if (!paperContext) return Response.json({ success: false, error: "Exam paper not found" }, { status: 404 });
    const result = await runExamsLeoJson({
      context: ctx,
      systemInstruction: `Return JSON only:
{
  "readinessScore": number,
  "strengths": string[],
  "risks": string[],
  "improvements": string[],
  "printReadiness": {"questionOnlyPaperOk": boolean, "reason": string}
}`,
      userPrompt: `Review this draft exam paper for balance, clarity, marks, and print readiness. Do not ask for answer spaces on the student PDF.\n${paperContext}`,
      maxTokens: 2800,
    });
    if (!result.ok) return Response.json({ success: false, error: result.error }, { status: 502 });
    return Response.json({ success: true, isDraft: true, disclaimer: EXAMS_LEO_DISCLAIMER, data: result.data, usage: result.usage });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Leo request failed" }, { status: 500 });
  }
}
