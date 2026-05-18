import "server-only";

import mongoose from "mongoose";
import OpenAI from "openai";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { EntitlementError, requireEntitlement } from "@/lib/billing/require-entitlement";
import { trackUsage } from "@/lib/billing/trackUsage";
import { PERMISSIONS } from "@/lib/rbac";
import { gateLessonsFeature, gateLessonsModule } from "@/lib/lessons/lesson-gates";
import { Lesson, type ILesson } from "@/models/Lesson";
import { LessonNote, type ILessonNote } from "@/models/LessonNote";

export const LESSONS_LEO_DISCLAIMER =
  "Leo output is a draft for teacher review only. Nothing is published to students automatically.";

const MAX_CONTEXT_CHARS = 14_000;

const LEO_LESSONS_BASE_SYSTEM = `You are Leo, an assistant for Ghanaian teachers using EduSentrix.
You produce **draft** learning materials from structured lesson note data. Rules:
- Output is for teacher review only; never imply the content is live for students.
- Stay grounded in the provided lesson JSON. Do not invent syllabus facts.
- Use clear, age-appropriate language suitable for Ghanaian schools (Primary, JHS, etc. as implied by the note).
- Respond with valid JSON only — no markdown code fences.
- The input intentionally excludes post-lesson teacher reflections unless present elsewhere in the payload.`;

function toObjectId(id: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function requireLessonsLeoTeacherContext(): Promise<
  Awaited<ReturnType<typeof requireTeacher>> | Response
> {
  const context = await requireTeacher();
  await connectToDatabase();

  const moduleGate = await gateLessonsModule(context.schoolId);
  if (!moduleGate.ok) {
    return Response.json({ success: false, error: moduleGate.error }, { status: moduleGate.status });
  }
  const leoFeature = gateLessonsFeature(
    moduleGate.settings,
    "enableLeoLessonTools",
    "Leo lesson tools",
  );
  if (!leoFeature.ok) {
    return Response.json({ success: false, error: leoFeature.error }, { status: leoFeature.status });
  }

  try {
    await requireEntitlement({
      schoolId: context.schoolId,
      featureKey: "ai_lesson_notes",
      limitKey: "maxAICallsPerMonth",
      expensive: true,
    });
  } catch (e: unknown) {
    if (e instanceof EntitlementError) {
      return Response.json(
        { success: false, error: e.message, code: e.code },
        { status: e.statusCode }
      );
    }
    throw e;
  }

  if (!can(context.permissions, PERMISSIONS.lessonAiUse)) {
    return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { success: false, error: "AI service not configured" },
      { status: 500 }
    );
  }
  return context;
}

export async function findLessonNoteForTeacher(
  lessonNoteId: string,
  schoolId: mongoose.Types.ObjectId,
  teacherId: mongoose.Types.ObjectId
): Promise<ILessonNote | null> {
  const oid = toObjectId(lessonNoteId);
  if (!oid) return null;
  return (await LessonNote.findOne({
    _id: oid,
    schoolId,
    teacherId,
  }).lean()) as ILessonNote | null;
}

export async function findLessonWithNoteForTeacher(
  lessonId: string,
  schoolId: mongoose.Types.ObjectId,
  teacherId: mongoose.Types.ObjectId
): Promise<{ lesson: ILesson; note: ILessonNote } | null> {
  const lid = toObjectId(lessonId);
  if (!lid) return null;
  const lesson = (await Lesson.findOne({
    _id: lid,
    schoolId,
    teacherId,
  }).lean()) as ILesson | null;
  if (!lesson) return null;
  const note = await findLessonNoteForTeacher(
    String(lesson.lessonNoteId),
    schoolId,
    teacherId
  );
  if (!note) return null;
  return { lesson, note };
}

/**
 * Serialize note fields safe for model input (reflection omitted — often post-lesson / private).
 */
export function lessonNoteToLeoContext(note: ILessonNote): string {
  const safe = {
    templateType: note.templateType,
    curriculumCode: note.curriculumCode,
    topic: note.topic,
    durationMinutes: note.durationMinutes,
    references: note.references,
    curriculum: note.curriculum,
    tlms: note.tlms,
    body: note.body,
    assessment: note.assessment,
    resources: note.resources,
    tags: note.tags,
    legacyObjectives: note.objectives,
    legacyContent: note.content,
  };
  let s = JSON.stringify(safe);
  if (s.length > MAX_CONTEXT_CHARS) {
    s = `${s.slice(0, MAX_CONTEXT_CHARS)}\n...(truncated)`;
  }
  return s;
}

export async function runLessonsLeoCompletion(args: {
  context: Awaited<ReturnType<typeof requireTeacher>>;
  systemInstruction: string;
  userPrompt: string;
  maxTokens?: number;
}): Promise<
  | {
      ok: true;
      data: unknown;
      usage: {
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
      };
    }
  | { ok: false; error: string }
> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `${LEO_LESSONS_BASE_SYSTEM}\n\n${args.systemInstruction}`,
        },
        { role: "user", content: args.userPrompt },
      ],
      temperature: 0.65,
      response_format: { type: "json_object" },
      max_tokens: args.maxTokens ?? 3500,
    });
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "OpenAI request failed",
    };
  }

  const responseText = completion.choices[0]?.message?.content;
  if (!responseText) {
    return { ok: false, error: "Empty AI response" };
  }

  let data: unknown;
  try {
    data = JSON.parse(responseText);
  } catch {
    const m = responseText.match(/\{[\s\S]*\}/);
    if (!m) {
      return { ok: false, error: "Invalid JSON from AI" };
    }
    try {
      data = JSON.parse(m[0]);
    } catch {
      return { ok: false, error: "Invalid JSON from AI" };
    }
  }

  await trackUsage({
    schoolId: args.context.schoolId,
    provider: "openai",
    metricKey: "ai_calls",
    quantity: 1,
    unitLabel: "calls",
    allocationMethod: "direct",
    sourceType: "manual",
    notes: "Leo lessons draft API.",
  });
  await trackUsage({
    schoolId: args.context.schoolId,
    provider: "openai",
    metricKey: "total_tokens",
    quantity: Math.max(0, Number(completion.usage?.total_tokens || 0)),
    unitLabel: "tokens",
    allocationMethod: "direct",
    sourceType: "manual",
    notes: "Leo lessons draft token usage.",
  });

  return {
    ok: true,
    data,
    usage: {
      promptTokens: completion.usage?.prompt_tokens,
      completionTokens: completion.usage?.completion_tokens,
      totalTokens: completion.usage?.total_tokens,
    },
  };
}
