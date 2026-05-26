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
import { SchemeItem } from "@/models/SchemeItem";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { Subject } from "@/models/Subject";
import { SubjectOffering } from "@/models/SubjectOffering";

const MAX_SCHEME_CONTEXT_CHARS = 4_000;

export const LESSONS_LEO_DISCLAIMER =
  "Leo output is a draft for teacher review only. Nothing is published to students automatically.";

const MAX_CONTEXT_CHARS = 14_000;

const LEO_LESSONS_BASE_SYSTEM = `You are Leo, an assistant for Ghanaian teachers using EduSentrix.
You produce **draft** learning materials from structured lesson note data. Rules:
- Output is for teacher review only; never imply the content is live for students.
- Stay grounded in the provided lesson JSON. Do not invent syllabus facts.
- Use clear, age-appropriate language suitable for Ghanaian schools (Primary, JHS, etc. as implied by the note).
- Use safe classroom language only: no abusive, offensive, profane, demeaning, discriminatory, frightening, or discouraging wording.
- When correcting mistakes, be supportive and specific. Never shame learners.
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
 * Fetch scheme items linked to a note and return a compact context string for AI prompts.
 * Returns an empty string when no scheme link exists or items are not found.
 */
export async function buildSchemeItemsContext(note: ILessonNote): Promise<string> {
  const itemIds = note.schemeItemIds;
  if (!itemIds || itemIds.length === 0) return "";
  const items = await SchemeItem.find({
    _id: { $in: itemIds },
    schoolId: note.schoolId,
  })
    .select(
      "topic subtopic strand subStrand contentStandard indicator learningObjectives assessmentIdeas teachingLearningActivities teachingResources notes",
    )
    .lean<
      Array<{
        topic?: string | null;
        subtopic?: string | null;
        strand?: string | null;
        subStrand?: string | null;
        contentStandard?: string | null;
        indicator?: string | null;
        learningObjectives?: string[];
        assessmentIdeas?: string[];
        teachingLearningActivities?: string | null;
        teachingResources?: string[];
        notes?: string | null;
      }>
    >();
  if (items.length === 0) return "";
  const text = items
    .map((item, i) => {
      const lines = [
        `Scheme item ${i + 1}:`,
        item.strand && `  Strand: ${item.strand}`,
        item.subStrand && `  Sub-strand: ${item.subStrand}`,
        item.topic && `  Topic: ${item.topic}`,
        item.subtopic && `  Subtopic: ${item.subtopic}`,
        item.contentStandard && `  Content standard: ${item.contentStandard}`,
        item.indicator && `  Indicator: ${item.indicator}`,
        item.learningObjectives?.length &&
          `  Objectives: ${item.learningObjectives.join("; ")}`,
        item.teachingLearningActivities &&
          `  Teaching & learning activities: ${item.teachingLearningActivities}`,
        item.teachingResources?.length &&
          `  Teaching resources: ${item.teachingResources.join(", ")}`,
        item.assessmentIdeas?.length &&
          `  Assessment ideas: ${item.assessmentIdeas.join("; ")}`,
        item.notes && `  Notes: ${item.notes}`,
      ]
        .filter(Boolean)
        .join("\n");
      return lines;
    })
    .join("\n\n");
  let out = `Linked scheme of learning items:\n${text}`;
  if (out.length > MAX_SCHEME_CONTEXT_CHARS) {
    out = out.slice(0, MAX_SCHEME_CONTEXT_CHARS) + "\n...(truncated)";
  }
  return out;
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

export async function lessonNoteTeachingMetadata(note: ILessonNote): Promise<Record<string, unknown>> {
  const [classGroup, subject, subjectOffering] = await Promise.all([
    note.classGroupId
      ? ClassGroup.findById(note.classGroupId).select("_id name gradeId").lean<{
          _id: mongoose.Types.ObjectId;
          name?: string | null;
          gradeId?: mongoose.Types.ObjectId | null;
        } | null>()
      : null,
    note.subjectId
      ? Subject.findById(note.subjectId).select("_id name code").lean<{
          _id: mongoose.Types.ObjectId;
          name?: string | null;
          code?: string | null;
        } | null>()
      : null,
    note.subjectOfferingId
      ? SubjectOffering.findById(note.subjectOfferingId).select("_id displayName shortName code gradeBand").lean<{
          _id: mongoose.Types.ObjectId;
          displayName?: string | null;
          shortName?: string | null;
          code?: string | null;
          gradeBand?: string | null;
        } | null>()
      : null,
  ]);

  const grade = classGroup?.gradeId
    ? await Grade.findById(classGroup.gradeId).select("_id name stage").lean<{
        _id: mongoose.Types.ObjectId;
        name?: string | null;
        stage?: string | null;
      } | null>()
    : null;

  return {
    gradeName: grade?.name ?? null,
    gradeBand: grade?.stage ?? subjectOffering?.gradeBand ?? null,
    classGroupName: classGroup?.name ?? null,
    subjectName:
      subjectOffering?.shortName ||
      subjectOffering?.displayName ||
      subject?.name ||
      note.subjectNameSnapshot ||
      null,
    subjectOfferingName: subjectOffering?.displayName ?? null,
    subjectCode: subjectOffering?.code || subject?.code || note.subjectOfferingCodeSnapshot || null,
  };
}

export async function runLessonsLeoCompletion(args: {
  context: Awaited<ReturnType<typeof requireTeacher>>;
  systemInstruction: string;
  userPrompt: string;
  maxTokens?: number;
  /** Override model. Defaults to "gpt-4o-mini". Use "gpt-4o" for deep content generation. */
  model?: "gpt-4o-mini" | "gpt-4o";
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
      model: args.model ?? "gpt-4o-mini",
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
