import "server-only";

import { Types } from "mongoose";
import OpenAI from "openai";
import { connectToDatabase } from "@/db/connectToDatabase";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import { getStudentLearnAccess } from "@/lib/learn/access";
import { recordLearnMobileActivity } from "@/lib/learn/mobile-activity";
import {
  recordLeoSafetyEvent,
  reviewLeoAssistantReply,
  reviewLeoStudentMessage,
} from "@/lib/learn/mobile-leo-safety";
import {
  loadMobileStudentBundle,
  serializeMobileLoginStudent,
} from "@/lib/learn/mobile-student-profile";
import { parseRevisionTopicId } from "@/lib/learn/mobile-revision";
import { Homework } from "@/models/Homework";
import { LearnActivityEvent } from "@/models/LearnActivityEvent";
import { LessonFlashcard } from "@/models/LessonFlashcard";
import { LessonFlashcardDeck } from "@/models/LessonFlashcardDeck";
import {
  findLatestCoveredLessonSession,
  loadCoveredLessonSessionById,
} from "@/lib/learn/covered-lesson-sessions";
import { publishedStudentDeckQuery } from "@/lib/learn/student-deck-access";
import { LessonSession } from "@/models/LessonSession";
import { LeoConversation } from "@/models/LeoConversation";
import { LeoMessage } from "@/models/LeoMessage";
import { SubjectOffering } from "@/models/SubjectOffering";

export type MobileTutorMode =
  | "explain"
  | "quiz"
  | "hint"
  | "summarize"
  | "revise"
  | "exam_prep";

export type MobileTutorSourceType =
  | "lesson"
  | "flashcard"
  | "assignment"
  | "adventure"
  | "language";

export type MobileTutorSource = {
  title: string;
  type: MobileTutorSourceType;
};

function mapSourcesForMobile(
  sources: Array<{ title: string; type: MobileTutorSourceType }>,
  sessionId: Types.ObjectId
) {
  return sources.map((source, index) => ({
    id: `${source.type}-${index}-${String(sessionId)}`,
    type:
      source.type === "lesson"
        ? ("lesson_note" as const)
        : source.type === "flashcard"
          ? ("quiz" as const)
          : source.type === "assignment"
            ? ("assignment" as const)
            : ("teacher_resource" as const),
    title: source.title,
  }));
}

export type MobileTutorReply = {
  messageId: string;
  content: string;
  sources: MobileTutorSource[];
  suggestedPrompts: string[];
};

export type MobileTutorSuggestedAction = {
  label: string;
  prompt: string;
  mode: MobileTutorMode;
};

const TUTOR_DAILY_LIMIT = 40;
const LEO_TUTOR_SOURCE_ROUTE_PREFIX = "learn-mobile-tutor";

const LEO_STUDENT_SYSTEM = `You are Leo, a warm learning companion for Ghanaian school students using EduSentrix Learn.
Rules:
- Use simple, encouraging language suitable for Primary or JHS learners.
- Ground answers in the lesson context provided. If context is missing, say what you know and suggest revising class notes.
- Never give final homework answers. Use hints, steps, and questions that help the student think.
- No unsafe, political, adult, or discouraging content.
- Never mention fees, billing, passwords, or private teacher/admin data.
- Respond with valid JSON only:
{
  "content": string (friendly tutor reply, short paragraphs),
  "suggestedPrompts": string[] (2-4 short follow-up prompts the student can tap),
  "safetyFlags": string[] (optional, e.g. "stay_on_topic")
}`;

type LessonContext = {
  sessionId: Types.ObjectId;
  sessionTitle: string;
  subjectName: string;
  summary: string;
  flashcardSnippets: string[];
  sources: MobileTutorSource[];
};

function stripHtml(html: string, maxLen = 500) {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1)}…`;
}

function tutorUserId(context: LearnMobileStudentContext) {
  return context.accountId;
}

function tutorSourceRoute(studentId: Types.ObjectId) {
  return `${LEO_TUTOR_SOURCE_ROUTE_PREFIX}:${String(studentId)}`;
}

async function assertTutorAccess(context: LearnMobileStudentContext) {
  const access = await getStudentLearnAccess({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
  });

  if (!access.hasAccess) {
    return {
      ok: false as const,
      code: access.schoolEligible ? "LEARN_ACCESS_REQUIRED" : "SCHOOL_NOT_ELIGIBLE",
      message: access.blockedReason || "Learn access required.",
      status: 403,
    };
  }

  if (!context.classGroupId) {
    return {
      ok: false as const,
      code: "NO_STUDENT_PROFILE",
      message: "Class group not found.",
      status: 404,
    };
  }

  return { ok: true as const };
}

async function checkTutorRateLimit(context: LearnMobileStudentContext) {
  const since = new Date();
  since.setDate(since.getDate() - 1);

  const count = await LearnActivityEvent.countDocuments({
    schoolId: context.schoolId,
    studentId: context.studentId,
    eventType: "leo_tutor_message",
    occurredAt: { $gte: since },
  });

  if (count >= TUTOR_DAILY_LIMIT) {
    return {
      ok: false as const,
      code: "AI_LIMIT_REACHED" as const,
      message: "Daily tutor limit reached.",
      status: 429,
    };
  }

  return { ok: true as const };
}

function parseLessonSessionId(lessonId?: string | null): Types.ObjectId | null {
  if (!lessonId) return null;
  const fromTopic = parseRevisionTopicId(lessonId);
  if (fromTopic) return fromTopic.objectId;
  if (Types.ObjectId.isValid(lessonId)) return new Types.ObjectId(lessonId);
  return null;
}

async function loadTutorLessonContext(
  context: LearnMobileStudentContext,
  lessonId?: string | null
): Promise<LessonContext | null> {
  if (!context.classGroupId) return null;

  let sessionId = parseLessonSessionId(lessonId);

  if (!sessionId) {
    const since = new Date();
    since.setDate(since.getDate() - 21);
    const latest = await findLatestCoveredLessonSession({
      schoolId: context.schoolId,
      classGroupId: context.classGroupId,
      since,
      select: "_id title subjectOfferingId contentBlocks",
    });

    if (!latest) return null;
    sessionId = latest._id;
  }

  const session = await loadCoveredLessonSessionById({
    sessionId,
    schoolId: context.schoolId,
    classGroupId: context.classGroupId,
    select: "_id title subjectOfferingId contentBlocks",
  });

  if (!session) return null;

  const offering = await SubjectOffering.findOne({
    _id: session.subjectOfferingId,
    schoolId: context.schoolId,
  })
    .select("displayName shortName")
    .lean<{ displayName?: string; shortName?: string } | null>();

  const subjectName = offering?.shortName || offering?.displayName || "Subject";
  const firstBlock = session.contentBlocks?.[0]?.bodyHtml;
  const summary = firstBlock
    ? stripHtml(firstBlock)
    : `Your class covered ${session.title}. Ask Leo for a simple explanation or a practice question.`;

  const deck = await LessonFlashcardDeck.findOne(
    publishedStudentDeckQuery({
      schoolId: context.schoolId,
      classGroupId: context.classGroupId,
      sessionId: session._id,
    })
  )
    .select("_id")
    .lean<{ _id: Types.ObjectId } | null>();

  let flashcardSnippets: string[] = [];
  if (deck) {
    const cards = await LessonFlashcard.find({ schoolId: context.schoolId, deckId: deck._id })
      .sort({ order: 1 })
      .limit(6)
      .select("front back")
      .lean<Array<{ front: string; back: string }>>();
    flashcardSnippets = cards.map((c) => `${c.front} → ${c.back}`);
  }

  const sources: MobileTutorSource[] = [
    { title: session.title, type: "lesson" },
  ];
  if (deck) {
    sources.push({ title: `${session.title} flashcards`, type: "flashcard" });
  }

  const homework = await Homework.findOne({
    schoolId: context.schoolId,
    sourceSessionId: session._id,
    status: "published",
    classGroupIds: context.classGroupId,
  })
    .select("title")
    .lean<{ title?: string } | null>();

  if (homework?.title) {
    sources.push({ title: homework.title, type: "assignment" });
  }

  return {
    sessionId: session._id,
    sessionTitle: session.title,
    subjectName,
    summary,
    flashcardSnippets,
    sources,
  };
}

function buildQuickPrompts(lesson?: LessonContext | null): MobileTutorSuggestedAction[] {
  const topic = lesson?.sessionTitle ?? "today's lesson";
  return [
    {
      label: "Explain simply",
      prompt: `Explain ${topic} in a simpler way.`,
      mode: "explain",
    },
    {
      label: "Give me a hint",
      prompt: `Give me a hint about ${topic} without giving the final answer.`,
      mode: "hint",
    },
    {
      label: "Quiz me",
      prompt: `Ask me one practice question about ${topic}.`,
      mode: "quiz",
    },
    {
      label: "Quick summary",
      prompt: `Give me a short summary of ${topic}.`,
      mode: "summarize",
    },
  ];
}

function fallbackTutorReply(
  message: string,
  mode: MobileTutorMode,
  lesson?: LessonContext | null
): MobileTutorReply {
  const topic = lesson?.sessionTitle ?? "your lesson";
  const lower = message.toLowerCase();
  let content = lesson?.summary
    ? `Let's look at ${topic}. ${lesson.summary}`
    : `I can help you with ${topic}. Try asking for a simple explanation or a short practice question.`;

  if (mode === "hint" || lower.includes("hint")) {
    content = `Hint for ${topic}: break the question into smaller steps. What do you already know from class? Write that first, then check one fact at a time.`;
  } else if (mode === "quiz" || lower.includes("quiz")) {
    content = `Practice question about ${topic}: explain one example from class in your own words. What changed, and what type of energy was involved?`;
  } else if (mode === "summarize" || lower.includes("summary")) {
    content = `Quick summary — ${lesson?.summary ?? `revise the main ideas from ${topic} and say them out loud once.`}`;
  } else if (mode === "exam_prep") {
    content =
      "Exam prep tip: revise your weakest topic first, then do one short timed practice. Mark what still feels shaky and ask for a hint.";
  }

  return {
    messageId: `tutor-fallback-${Date.now()}`,
    content,
    sources: lesson?.sources ?? [{ title: topic, type: "lesson" }],
    suggestedPrompts: buildQuickPrompts(lesson).map((p) => p.prompt),
  };
}

async function runTutorCompletion(input: {
  message: string;
  mode: MobileTutorMode;
  studentName: string;
  gradeName: string;
  lesson?: LessonContext | null;
}): Promise<{ ok: true; reply: MobileTutorReply } | { ok: false; error: string }> {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return { ok: true, reply: fallbackTutorReply(input.message, input.mode, input.lesson) };
  }

  const modeInstruction: Record<MobileTutorMode, string> = {
    explain: "Explain clearly with one everyday Ghanaian school example.",
    quiz: "Ask ONE practice question only. Do not give the full answer yet.",
    hint: "Give a helpful hint only. Do not write the final answer for homework.",
    summarize: "Give a short friendly summary with 3 bullet ideas.",
    revise: "Suggest a short revision plan with 2-3 steps.",
    exam_prep: "Give calm exam prep advice grounded in the lesson topic.",
  };

  const contextPayload = input.lesson
    ? {
        lessonTitle: input.lesson.sessionTitle,
        subjectName: input.lesson.subjectName,
        summary: input.lesson.summary,
        flashcards: input.lesson.flashcardSnippets,
      }
    : { note: "No lesson context available yet." };

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  let completion;

  try {
    completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      response_format: { type: "json_object" },
      max_tokens: 900,
      messages: [
        { role: "system", content: LEO_STUDENT_SYSTEM },
        {
          role: "user",
          content: `Student: ${input.studentName} (${input.gradeName || "student"})
Mode: ${input.mode}
Mode instruction: ${modeInstruction[input.mode]}
Lesson context JSON:\n${JSON.stringify(contextPayload)}
Student message:\n${input.message}`,
        },
      ],
    });
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Tutor request failed",
    };
  }

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    return { ok: false, error: "Empty tutor response" };
  }

  let parsed: { content?: string; suggestedPrompts?: string[]; safetyFlags?: string[] };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    return { ok: true, reply: fallbackTutorReply(input.message, input.mode, input.lesson) };
  }

  const content = parsed.content?.trim() || fallbackTutorReply(input.message, input.mode, input.lesson).content;

  return {
    ok: true,
    reply: {
      messageId: `tutor-${Date.now()}`,
      content,
      sources: input.lesson?.sources ?? [{ title: "Class lesson", type: "lesson" }],
      suggestedPrompts:
        parsed.suggestedPrompts?.slice(0, 4) ??
        buildQuickPrompts(input.lesson).map((p) => p.prompt),
    },
  };
}

async function getOrCreateTutorConversation(
  context: LearnMobileStudentContext,
  title: string
) {
  const userId = tutorUserId(context);
  const route = tutorSourceRoute(context.studentId);

  let conversation = await LeoConversation.findOne({
    schoolId: context.schoolId,
    userId,
    role: "student",
    sourceApp: "student",
    sourceRoute: route,
    archivedAt: null,
  })
    .sort({ lastMessageAt: -1 })
    .lean<{ _id: Types.ObjectId } | null>();

  if (!conversation) {
    const created = await LeoConversation.create({
      schoolId: context.schoolId,
      userId,
      role: "student",
      title: title.slice(0, 80),
      sourceApp: "student",
      sourceRoute: route,
      sourceTab: "learn-mobile",
      pinned: false,
      lastMessageAt: new Date(),
    });
    conversation = { _id: created._id };
  }

  return conversation._id;
}

async function appendLeoMessage(input: {
  conversationId: Types.ObjectId;
  context: LearnMobileStudentContext;
  author: "user" | "assistant";
  content: string;
  citations?: Array<{ type: "record"; label: string; ref: string }>;
}) {
  const userId = tutorUserId(input.context);
  const message = await LeoMessage.create({
    conversationId: input.conversationId,
    schoolId: input.context.schoolId,
    userId,
    role: "student",
    author: input.author,
    contentText: input.content,
    citations: input.citations,
    status: "complete",
  });

  await LeoConversation.updateOne(
    { _id: input.conversationId },
    { $set: { lastMessageAt: new Date() } }
  );

  return message;
}

function mapLeoMessagesToMobile(
  rows: Array<{ _id: Types.ObjectId; author: string; contentText: string }>,
  lesson: LessonContext | null,
  quickPrompts: MobileTutorSuggestedAction[]
) {
  const sourcesWithIds = lesson
    ? mapSourcesForMobile(lesson.sources, lesson.sessionId)
    : [];

  return rows.map((row) => ({
    id: String(row._id),
    role: row.author === "user" ? ("student" as const) : ("tutor" as const),
    message: row.contentText,
    sources: row.author === "assistant" && sourcesWithIds.length > 0 ? sourcesWithIds : undefined,
    suggestedActions:
      row.author === "assistant"
        ? quickPrompts.map((p) => ({
            label: p.label,
            prompt: p.prompt,
            mode: p.mode,
          }))
        : undefined,
  }));
}

export async function buildMobileTutorBootstrap(context: LearnMobileStudentContext) {
  await connectToDatabase();
  const gate = await assertTutorAccess(context);
  if (!gate.ok) return gate;

  const bundle = await loadMobileStudentBundle({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
  });

  if (!bundle) {
    return {
      ok: false as const,
      code: "NO_STUDENT_PROFILE",
      message: "Student profile not found.",
      status: 404,
    };
  }

  const profile = serializeMobileLoginStudent(bundle);
  const lesson = await loadTutorLessonContext(context);
  const quickPrompts = buildQuickPrompts(lesson);

  if (!lesson) {
    return {
      ok: true as const,
      data: {
        context: {
          studentName: profile.firstName,
          schoolName: profile.schoolName,
          className: profile.classGroupName,
          subjectName: "Your subjects",
          lessonTitle: "Lessons coming soon",
          tutorName: "Leo Tutor",
        },
        messages: [],
        quickPrompts,
      },
      meta: { hasLessonContext: false },
    };
  }

  const welcome = {
    id: "tutor-welcome",
    role: "tutor" as const,
    mode: "explain" as const,
    message: `Hi ${profile.firstName}. I am Leo, your learning companion. I can help with ${lesson.sessionTitle} in ${lesson.subjectName}. Ask for a simple explanation, a hint, or a short practice question.`,
    sources: mapSourcesForMobile(lesson.sources, lesson.sessionId),
    suggestedActions: quickPrompts,
  };

  return {
    ok: true as const,
    data: {
      context: {
        studentName: profile.firstName,
        schoolName: profile.schoolName,
        className: profile.classGroupName,
        subjectName: lesson.subjectName,
        lessonTitle: lesson.sessionTitle,
        tutorName: "Leo Tutor",
      },
      messages: [welcome],
      quickPrompts,
    },
    meta: { hasLessonContext: true, sessionId: String(lesson.sessionId) },
  };
}

export async function listMobileTutorConversations(context: LearnMobileStudentContext) {
  await connectToDatabase();
  const gate = await assertTutorAccess(context);
  if (!gate.ok) return gate;

  const userId = tutorUserId(context);
  const route = tutorSourceRoute(context.studentId);

  const rows = await LeoConversation.find({
    schoolId: context.schoolId,
    userId,
    role: "student",
    sourceApp: "student",
    sourceRoute: route,
    archivedAt: null,
  })
    .sort({ lastMessageAt: -1 })
    .limit(10)
    .select("_id title lastMessageAt")
    .lean<Array<{ _id: Types.ObjectId; title: string; lastMessageAt: Date }>>();

  const bootstrap = await buildMobileTutorBootstrap(context);
  if (!bootstrap.ok) return bootstrap;

  return {
    ok: true as const,
    data: {
      conversations: rows.map((row) => ({
        id: String(row._id),
        title: row.title,
        lastMessageAt: row.lastMessageAt.toISOString(),
      })),
      activeConversationId: rows[0] ? String(rows[0]._id) : null,
      bootstrap: bootstrap.data,
    },
  };
}

export async function getMobileTutorConversation(
  context: LearnMobileStudentContext,
  conversationId: string
) {
  await connectToDatabase();
  const gate = await assertTutorAccess(context);
  if (!gate.ok) return gate;

  if (!Types.ObjectId.isValid(conversationId)) {
    return {
      ok: false as const,
      code: "CONVERSATION_NOT_FOUND",
      message: "Conversation not found.",
      status: 404,
    };
  }

  const userId = tutorUserId(context);
  const conversation = await LeoConversation.findOne({
    _id: new Types.ObjectId(conversationId),
    schoolId: context.schoolId,
    userId,
    role: "student",
    sourceApp: "student",
  }).lean<{ _id: Types.ObjectId; title: string } | null>();

  if (!conversation) {
    return {
      ok: false as const,
      code: "CONVERSATION_NOT_FOUND",
      message: "Conversation not found.",
      status: 404,
    };
  }

  const lesson = await loadTutorLessonContext(context);
  const quickPrompts = buildQuickPrompts(lesson);
  const messages = await LeoMessage.find({ conversationId: conversation._id })
    .sort({ createdAt: 1 })
    .limit(80)
    .select("_id author contentText")
    .lean<Array<{ _id: Types.ObjectId; author: string; contentText: string }>>();

  const bootstrap = await buildMobileTutorBootstrap(context);
  if (!bootstrap.ok) return bootstrap;

  const mapped = mapLeoMessagesToMobile(messages, lesson, quickPrompts);

  return {
    ok: true as const,
    data: {
      conversationId: String(conversation._id),
      title: conversation.title,
      context: bootstrap.data.context,
      messages: mapped.length > 0 ? mapped : bootstrap.data.messages,
      quickPrompts,
    },
  };
}

export async function handleMobileTutorChat(
  context: LearnMobileStudentContext,
  body: {
    message: string;
    mode?: MobileTutorMode;
    conversationId?: string;
    lessonId?: string;
    subjectId?: string;
    hasStudentAttempted?: boolean;
  }
) {
  await connectToDatabase();
  const gate = await assertTutorAccess(context);
  if (!gate.ok) return gate;

  const limit = await checkTutorRateLimit(context);
  if (!limit.ok) return limit;

  const trimmed = body.message.trim();
  if (!trimmed) {
    return {
      ok: false as const,
      code: "VALIDATION_ERROR",
      message: "Message is required.",
      status: 400,
    };
  }

  const mode = body.mode ?? "explain";
  const inboundSafety = reviewLeoStudentMessage({
    message: trimmed,
    mode,
    hasStudentAttempted: body.hasStudentAttempted,
  });

  if (inboundSafety.status === "blocked") {
    await recordLeoSafetyEvent({
      context,
      status: inboundSafety.status,
      flags: inboundSafety.flags,
      mode,
      direction: "inbound",
    });
    return {
      ok: false as const,
      code: "LEO_SAFETY_BLOCKED",
      message:
        inboundSafety.blockedMessage ??
        "Leo can only help with safe, school-friendly learning right now.",
      status: 403,
    };
  }

  const safeMessage = inboundSafety.message;
  if (inboundSafety.flags.length > 0) {
    await recordLeoSafetyEvent({
      context,
      status: inboundSafety.status,
      flags: inboundSafety.flags,
      mode,
      direction: "inbound",
    });
  }
  const bundle = await loadMobileStudentBundle({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
  });

  if (!bundle) {
    return {
      ok: false as const,
      code: "NO_STUDENT_PROFILE",
      message: "Student profile not found.",
      status: 404,
    };
  }

  const profile = serializeMobileLoginStudent(bundle);
  const lesson = await loadTutorLessonContext(context, body.lessonId);

  if (!lesson) {
    return {
      ok: false as const,
      code: "NO_APPROVED_CONTENT",
      message: "No lesson context available yet.",
      status: 404,
    };
  }

  const completion = await runTutorCompletion({
    message: safeMessage,
    mode,
    studentName: profile.firstName,
    gradeName: profile.gradeName,
    lesson,
  });

  if (!completion.ok) {
    return {
      ok: false as const,
      code: "AI_ERROR",
      message: completion.error,
      status: 502,
    };
  }

  const conversationId = body.conversationId
    ? Types.ObjectId.isValid(body.conversationId)
      ? new Types.ObjectId(body.conversationId)
      : null
    : null;

  const resolvedConversationId =
    conversationId ?? (await getOrCreateTutorConversation(context, lesson.sessionTitle));

  if (!resolvedConversationId) {
    return {
      ok: false as const,
      code: "CONVERSATION_NOT_FOUND",
      message: "Could not start tutor conversation.",
      status: 500,
    };
  }

  await appendLeoMessage({
    conversationId: resolvedConversationId,
    context,
    author: "user",
    content: safeMessage,
  });

  const outboundSafety = reviewLeoAssistantReply(completion.reply.content);
  if (outboundSafety.flags.length > 0) {
    await recordLeoSafetyEvent({
      context,
      conversationId: resolvedConversationId,
      status: outboundSafety.status,
      flags: outboundSafety.flags,
      mode,
      direction: "outbound",
    });
  }

  const assistantMessage = await appendLeoMessage({
    conversationId: resolvedConversationId,
    context,
    author: "assistant",
    content: outboundSafety.content,
    citations: completion.reply.sources.map((s) => ({
      type: "record" as const,
      label: s.title,
      ref: `${s.type}:${lesson.sessionId}`,
    })),
  });

  await recordLearnMobileActivity({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
    gradeId: context.gradeId,
    classGroupId: context.classGroupId,
    eventType: "leo_tutor_message",
    metadata: {
      mode,
      conversationId: String(resolvedConversationId),
      messageId: String(assistantMessage._id),
      lessonId: String(lesson.sessionId),
    },
  });

  const quickPrompts = buildQuickPrompts(lesson);

  return {
    ok: true as const,
    data: {
      conversationId: String(resolvedConversationId),
      messageId: String(assistantMessage._id),
      answer: outboundSafety.content,
      sources: mapSourcesForMobile(completion.reply.sources, lesson.sessionId),
      suggestedActions: quickPrompts.map((p) => ({
        label: p.label,
        prompt: p.prompt,
        mode: p.mode,
      })),
      suggestedPrompts: completion.reply.suggestedPrompts,
      safetyFlags: [...inboundSafety.flags, ...outboundSafety.flags],
    },
  };
}

export async function handleMobileTutorModeAction(
  context: LearnMobileStudentContext,
  mode: MobileTutorMode,
  body: { message?: string; lessonId?: string; conversationId?: string }
) {
  const defaultMessages: Record<MobileTutorMode, string> = {
    explain: "Explain this lesson in a simpler way.",
    quiz: "Ask me one practice question from this lesson.",
    hint: "Give me a hint without the final answer.",
    summarize: "Give me a short summary of this lesson.",
    revise: "What should I revise next for this topic?",
    exam_prep: "Help me prepare for my upcoming test on this topic.",
  };

  return handleMobileTutorChat(context, {
    message: body.message?.trim() || defaultMessages[mode],
    mode,
    lessonId: body.lessonId,
    conversationId: body.conversationId,
  });
}
