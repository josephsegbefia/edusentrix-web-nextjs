import "server-only";

import OpenAI from "openai";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { enforceSchoolLimit } from "@/lib/auth/checkLimit";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { trackUsage } from "@/lib/billing/trackUsage";
import { parseBuilderId } from "@/lib/examinations/builder-service";
import { ExamPaper } from "@/models/ExamPaper";
import { ExamPaperSection } from "@/models/ExamPaperSection";
import { ExamQuestion } from "@/models/ExamQuestion";
import type { SchoolMemberContext } from "@/lib/auth/requireSchoolMember";

export const EXAMS_LEO_DISCLAIMER =
  "Leo output is a draft for educator review only. It does not publish, approve, print, or lock exam content.";

const BASE_SYSTEM = `You are Leo, an examination assistant inside EduSentrix School OS.
Rules:
- Return valid JSON only, with no markdown fences.
- Output is draft-only and must be reviewed by a teacher or school admin.
- Do not approve, publish, or imply an exam paper is final.
- Keep student-facing exam-paper output question-only unless explicitly asked for internal marking support.
- Be suitable for Ghanaian school contexts where applicable, but stay grounded in provided data.`;

export async function requireExamsLeoContext(): Promise<
  SchoolMemberContext | Response
> {
  const context = await requireSchoolMember({
    allowedRoles: ["school_admin", "teacher", "staff"],
  });
  await connectToDatabase();

  try {
    await enforceSchoolLimit({
      schoolId: context.schoolId,
      limitKey: "maxAICallsPerMonth",
      message: "The monthly AI generation limit has been reached for this school.",
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    throw error;
  }

  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { success: false, error: "AI service not configured" },
      { status: 500 }
    );
  }

  return context;
}

export async function runExamsLeoJson(args: {
  context: SchoolMemberContext;
  systemInstruction: string;
  userPrompt: string;
  maxTokens?: number;
}) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `${BASE_SYSTEM}\n\n${args.systemInstruction}`,
        },
        { role: "user", content: args.userPrompt },
      ],
      temperature: 0.45,
      response_format: { type: "json_object" },
      max_tokens: args.maxTokens ?? 3500,
    });
  } catch (error: unknown) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "OpenAI request failed",
    };
  }

  const responseText = completion.choices[0]?.message?.content;
  if (!responseText) return { ok: false as const, error: "Empty AI response" };

  let data: unknown;
  try {
    data = JSON.parse(responseText);
  } catch {
    return { ok: false as const, error: "Invalid JSON from AI" };
  }

  await trackUsage({
    schoolId: args.context.schoolId,
    provider: "openai",
    metricKey: "ai_calls",
    quantity: 1,
    unitLabel: "calls",
    allocationMethod: "direct",
    sourceType: "manual",
    notes: "Leo examinations draft API.",
  });
  await trackUsage({
    schoolId: args.context.schoolId,
    provider: "openai",
    metricKey: "total_tokens",
    quantity: Math.max(0, Number(completion.usage?.total_tokens || 0)),
    unitLabel: "tokens",
    allocationMethod: "direct",
    sourceType: "manual",
    notes: "Leo examinations draft token usage.",
  });

  return {
    ok: true as const,
    data,
    usage: {
      promptTokens: completion.usage?.prompt_tokens,
      completionTokens: completion.usage?.completion_tokens,
      totalTokens: completion.usage?.total_tokens,
    },
  };
}

export const ExamPaperIdBodySchema = z.object({
  examPaperId: z.string().trim().min(1),
});

export async function examPaperContextForLeo(input: {
  schoolId: SchoolMemberContext["schoolId"];
  examPaperId: string;
}) {
  const paperId = parseBuilderId(input.examPaperId);
  if (!paperId) return null;
  const [paper, sections, questions] = await Promise.all([
    ExamPaper.findOne({ _id: paperId, schoolId: input.schoolId }).lean(),
    ExamPaperSection.find({ examPaperId: paperId, schoolId: input.schoolId })
      .sort({ order: 1 })
      .lean(),
    ExamQuestion.find({ examPaperId: paperId, schoolId: input.schoolId })
      .sort({ sectionId: 1, order: 1 })
      .lean(),
  ]);
  if (!paper) return null;
  return JSON.stringify({
    paper: {
      title: paper.title,
      scope: paper.scope,
      status: paper.status,
      totalMarks: paper.totalMarks,
      durationMinutes: paper.durationMinutes,
      instructions: paper.instructions,
      candidateInstructions: paper.candidateInstructions,
    },
    sections: sections.map((section) => ({
      id: String(section._id),
      title: section.title,
      instructions: section.instructions,
      marks: section.marks,
      order: section.order,
    })),
    questions: questions.map((question) => ({
      id: String(question._id),
      sectionId: question.sectionId ? String(question.sectionId) : null,
      type: question.type,
      prompt: question.prompt,
      marks: question.marks,
      difficulty: question.difficulty,
      topic: question.topic,
      optionCount: question.options?.length ?? 0,
      subQuestionCount: question.subQuestions?.length ?? 0,
    })),
  });
}
