import "server-only";

import mongoose from "mongoose";
import {
  findLessonNoteForTeacher,
  lessonNoteTeachingMetadata,
  runLessonsLeoCompletion,
} from "@/lib/leo/lessons-draft-shared";
import { connectToDatabase } from "@/db/connectToDatabase";
import { LessonSession } from "@/models/LessonSession";
import type { ILessonNote } from "@/models/LessonNote";
import {
  buildSessionGenerationNoteSlice,
  enrichSliceWithSchemeItems,
} from "@/lib/lessons/note-sections";
import { normalizeContentBlocks } from "@/lib/lessons/content-blocks";
import { buildSubjectAwareGenerationRules } from "@/lib/lessons/ai-content-plan";
import { resolveLessonSubjectMode } from "@/lib/lessons/subject-mode-resolver";
import {
  summarizeContentBlocksForHandoff,
  type PriorSessionHandoff,
} from "@/lib/lessons/session-content-handoff";
import type { LessonContentBlock } from "@/types/lesson-content-blocks";
import type { TeacherContext } from "@/lib/auth/requireTeacher";
import type { LessonAiSlotSnapshot } from "@/models/LessonAiGenerationRequest";

const UNSAFE_LANGUAGE_PATTERN =
  /\b(stupid|idiot|dumb|useless|worthless|shut up|fool|foolish|lazy learners?|hopeless|nonsense)\b/i;

export function hasUnsafeLanguage(blocks: Array<{ bodyHtml?: unknown; title?: unknown }>) {
  return blocks.some((block) =>
    UNSAFE_LANGUAGE_PATTERN.test(`${String(block.title || "")} ${String(block.bodyHtml || "")}`)
  );
}

export function plainTextLength(value: unknown) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}

export type GenerateSessionContentSlotInput = LessonAiSlotSnapshot & {
  sessionId?: string;
};

export type GenerateSessionContentSuccess = {
  ok: true;
  contentBlocks: LessonContentBlock[];
  usage: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
};

export type GenerateSessionContentFailure = {
  ok: false;
  error: string;
  permanent: boolean;
};

export async function resolveSessionGenerationContext(input: {
  schoolId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  lessonNoteId: string;
  sessionId?: string | null;
  slot: LessonAiSlotSnapshot;
}): Promise<
  | {
      ok: true;
      note: ILessonNote;
      schemeItemIds: mongoose.Types.ObjectId[];
      sequenceInWeek: number;
      previousSession?: PriorSessionHandoff;
      priorSessions: PriorSessionHandoff[];
    }
  | { ok: false; error: string }
> {
  await connectToDatabase();
  const note = await findLessonNoteForTeacher(
    input.lessonNoteId,
    input.schoolId,
    input.teacherId
  );
  if (!note) {
    return { ok: false, error: "Lesson note not found" };
  }

  let schemeItemIds: mongoose.Types.ObjectId[] = [];
  let sequenceInWeek = input.slot.sequenceInWeek ?? 1;
  let previousSession: PriorSessionHandoff | undefined = input.slot.previousSession;
  let priorSessions = input.slot.priorSessions ?? [];

  if (input.sessionId && mongoose.Types.ObjectId.isValid(input.sessionId)) {
    const existingSession = await LessonSession.findOne({
      _id: new mongoose.Types.ObjectId(input.sessionId),
      schoolId: input.schoolId,
    })
      .select("noteSectionAllocation.schemeItemIds weekPlanId sequenceInWeek title contentBlocks")
      .lean<{
        noteSectionAllocation?: { schemeItemIds?: mongoose.Types.ObjectId[] };
        weekPlanId?: mongoose.Types.ObjectId;
        sequenceInWeek?: number;
      } | null>();

    if (existingSession) {
      schemeItemIds = existingSession.noteSectionAllocation?.schemeItemIds ?? [];
      if (existingSession.sequenceInWeek) {
        sequenceInWeek = existingSession.sequenceInWeek;
      }

      if (!previousSession && existingSession.sequenceInWeek && existingSession.sequenceInWeek > 1) {
        const prev = await LessonSession.findOne({
          schoolId: input.schoolId,
          weekPlanId: existingSession.weekPlanId,
          sequenceInWeek: existingSession.sequenceInWeek - 1,
        })
          .select("title contentBlocks")
          .lean<{
            title?: string;
            contentBlocks?: LessonContentBlock[];
          } | null>();

        if (prev) {
          previousSession = {
            title: prev.title || "Previous session",
            keyPointsSummary: summarizeContentBlocksForHandoff(prev.contentBlocks ?? []),
          };
        }
      }
    }
  }

  return {
    ok: true,
    note,
    schemeItemIds,
    sequenceInWeek,
    previousSession,
    priorSessions,
  };
}

export function validateGeneratedSessionContent(
  rawBlocks: unknown[],
  slot: Pick<LessonAiSlotSnapshot, "isDoublePeriod">
): GenerateSessionContentSuccess | GenerateSessionContentFailure {
  const contentBlocks = normalizeContentBlocks(
    rawBlocks.map((block) => ({
      ...(typeof block === "object" && block ? block : {}),
      aiGenerated: true,
      teacherReviewed: false,
    }))
  );

  if (contentBlocks.length === 0) {
    return {
      ok: false,
      error: "Leo did not return usable content blocks.",
      permanent: false,
    };
  }

  const isDouble = slot.isDoublePeriod ?? false;
  const minChars = isDouble ? 2500 : 1500;
  const blockTypes = new Set(contentBlocks.map((block) => block.type));
  const totalPlainTextLength = contentBlocks.reduce(
    (sum, block) => sum + plainTextLength(block.bodyHtml),
    0
  );
  const hasTeachingShape =
    (blockTypes.has("explanation") || blockTypes.has("bilingual_text")) &&
    (blockTypes.has("example") ||
      blockTypes.has("worked_example") ||
      blockTypes.has("math_expression")) &&
    blockTypes.has("activity") &&
    blockTypes.has("check");

  if (!hasTeachingShape) {
    return {
      ok: false,
      error: "Leo did not return a complete teachable lesson. Try generating again.",
      permanent: false,
    };
  }

  if (contentBlocks.length < 6 || totalPlainTextLength < minChars) {
    return {
      ok: false,
      error: "Leo returned too little lesson content to use. Try generating again.",
      permanent: false,
    };
  }

  if (hasUnsafeLanguage(contentBlocks)) {
    return {
      ok: false,
      error:
        "Leo returned wording that does not meet the safe classroom language standard. Try generating again.",
      permanent: false,
    };
  }

  return {
    ok: true,
    contentBlocks,
    usage: {},
  };
}

export async function generateSessionContentBlocks(input: {
  context: TeacherContext;
  lessonNoteId: string;
  sessionId?: string | null;
  slot: LessonAiSlotSnapshot;
  recordUsage?: boolean;
}): Promise<GenerateSessionContentSuccess | GenerateSessionContentFailure> {
  const resolved = await resolveSessionGenerationContext({
    schoolId: input.context.schoolId,
    teacherId: input.context.teacherId,
    lessonNoteId: input.lessonNoteId,
    sessionId: input.sessionId,
    slot: input.slot,
  });
  if (!resolved.ok) {
    return { ok: false, error: resolved.error, permanent: true };
  }

  const { note, schemeItemIds, sequenceInWeek, previousSession, priorSessions } = resolved;
  let slice = buildSessionGenerationNoteSlice(note, input.slot.noteSectionKeys);
  slice = await enrichSliceWithSchemeItems(
    slice,
    schemeItemIds,
    input.context.schoolId,
    note.schemeItemIds ?? []
  );
  const teachingMetadata = await lessonNoteTeachingMetadata(note);
  const asOptionalString = (value: unknown) =>
    typeof value === "string" && value.trim() ? value : undefined;
  const subjectResolution = resolveLessonSubjectMode({
    subjectName:
      asOptionalString(teachingMetadata.subjectOfferingName) ||
      asOptionalString(teachingMetadata.subjectName),
    subjectCode: asOptionalString(teachingMetadata.subjectCode),
    curriculum: asOptionalString(teachingMetadata.gradeBand),
    gradeName: asOptionalString(teachingMetadata.gradeName),
  });
  const sliceJson = JSON.stringify(slice);

  const isDouble = input.slot.isDoublePeriod ?? false;
  const isFollowOnSession = sequenceInWeek > 1;
  const minBlocks = isDouble ? 14 : 10;
  const maxBlocks = isDouble ? 18 : 14;
  const subjectRules = buildSubjectAwareGenerationRules(subjectResolution.subjectMode);

  const result = await runLessonsLeoCompletion({
    context: input.context,
    recordUsage: input.recordUsage,
    timeoutMs: 90_000,
    systemInstruction: `${subjectRules}
Subject mode for this session: ${subjectResolution.subjectMode} (${subjectResolution.confidence} confidence).
Rules — REQUIRED STRUCTURE (produce ${minBlocks}–${maxBlocks} blocks for this ${input.slot.durationMinutes}-minute ${isDouble ? "double-period" : "single-period"} lesson):
1. STARTER block (type "explanation"):
   ${
     isFollowOnSession
       ? `This is session ${sequenceInWeek} in the week. Open with a brief "Quick review" of the IMMEDIATELY PREVIOUS session only — 2–3 short recall questions or a 3-minute retrieval activity. Do NOT re-teach previous content. Do NOT repeat definitions, worked examples, or activities already covered. Then state today's new learning target ("By the end of this session you will be able to…").`
       : `Activate relevant prior knowledge with a direct recall question or quick activity. State the learning target in plain learner language ("By the end of this session you will be able to…"). Do not just re-read the topic.`
   }
2. CORE EXPLANATION block(s) (type "explanation"): Explain the concept clearly with definition, reasoning, and context. Break complex ideas into short paragraphs. Use subject vocabulary and define new terms.
3. WORKED EXAMPLE block(s) (type "example"): At least ONE fully worked example with numbered step-by-step reasoning. For maths, show concrete numbers → abstract rule. For science/social studies, show a real observation/case → principle. Include expected answers.
${isDouble ? "4. SECOND WORKED EXAMPLE block (type \"example\"): A variation or harder example building on the first." : ""}
5. MISCONCEPTION BLOCK (type "explanation" or "check"): Name 1–2 common errors or misconceptions. Give supportive, specific correction language. Never shame learners.
6. GUIDED PRACTICE block (type "activity"): A structured practice task learners attempt with teacher support. Include 2–3 questions or tasks with expected answers in teacher notes (use <strong> tags for expected answers within the block).
7. INDEPENDENT or GROUP ACTIVITY block (type "activity"): A short activity learners complete on their own or in groups.
8. TEACHER NOTE block (type "teacher_note"): A concise revision-ready summary of the key points from this session — what a learner needs to know, not just headings. Written for learner revision.
9. DID YOU KNOW block (type "did_you_know"): One interesting, curiosity-provoking fact rooted in the topic. Use a real-world connection or surprising application.
10. FORMATIVE CHECK block(s) (type "check"): 2–3 specific questions to check understanding during the session. Include expected correct answers.
11. EXIT TICKET block (type "exit_ticket"): One focused task/question that reveals whether learners met the learning target. State what a correct response looks like.

Additional rules:
- Explanation and example blocks must be detailed enough for absent learners to revise from. Avoid thin headings-only content.
- Cover ONLY the allocated body/resources/assessment slice for this session. Do not re-introduce the whole week topic from scratch.
- Do not repeat explanations, examples, or activities already assigned to earlier sessions this week (see priorSessions).
- Context and curriculum in weekReference are background only — do not turn them into a second full lesson.
- For Mathematics: concrete → abstract sequence, full step-by-step worked solutions, simple numbers first then harder, common error callout, practice questions with answers.
- For science/social studies/literacy: concept explanation with vocabulary support, Ghana-appropriate examples, guided application, formative check.
- Use Ghana-appropriate classroom and community examples where helpful.
- Use clear, encouraging, age- and grade-appropriate language.
- Do not invent curriculum codes or assessment marks.
- Do not use abusive, demeaning, frightening, or discouraging language.
- Do not shame learners for wrong answers.`,
    userPrompt: `Draft deep, classroom-ready lesson content blocks for this session.

Session title: ${input.slot.title}
Session sequence in week: ${sequenceInWeek}
Duration: ${input.slot.durationMinutes} minutes
Period type: ${isDouble ? `double period (${input.slot.periodCount || 2} consecutive periods)` : "single period"}
Schedule: ${input.slot.scheduledDate || "not specified"} ${input.slot.startTime || ""}–${input.slot.endTime || ""}
Teaching focus: ${input.slot.focusSummary || "Cover the allocated body, resources, and assessment portions for this period."}
Splittable sections allocated: ${input.slot.noteSectionKeys.join(", ") || "body (main teaching content)"}
${
  previousSession
    ? `\nPrevious session (for quick review starter only — do not re-teach):\n${JSON.stringify(previousSession)}`
    : ""
}
${
  priorSessions.length > 0
    ? `\nEarlier sessions this week (already covered — do not repeat):\n${JSON.stringify(priorSessions)}`
    : ""
}

Teaching context:
${JSON.stringify(teachingMetadata)}

Note slice (weekReference + sessionAllocation) + scheme items:
${sliceJson}`,
    maxTokens: isDouble ? 11000 : 8000,
  });

  if (!result.ok) {
    return { ok: false, error: result.error, permanent: false };
  }

  const data = result.data as { contentBlocks?: unknown[] };
  const validated = validateGeneratedSessionContent(data.contentBlocks ?? [], input.slot);
  if (!validated.ok) return validated;
  return { ...validated, usage: result.usage };
}
