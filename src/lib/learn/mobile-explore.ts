import "server-only";

import { Types } from "mongoose";
import OpenAI from "openai";
import { connectToDatabase } from "@/db/connectToDatabase";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import { getStudentLearnAccess } from "@/lib/learn/access";
import { recordLearnMobileActivity } from "@/lib/learn/mobile-activity";
import {
  loadMobileStudentBundle,
  serializeMobileLoginStudent,
} from "@/lib/learn/mobile-student-profile";
import { parseRevisionTopicId } from "@/lib/learn/mobile-revision";
import { LearnGuidedAdventure } from "@/models/LearnGuidedAdventure";
import {
  defaultSinceDays,
  findCoveredLessonSessions,
  findLatestCoveredLessonSession,
  loadCoveredLessonSessionById,
} from "@/lib/learn/covered-lesson-sessions";
import { resolveSessionFlashcardsForStudent } from "@/lib/learn/leo-session-flashcards";
import {
  buildQuizSubmitResponse,
  buildTemplateEndingQuiz,
  gradeExploreQuizAttempt,
  pickExploreAngleIndex,
  serializeQuizForStudent,
  sessionExploreSlug,
  type AdventureEndingQuiz,
  type StoredAdventureQuizAttempt,
} from "@/lib/learn/explore-adventure-content";
import { buildExploreCompleteReward } from "@/lib/learn/explore/explore-completion-rewards";
import { SubjectOffering } from "@/models/SubjectOffering";

export type { AdventureEndingQuiz, StoredAdventureQuizAttempt };

export type AdventureDifficulty = "easy" | "standard" | "stretch";
export type AdventureCategory = "based_on_lesson" | "go_deeper";

export type StoredAdventureContent = {
  subjectId: string;
  subjectName: string;
  sourceLessonId: string;
  sourceLessonTitle: string;
  gradeName: string;
  difficulty: AdventureDifficulty;
  estimatedMinutes: number;
  intro: string;
  category: AdventureCategory;
  vocabulary: Array<{
    id: string;
    word: string;
    meaning: string;
    simpleExample: string;
    pronunciation?: string;
    localLanguageSupport?: {
      language: "Ewe" | "Twi" | "Ga" | "Dagbani" | "Other";
      translation: string;
    };
  }>;
  readingTasks: Array<{
    id: string;
    title: string;
    passage: string;
    readingLevel: string;
    questions: string[];
  }>;
  checkpoints: Array<{
    id: string;
    type: "quiz" | "reflection" | "vocabulary" | "leo_prompt" | "fun_fact";
    prompt: string;
  }>;
  funFacts: Array<{
    id: string;
    headline: string;
    fact: string;
    whyItMatters: string;
  }>;
  leoPrompts: string[];
  endingQuiz: AdventureEndingQuiz;
};

export type AdventureMetadata = {
  sessionId: string;
  generatedBy: "template" | "ai";
  reviewedStatus: "published" | "draft";
  contentVersion?: number;
  content: StoredAdventureContent;
  quizAttempt?: StoredAdventureQuizAttempt;
};

type SessionRow = {
  _id: Types.ObjectId;
  title: string;
  subjectOfferingId: Types.ObjectId;
  ownerTeacherId: Types.ObjectId;
  planNotes?: string | null;
  contentBlocks?: Array<{ type?: string; title?: string | null; bodyHtml?: string }>;
};

const EXPLORE_GENERATE_DAILY_LIMIT = 5;

const LEO_EXPLORE_SYSTEM = `You are Leo, an enthusiastic learning guide for Ghanaian school students (Primary / JHS).
You create guided "Explore" adventures that go BEYOND what the teacher already taught in class.

Critical rules:
- The student already sat through the class lesson. Do NOT repeat the lesson notes, textbook wording, or flashcard backs.
- Never paste or paraphrase the "ALREADY TAUGHT IN CLASS" section. Treat it as a list of topics to avoid duplicating.
- Add NEW knowledge: surprising connections, history or discovery story (only if real and fitting), real-world uses in Ghana/Africa/world, relatable everyday examples, future careers, or "what scientists still wonder".
- If history or industry applications do not fit the topic, use other fresh angles (compare/contrast, myth-busting, mini case study, interview-style scenario, creative analogy).
- Write like a curious young mentor — vivid, clear, never boring or preachy.
- Age-appropriate, school-safe, encouraging. No homework answers, politics, adult themes, or fees.
- Use Ghanaian/African context where natural (farms, markets, weather, community, local industry).

Return valid JSON only:
{
  "title": string,
  "intro": string (2-3 sentences: acknowledge class lesson briefly, then promise exciting extra learning),
  "difficulty": "easy" | "standard" | "stretch",
  "estimatedMinutes": number (8-14),
  "category": "based_on_lesson" | "go_deeper",
  "vocabulary": [{ "id": string, "word": string, "meaning": string, "simpleExample": string, "pronunciation"?: string }],
  "readingTasks": [{
    "id": string,
    "title": string (specific angle, e.g. "How people use this idea today"),
    "passage": string (120-220 words, NEW content only),
    "readingLevel": string,
    "questions": string[] (2-3 open questions)
  }],
  "funFacts": [{
    "id": string,
    "headline": string (short, e.g. "Did you know?"),
    "fact": string (surprising, accurate, 1-3 sentences),
    "whyItMatters": string (link to the class topic, 1 sentence)
  }],
  "checkpoints": [{ "id": string, "type": "quiz"|"reflection"|"vocabulary"|"leo_prompt"|"fun_fact", "prompt": string }],
  "leoPrompts": string[] (3-4 follow-up questions for Leo tutor),
  "endingQuiz": {
    "id": string,
    "title": "Quick Explore quiz",
    "questions": [{
      "id": string,
      "prompt": string,
      "options": [{ "id": string, "letter": "A"|"B"|"C"|"D", "label": string }],
      "correctOptionId": string,
      "explanation": string
    }] (exactly 4 questions testing the NEW explore readings/fun facts, not class notes)
  }
}

For mode "go_deeper": category must be "go_deeper", at least 2 readingTasks on different angles, at least 3 funFacts, zero repetition of class notes.
For mode "based_on_lesson": one short "bridge" reading (max 80 words) may recap, then at least 1 deeper reading and 2 funFacts.
If RELATED LESSONS are listed, this adventure must use a clearly different angle, titles, and fun facts than those lessons.`;

function stripHtml(html: string, maxLen = 400) {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1)}…`;
}

export function buildAdventureId(adventureObjectId: Types.ObjectId | string) {
  return `adventure-${String(adventureObjectId)}`;
}

export function parseAdventureId(adventureId: string): Types.ObjectId | null {
  const prefixed = adventureId.match(/^adventure-([a-f0-9]{24})$/i);
  if (prefixed?.[1] && Types.ObjectId.isValid(prefixed[1])) {
    return new Types.ObjectId(prefixed[1]);
  }
  if (Types.ObjectId.isValid(adventureId)) return new Types.ObjectId(adventureId);
  return null;
}

async function assertExploreAccess(context: LearnMobileStudentContext) {
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

async function checkGenerateRateLimit(context: LearnMobileStudentContext) {
  const since = new Date();
  since.setDate(since.getDate() - 1);

  const count = await LearnGuidedAdventure.countDocuments({
    schoolId: context.schoolId,
    studentId: context.studentId,
    createdAt: { $gte: since },
    "metadata.generatedBy": "ai",
  });

  if (count >= EXPLORE_GENERATE_DAILY_LIMIT) {
    return {
      ok: false as const,
      code: "AI_LIMIT_REACHED" as const,
      message: "Daily adventure generation limit reached.",
      status: 429,
    };
  }

  return { ok: true as const };
}

function attachEndingQuiz(
  content: Omit<StoredAdventureContent, "endingQuiz"> & { endingQuiz?: AdventureEndingQuiz },
  sessionId: Types.ObjectId
): StoredAdventureContent {
  const endingQuiz =
    content.endingQuiz?.questions?.length
      ? content.endingQuiz
      : buildTemplateEndingQuiz({
          sessionId,
          sessionTitle: content.sourceLessonTitle,
          subjectName: content.subjectName,
        });

  const { endingQuiz: _drop, ...rest } = content;
  return { ...rest, endingQuiz };
}

function adventureContentNeedsUpgrade(content?: StoredAdventureContent | null) {
  if (!content) return true;
  return (
    !content.funFacts?.length ||
    content.category !== "go_deeper" ||
    !content.endingQuiz?.questions?.length
  );
}

function serializeAdventureRow(
  row: {
    _id: Types.ObjectId;
    title: string;
    status: string;
    progressPercent: number;
    metadata?: AdventureMetadata | null;
  },
  gradeName: string,
  options?: { includeQuizAnswers?: boolean }
) {
  const metadata = row.metadata;
  const content = metadata?.content;
  if (!content) return null;

  const endingQuiz = content.endingQuiz?.questions?.length
    ? options?.includeQuizAnswers
      ? content.endingQuiz
      : serializeQuizForStudent(content.endingQuiz)
    : serializeQuizForStudent(
        buildTemplateEndingQuiz({
          sessionId: new Types.ObjectId(
            metadata.sessionId?.match(/[a-f0-9]{24}/i)?.[0] || String(row._id)
          ),
          sessionTitle: content.sourceLessonTitle,
          subjectName: content.subjectName,
        })
      );

  const quizAttempt = metadata.quizAttempt;

  return {
    id: buildAdventureId(row._id),
    title: row.title,
    subjectId: content.subjectId,
    subjectName: content.subjectName,
    sourceLessonId: content.sourceLessonId,
    sourceLessonTitle: content.sourceLessonTitle,
    gradeName: content.gradeName || gradeName,
    difficulty: content.difficulty,
    estimatedMinutes: content.estimatedMinutes,
    intro: content.intro,
    vocabulary: content.vocabulary,
    readingTasks: content.readingTasks,
    funFacts: content.funFacts ?? [],
    checkpoints: content.checkpoints,
    leoPrompts: content.leoPrompts,
    endingQuiz,
    quiz: quizAttempt
      ? {
          submitted: true,
          scorePercent: quizAttempt.scorePercent,
          correctCount: quizAttempt.correctCount,
          totalCount: quizAttempt.totalCount,
          submittedAt: quizAttempt.submittedAt,
        }
      : { submitted: false },
    category: content.category,
    status: row.status,
    progressPercent: row.progressPercent,
    generatedBy: metadata.generatedBy,
    reviewedStatus: metadata.reviewedStatus,
  };
}

function buildLessonExploreContext(session: SessionRow) {
  const blocks = session.contentBlocks ?? [];
  const taughtSnippets = blocks
    .map((block) => {
      const label = block.title?.trim() || block.type || "idea";
      const text = stripHtml(block.bodyHtml ?? "", 280);
      return text ? `${label}: ${text}` : "";
    })
    .filter(Boolean);

  const classroomBrief = taughtSnippets.join("\n").slice(0, 2400);
  const planNotes = session.planNotes?.trim()
    ? stripHtml(session.planNotes, 600)
    : "";

  return {
    classroomBrief: classroomBrief || `Class covered: ${session.title}.`,
    planNotes,
    topicKeywords: session.title,
  };
}

function buildVocabularyFromFlashcards(
  slug: string,
  sessionTitle: string,
  flashcards: Array<{ front: string; back: string }>
) {
  if (flashcards.length === 0) {
    return [
      {
        id: `vocab-${slug}-0`,
        word: "Go deeper",
        meaning: "Learn more than what was said in class.",
        simpleExample: `You can explore beyond ${sessionTitle}.`,
      },
    ];
  }

  return flashcards.slice(0, 4).map((card, index) => ({
    id: `vocab-${slug}-${index}`,
    word: card.front.slice(0, 48),
    meaning: `Extension idea: explore how "${card.back.slice(0, 80)}" shows up outside the classroom.`,
    simpleExample: `Spot ${card.front.slice(0, 30)} in news, nature, or technology.`,
  }));
}

const EXPLORE_READING_ANGLES = [
  { title: "How this idea shows up in real life", focus: "everyday life" },
  { title: "The bigger story behind the topic", focus: "discovery and history" },
  { title: "Ghana and Africa connections", focus: "local context" },
  { title: "Jobs and problems this topic helps solve", focus: "careers and impact" },
] as const;

function buildGoDeeperTemplateContent(input: {
  session: SessionRow;
  subjectName: string;
  gradeName: string;
  flashcards: Array<{ front: string; back: string }>;
  relatedLessonTitles?: string[];
}): StoredAdventureContent {
  const slug = sessionExploreSlug(input.session._id);
  const topic = input.session.title;
  const angleIndex = pickExploreAngleIndex(input.session._id, EXPLORE_READING_ANGLES.length);
  const primaryAngle = EXPLORE_READING_ANGLES[angleIndex];
  const secondaryAngle =
    EXPLORE_READING_ANGLES[(angleIndex + 1) % EXPLORE_READING_ANGLES.length];
  const relatedNote =
    input.relatedLessonTitles?.length
      ? ` (This lesson is separate from: ${input.relatedLessonTitles.slice(0, 3).join("; ")})`
      : "";

  const base = {
    subjectId: String(input.session.subjectOfferingId),
    subjectName: input.subjectName,
    sourceLessonId: `session-${String(input.session._id)}`,
    sourceLessonTitle: topic,
    gradeName: input.gradeName,
    difficulty: "stretch",
    estimatedMinutes: 10,
    category: "go_deeper",
    intro: `Your class already covered ${topic}. Leo built a unique "go deeper" path focused on ${primaryAngle.focus}${relatedNote}.`,
    vocabulary: buildVocabularyFromFlashcards(slug, topic, input.flashcards),
    readingTasks: [
      {
        id: `reading-${slug}-a`,
        title: primaryAngle.title,
        readingLevel: `${input.gradeName} explorer`,
        passage: `For ${topic}, let's explore ${primaryAngle.focus}. People use these ideas across Ghana every day — in farms, markets, hospitals, phones, and community projects. Your class lesson gave the foundation; this reading adds examples and questions your notes may not have had time for.`,
        questions: [
          "Where could you spot this idea in your community this week?",
          "What surprised you most in this reading?",
        ],
      },
      {
        id: `reading-${slug}-b`,
        title: secondaryAngle.title,
        readingLevel: `${input.gradeName} curious reader`,
        passage: `Here is another angle on ${topic}: ${secondaryAngle.focus}. Even when lessons feel similar, each Explore adventure should teach you something different — notice what is new compared with other lessons you studied.`,
        questions: [
          "How is this angle different from what you heard in class?",
          "What would you like Leo to explain next?",
        ],
      },
    ],
    funFacts: [
      {
        id: `fact-${slug}-1`,
        headline: "Did you know?",
        fact: `Topics like ${topic} often connect to more than one subject — science, social studies, and even entrepreneurship can meet in one real problem.`,
        whyItMatters: "Seeing connections helps you remember and enjoy learning more.",
      },
      {
        id: `fact-${slug}-2`,
        headline: "Leo wonders",
        fact: "Learners who explore one step beyond the textbook often explain ideas better to friends and in exams.",
        whyItMatters: "Going deeper builds confidence, not just extra facts.",
      },
      {
        id: `fact-${slug}-3`,
        headline: "Try this",
        fact: "Teaching someone else one new fact you discovered is one of the strongest ways to lock it in your memory.",
        whyItMatters: "You become the expert when you share what you found out.",
      },
    ],
    checkpoints: [
      {
        id: `checkpoint-${slug}-1`,
        type: "fun_fact",
        prompt: "Which fun fact surprised you most? Say why in one sentence.",
      },
      {
        id: `checkpoint-${slug}-2`,
        type: "reflection",
        prompt: `What is one NEW thing you learned here that was not in today's class lesson on ${topic}?`,
      },
      {
        id: `checkpoint-${slug}-3`,
        type: "leo_prompt",
        prompt: "Ask Leo for one more real-life example from Ghana or Africa.",
      },
    ],
    leoPrompts: [
      "Tell me a fun fact I did not hear in class",
      "How is this used to solve a real problem?",
      "Give me a story about how people discovered this",
    ],
  };

  return attachEndingQuiz(base, input.session._id);
}

function buildBasedOnLessonTemplateContent(input: {
  session: SessionRow;
  subjectName: string;
  gradeName: string;
  lessonContext: ReturnType<typeof buildLessonExploreContext>;
  flashcards: Array<{ front: string; back: string }>;
}): StoredAdventureContent {
  const slug = sessionExploreSlug(input.session._id);
  const topic = input.session.title;
  const bridge = input.lessonContext.classroomBrief.slice(0, 320);

  const base = {
    subjectId: String(input.session.subjectOfferingId),
    subjectName: input.subjectName,
    sourceLessonId: `session-${String(input.session._id)}`,
    sourceLessonTitle: topic,
    gradeName: input.gradeName,
    difficulty: "standard",
    estimatedMinutes: 8,
    category: "based_on_lesson",
    intro: `A quick bridge from your ${topic} class, then Leo takes you one step further with fresh examples.`,
    vocabulary: buildVocabularyFromFlashcards(slug, topic, input.flashcards),
    readingTasks: [
      {
        id: `reading-${slug}-bridge`,
        title: "Quick bridge from class",
        readingLevel: `${input.gradeName} recap`,
        passage: bridge
          ? `In class you touched on: ${bridge} … Now let's add something new.`
          : `You studied ${topic} in class. Let's stretch a little further.`,
        questions: ["What part of the class lesson do you want to understand better?"],
      },
      {
        id: `reading-${slug}-plus`,
        title: "One step beyond the lesson",
        readingLevel: `${input.gradeName} plus`,
        passage: `Here is an extra angle on ${topic} that textbooks rarely have time for — how it links to everyday life and why it matters beyond the exam.`,
        questions: [
          "How would you use this idea outside school?",
          "What would you like Leo to explain next?",
        ],
      },
    ],
    funFacts: [
      {
        id: `fact-${slug}-1`,
        headline: "Did you know?",
        fact: `When you link ${topic} to something you see every week, your brain stores it twice as strongly.`,
        whyItMatters: "Personal connections make revision faster and more fun.",
      },
    ],
    checkpoints: [
      {
        id: `checkpoint-${slug}-1`,
        type: "reflection",
        prompt: "What is one class idea you will try to use this week?",
      },
    ],
    leoPrompts: ["Give me a simpler explanation", "One more example from daily life"],
  };

  return attachEndingQuiz(base, input.session._id);
}

function buildTemplateAdventureContent(input: {
  session: SessionRow;
  subjectName: string;
  gradeName: string;
  flashcards: Array<{ front: string; back: string }>;
  category?: AdventureCategory;
  relatedLessonTitles?: string[];
}): StoredAdventureContent {
  const lessonContext = buildLessonExploreContext(input.session);
  if (input.category === "go_deeper") {
    return buildGoDeeperTemplateContent({
      session: input.session,
      subjectName: input.subjectName,
      gradeName: input.gradeName,
      flashcards: input.flashcards,
      relatedLessonTitles: input.relatedLessonTitles,
    });
  }

  return buildBasedOnLessonTemplateContent({
    session: input.session,
    subjectName: input.subjectName,
    gradeName: input.gradeName,
    lessonContext,
    flashcards: input.flashcards,
  });
}

function mergeExploreAiContent(
  template: StoredAdventureContent,
  parsed: Partial<StoredAdventureContent & { title?: string }>,
  goDeeper: boolean
): StoredAdventureContent & { title?: string } {
  return {
    ...template,
    title: parsed.title,
    intro: parsed.intro?.trim() ? parsed.intro : template.intro,
    difficulty: parsed.difficulty ?? template.difficulty,
    estimatedMinutes:
      typeof parsed.estimatedMinutes === "number" && parsed.estimatedMinutes > 0
        ? parsed.estimatedMinutes
        : template.estimatedMinutes,
    category: goDeeper ? "go_deeper" : parsed.category ?? template.category,
    vocabulary: parsed.vocabulary?.length ? parsed.vocabulary : template.vocabulary,
    readingTasks: parsed.readingTasks?.length ? parsed.readingTasks : template.readingTasks,
    funFacts: parsed.funFacts?.length ? parsed.funFacts : template.funFacts,
    checkpoints: parsed.checkpoints?.length ? parsed.checkpoints : template.checkpoints,
    leoPrompts: parsed.leoPrompts?.length ? parsed.leoPrompts : template.leoPrompts,
    endingQuiz:
      parsed.endingQuiz?.questions?.length ? parsed.endingQuiz : template.endingQuiz,
  };
}

async function loadRelatedLessonTitles(
  context: LearnMobileStudentContext,
  session: SessionRow
) {
  if (!context.classGroupId) return [] as string[];

  const sessions = await findCoveredLessonSessions<{
    _id: Types.ObjectId;
    title: string;
    subjectOfferingId: Types.ObjectId;
  }>({
    schoolId: context.schoolId,
    classGroupId: context.classGroupId,
    since: defaultSinceDays(45),
    limit: 24,
    select: "_id title subjectOfferingId",
  });

  return sessions
    .filter((row) => String(row._id) !== String(session._id))
    .filter(
      (row) => String(row.subjectOfferingId) === String(session.subjectOfferingId)
    )
    .map((row) => row.title)
    .slice(0, 6);
}

async function loadSessionForExplore(
  context: LearnMobileStudentContext,
  sessionId: Types.ObjectId
) {
  if (!context.classGroupId) return null;

  const session = await loadCoveredLessonSessionById<SessionRow>({
    sessionId,
    schoolId: context.schoolId,
    classGroupId: context.classGroupId,
    select: "_id title subjectOfferingId ownerTeacherId planNotes contentBlocks",
  });

  if (!session) return null;

  const offering = await SubjectOffering.findOne({
    _id: session.subjectOfferingId,
    schoolId: context.schoolId,
  })
    .select("displayName shortName")
    .lean<{ displayName?: string; shortName?: string } | null>();

  const subjectName = offering?.shortName || offering?.displayName || "Subject";
  const lessonContext = buildLessonExploreContext(session);

  const resolved = await resolveSessionFlashcardsForStudent({
    schoolId: context.schoolId,
    classGroupId: context.classGroupId,
    studentId: context.studentId,
    session,
    cardLimit: 6,
    generateIfMissing: false,
  });

  const flashcards =
    resolved?.cards.map((card) => ({ front: card.front, back: card.back })) ?? [];

  return { session, subjectName, lessonContext, flashcards };
}

async function ensureTemplateAdventuresForStudent(
  context: LearnMobileStudentContext,
  gradeName: string
) {
  if (!context.classGroupId) return;

  const sessions = await findCoveredLessonSessions<SessionRow>({
    schoolId: context.schoolId,
    classGroupId: context.classGroupId,
    since: defaultSinceDays(45),
    limit: 6,
    select: "_id title subjectOfferingId ownerTeacherId planNotes contentBlocks",
  });

  for (const session of sessions) {
    const sessionKey = String(session._id);
    const existing = await LearnGuidedAdventure.findOne({
      schoolId: context.schoolId,
      studentId: context.studentId,
      "metadata.sessionId": sessionKey,
    })
      .select("_id metadata")
      .lean<{
        _id: Types.ObjectId;
        metadata?: { generatedBy?: string; content?: StoredAdventureContent } | null;
      } | null>();

    const loaded = await loadSessionForExplore(context, session._id);
    if (!loaded) continue;

    const relatedLessonTitles = await loadRelatedLessonTitles(context, loaded.session);
    const content = buildTemplateAdventureContent({
      session: loaded.session,
      subjectName: loaded.subjectName,
      gradeName,
      flashcards: loaded.flashcards,
      category: "go_deeper",
      relatedLessonTitles,
    });

    const adventureTitle = `Go deeper: ${session.title}`;

    if (existing) {
      const needsUpgrade =
        existing.metadata?.generatedBy === "template" &&
        adventureContentNeedsUpgrade(existing.metadata?.content);

      if (needsUpgrade) {
        await LearnGuidedAdventure.updateOne(
          { _id: existing._id },
          {
            $set: {
              title: adventureTitle,
              "metadata.content": content,
              "metadata.contentVersion": 2,
              "metadata.reviewedStatus": "published",
            },
          }
        );
      }
      continue;
    }

    await LearnGuidedAdventure.create({
      schoolId: context.schoolId,
      studentId: context.studentId,
      accountId: context.accountId,
      gradeId: context.gradeId,
      classGroupId: context.classGroupId,
      subjectOfferingId: session.subjectOfferingId,
      title: adventureTitle,
      topic: session.title,
      status: "not_started",
      progressPercent: 0,
      metadata: {
        sessionId: sessionKey,
        generatedBy: "template",
        reviewedStatus: "published",
        contentVersion: 2,
        content,
      },
    });
  }
}

export async function buildMobileExploreAdventuresList(context: LearnMobileStudentContext) {
  await connectToDatabase();
  const gate = await assertExploreAccess(context);
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
  const gradeName = profile.gradeName || "Your grade";

  await ensureTemplateAdventuresForStudent(context, gradeName);

  const rows = await LearnGuidedAdventure.find({
    schoolId: context.schoolId,
    studentId: context.studentId,
    status: { $ne: "abandoned" },
    "metadata.content": { $exists: true },
  })
    .sort({ updatedAt: -1 })
    .limit(12)
    .lean<
      Array<{
        _id: Types.ObjectId;
        title: string;
        status: string;
        progressPercent: number;
        metadata?: { content?: StoredAdventureContent } | null;
      }>
    >();

  const adventures = rows
    .map((row) => serializeAdventureRow(row, gradeName))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const subjects = Array.from(new Set(adventures.map((a) => a.subjectName)));

  return {
    ok: true as const,
    data: {
      studentId: profile.studentId,
      introMessage:
        "Your class already learned the basics — these adventures add history, real life, fun facts, and fresh examples Leo saved for curious minds.",
      recommendedAdventureId:
        adventures.find((a) => a.status !== "completed")?.id ?? adventures[0]?.id ?? "",
      subjects: ["All", ...subjects],
      adventures: adventures.map(
        ({
          status: _s,
          progressPercent: _p,
          generatedBy: _g,
          reviewedStatus: _r,
          ...adventure
        }) => adventure
      ),
    },
  };
}

export async function buildMobileExploreAdventureDetail(
  context: LearnMobileStudentContext,
  adventureId: string
) {
  await connectToDatabase();
  const gate = await assertExploreAccess(context);
  if (!gate.ok) return gate;

  const objectId = parseAdventureId(adventureId);
  if (!objectId) {
    return {
      ok: false as const,
      code: "ADVENTURE_NOT_FOUND",
      message: "Adventure not found.",
      status: 404,
    };
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

  let row = await LearnGuidedAdventure.findOne({
    _id: objectId,
    schoolId: context.schoolId,
    studentId: context.studentId,
  }).lean<{
    _id: Types.ObjectId;
    title: string;
    status: string;
    progressPercent: number;
    metadata?: AdventureMetadata | null;
  } | null>();

  if (!row) {
    return {
      ok: false as const,
      code: "ADVENTURE_NOT_FOUND",
      message: "Adventure not found.",
      status: 404,
    };
  }

  if (adventureContentNeedsUpgrade(row.metadata?.content) && row.metadata?.sessionId) {
    const sessionObjectId = Types.ObjectId.isValid(row.metadata.sessionId)
      ? new Types.ObjectId(row.metadata.sessionId)
      : parseRevisionTopicId(row.metadata.sessionId)?.objectId;

    if (sessionObjectId && context.classGroupId) {
      const loaded = await loadSessionForExplore(context, sessionObjectId);
      if (loaded) {
        const relatedLessonTitles = await loadRelatedLessonTitles(context, loaded.session);
        const upgraded = buildTemplateAdventureContent({
          session: loaded.session,
          subjectName: loaded.subjectName,
          gradeName: serializeMobileLoginStudent(bundle).gradeName || "Your grade",
          flashcards: loaded.flashcards,
          category: row.metadata?.content?.category ?? "go_deeper",
          relatedLessonTitles,
        });

        await LearnGuidedAdventure.updateOne(
          { _id: row._id },
          {
            $set: {
              "metadata.content": upgraded,
              "metadata.contentVersion": 2,
            },
          }
        );

        row = {
          ...row,
          metadata: {
            ...row.metadata,
            sessionId: row.metadata?.sessionId || String(sessionObjectId),
            generatedBy: row.metadata?.generatedBy || "template",
            reviewedStatus: row.metadata?.reviewedStatus || "published",
            content: upgraded,
            quizAttempt: row.metadata?.quizAttempt,
          },
        };
      }
    }
  }

  const gradeName = serializeMobileLoginStudent(bundle).gradeName || "Your grade";
  const adventure = serializeAdventureRow(row, gradeName);

  if (!adventure) {
    return {
      ok: false as const,
      code: "ADVENTURE_NOT_FOUND",
      message: "Adventure content not ready.",
      status: 404,
    };
  }

  if (row.status === "not_started") {
    await LearnGuidedAdventure.updateOne(
      { _id: row._id },
      { $set: { status: "in_progress", startedAt: new Date(), progressPercent: 10 } }
    );
  }

  const {
    status: _status,
    progressPercent: _progress,
    generatedBy: _generatedBy,
    reviewedStatus: _reviewedStatus,
    ...payload
  } = adventure;

  return { ok: true as const, data: payload };
}

export async function completeMobileExploreAdventure(
  context: LearnMobileStudentContext,
  adventureId: string
) {
  await connectToDatabase();
  const gate = await assertExploreAccess(context);
  if (!gate.ok) return gate;

  const objectId = parseAdventureId(adventureId);
  if (!objectId) {
    return {
      ok: false as const,
      code: "ADVENTURE_NOT_FOUND",
      message: "Adventure not found.",
      status: 404,
    };
  }

  const existing = await LearnGuidedAdventure.findOne({
    _id: objectId,
    schoolId: context.schoolId,
    studentId: context.studentId,
  })
    .select("title topic metadata")
    .lean<{
      title: string;
      topic?: string | null;
      metadata?: AdventureMetadata | null;
    } | null>();

  if (!existing) {
    return {
      ok: false as const,
      code: "ADVENTURE_NOT_FOUND",
      message: "Adventure not found.",
      status: 404,
    };
  }

  if (!existing.metadata?.quizAttempt) {
    return {
      ok: false as const,
      code: "QUIZ_REQUIRED",
      message: "Complete the quick Explore quiz before finishing this adventure.",
      status: 400,
    };
  }

  const row = await LearnGuidedAdventure.findOneAndUpdate(
    {
      _id: objectId,
      schoolId: context.schoolId,
      studentId: context.studentId,
    },
    {
      $set: {
        status: "completed",
        completedAt: new Date(),
        progressPercent: 100,
      },
    },
    { new: true }
  )
    .select("title topic metadata")
    .lean<{
      title: string;
      topic?: string | null;
      metadata?: AdventureMetadata | null;
    } | null>();

  if (!row) {
    return {
      ok: false as const,
      code: "ADVENTURE_NOT_FOUND",
      message: "Adventure not found.",
      status: 404,
    };
  }

  const scorePercent = row.metadata?.quizAttempt?.scorePercent ?? 0;
  const content = row.metadata?.content;
  const completedExploreCount = await LearnGuidedAdventure.countDocuments({
    schoolId: context.schoolId,
    studentId: context.studentId,
    status: "completed",
  });

  const rewards = buildExploreCompleteReward({
    estimatedMinutes: content?.estimatedMinutes ?? 9,
    difficulty: content?.difficulty ?? "standard",
    quizScorePercent: scorePercent,
    completedExploreCount,
  });

  await recordLearnMobileActivity({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
    gradeId: context.gradeId,
    classGroupId: context.classGroupId,
    eventType: "explore_with_leo",
    topic: row.title,
    metadata: {
      adventureId,
      title: row.title,
      phase: "completed",
      score: scorePercent,
      xpAwarded: rewards.xpAwarded,
      badgeId: rewards.badge.id,
      badgeEarned: rewards.badge.earned,
    },
    score: scorePercent,
  });

  return {
    ok: true as const,
    data: {
      adventureId,
      completed: true,
      completedAt: new Date().toISOString(),
      quizScorePercent: scorePercent,
      xpAwarded: rewards.xpAwarded,
      badge: rewards.badge,
      celebrationMessage: rewards.celebrationMessage,
    },
  };
}

export async function submitMobileExploreAdventureQuiz(
  context: LearnMobileStudentContext,
  adventureId: string,
  body: { answers: Array<{ questionId: string; selectedOptionId: string }> }
) {
  await connectToDatabase();
  const gate = await assertExploreAccess(context);
  if (!gate.ok) return gate;

  const objectId = parseAdventureId(adventureId);
  if (!objectId) {
    return {
      ok: false as const,
      code: "ADVENTURE_NOT_FOUND",
      message: "Adventure not found.",
      status: 404,
    };
  }

  const row = await LearnGuidedAdventure.findOne({
    _id: objectId,
    schoolId: context.schoolId,
    studentId: context.studentId,
  }).lean<{
    _id: Types.ObjectId;
    title: string;
    metadata?: AdventureMetadata | null;
  } | null>();

  if (!row?.metadata?.content?.endingQuiz?.questions?.length) {
    return {
      ok: false as const,
      code: "ADVENTURE_NOT_FOUND",
      message: "Adventure quiz not ready.",
      status: 404,
    };
  }

  if (row.metadata.quizAttempt) {
    return {
      ok: true as const,
      data: buildQuizSubmitResponse(row.metadata.content.endingQuiz, row.metadata.quizAttempt),
    };
  }

  const quiz = row.metadata.content.endingQuiz;
  const attempt = gradeExploreQuizAttempt(quiz, body.answers);

  await LearnGuidedAdventure.updateOne(
    { _id: row._id },
    {
      $set: {
        "metadata.quizAttempt": attempt,
        progressPercent: 90,
        status: "in_progress",
      },
    }
  );

  await recordLearnMobileActivity({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
    gradeId: context.gradeId,
    classGroupId: context.classGroupId,
    eventType: "explore_with_leo",
    topic: row.title,
    score: attempt.scorePercent,
    metadata: {
      adventureId,
      title: row.title,
      phase: "quiz_submitted",
      correctCount: attempt.correctCount,
      totalCount: attempt.totalCount,
    },
  });

  return {
    ok: true as const,
    data: buildQuizSubmitResponse(quiz, attempt),
  };
}

async function runExploreAiGeneration(input: {
  session: SessionRow;
  subjectName: string;
  gradeName: string;
  lessonContext: ReturnType<typeof buildLessonExploreContext>;
  flashcards: Array<{ front: string; back: string }>;
  relatedLessonTitles?: string[];
  topic?: string;
  goDeeper?: boolean;
}): Promise<{ ok: true; content: StoredAdventureContent & { title: string } } | { ok: false; error: string }> {
  const goDeeper = input.goDeeper ?? true;
  const template = buildTemplateAdventureContent({
    session: input.session,
    subjectName: input.subjectName,
    gradeName: input.gradeName,
    flashcards: input.flashcards,
    category: goDeeper ? "go_deeper" : "based_on_lesson",
    relatedLessonTitles: input.relatedLessonTitles,
  });

  const defaultTitle = goDeeper
    ? `Go deeper: ${input.session.title}`
    : `Explore: ${input.session.title}`;

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return {
      ok: true,
      content: {
        ...template,
        title: defaultTitle,
      },
    };
  }

  const flashcardHints =
    input.flashcards.length > 0
      ? input.flashcards.map((c) => c.front).join(", ")
      : "none";

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.85,
      response_format: { type: "json_object" },
      max_tokens: 3200,
      messages: [
        { role: "system", content: LEO_EXPLORE_SYSTEM },
        {
          role: "user",
          content: `Create a guided adventure.

Grade: ${input.gradeName}
Subject: ${input.subjectName}
Lesson topic: ${input.session.title}
Mode: ${goDeeper ? "go_deeper" : "based_on_lesson"}

ALREADY TAUGHT IN CLASS (do NOT repeat or paraphrase — only use to know what to skip):
${input.lessonContext.classroomBrief}

Teacher plan notes (optional): ${input.lessonContext.planNotes || "none"}

Flashcard topic words (inspiration only — do not copy definitions): ${flashcardHints}

RELATED LESSONS IN THIS SUBJECT (must use a DIFFERENT angle, reading titles, fun facts, and quiz questions than these):
${(input.relatedLessonTitles?.length ? input.relatedLessonTitles.map((t) => `- ${t}`).join("\n") : "- none")}

Student focus request: ${input.topic || "surprising extra knowledge beyond class"}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return { ok: false, error: "Empty AI response" };

    const parsed = JSON.parse(raw) as Partial<StoredAdventureContent & { title: string }>;
    const merged = mergeExploreAiContent(template, parsed, goDeeper);

    return {
      ok: true,
      content: {
        ...merged,
        title: parsed.title?.trim() || defaultTitle,
        subjectId: String(input.session.subjectOfferingId),
        subjectName: input.subjectName,
        sourceLessonId: `session-${String(input.session._id)}`,
        sourceLessonTitle: input.session.title,
        gradeName: input.gradeName,
      },
    };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Adventure generation failed",
    };
  }
}

export async function generateMobileExploreAdventure(
  context: LearnMobileStudentContext,
  body: {
    lessonId?: string;
    topic?: string;
    goDeeper?: boolean;
  }
) {
  await connectToDatabase();
  const gate = await assertExploreAccess(context);
  if (!gate.ok) return gate;

  const limit = await checkGenerateRateLimit(context);
  if (!limit.ok) return limit;

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
  const gradeName = profile.gradeName || "Your grade";

  let sessionId = body.lessonId ? parseRevisionTopicId(body.lessonId)?.objectId : null;
  if (!sessionId && body.lessonId && Types.ObjectId.isValid(body.lessonId)) {
    sessionId = new Types.ObjectId(body.lessonId);
  }

  if (!sessionId) {
    const latest =
      context.classGroupId &&
      (await findLatestCoveredLessonSession({
        schoolId: context.schoolId,
        classGroupId: context.classGroupId,
        since: defaultSinceDays(21),
        select: "_id",
      }));
    sessionId = latest?._id ?? null;
  }

  if (!sessionId) {
    return {
      ok: false as const,
      code: "NO_APPROVED_CONTENT",
      message: "No lesson available for adventure generation.",
      status: 404,
    };
  }

  const loaded = await loadSessionForExplore(context, sessionId);
  if (!loaded) {
    return {
      ok: false as const,
      code: "NO_APPROVED_CONTENT",
      message: "Lesson not available for adventure generation.",
      status: 404,
    };
  }

  const sessionKey = String(sessionId);
  const existingForLesson = await LearnGuidedAdventure.findOne({
    schoolId: context.schoolId,
    studentId: context.studentId,
    "metadata.sessionId": sessionKey,
    status: { $ne: "abandoned" },
  })
    .sort({ updatedAt: -1 })
    .lean<{
      _id: Types.ObjectId;
      title: string;
      status: string;
      progressPercent: number;
      metadata?: AdventureMetadata | null;
    } | null>();

  if (existingForLesson?.metadata?.content) {
    const adventure = serializeAdventureRow(existingForLesson, gradeName);
    if (adventure) {
      const { status: _s, progressPercent: _p, generatedBy: _g, reviewedStatus: _r, ...payload } =
        adventure;
      return {
        ok: true as const,
        data: {
          adventureId: buildAdventureId(existingForLesson._id),
          adventure: payload,
          reusedExisting: true,
        },
      };
    }
  }

  const relatedLessonTitles = await loadRelatedLessonTitles(context, loaded.session);

  const generated = await runExploreAiGeneration({
    session: loaded.session,
    subjectName: loaded.subjectName,
    gradeName,
    lessonContext: loaded.lessonContext,
    flashcards: loaded.flashcards,
    relatedLessonTitles,
    topic: body.topic,
    goDeeper: body.goDeeper ?? true,
  });

  if (!generated.ok) {
    return {
      ok: false as const,
      code: "AI_ERROR",
      message: generated.error,
      status: 502,
    };
  }

  const content: StoredAdventureContent = {
    ...generated.content,
    sourceLessonId: `session-${String(sessionId)}`,
    subjectId: String(loaded.session.subjectOfferingId),
  };

  const created = await LearnGuidedAdventure.create({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
    gradeId: context.gradeId,
    classGroupId: context.classGroupId,
    subjectOfferingId: loaded.session.subjectOfferingId,
    title: generated.content.title || `Explore: ${loaded.session.title}`,
    topic: body.topic || loaded.session.title,
    status: "not_started",
    progressPercent: 0,
    metadata: {
      sessionId: sessionKey,
      generatedBy: process.env.OPENAI_API_KEY?.trim() ? "ai" : "template",
      reviewedStatus: "draft",
      contentVersion: 2,
      content,
    },
  });

  await recordLearnMobileActivity({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
    gradeId: context.gradeId,
    classGroupId: context.classGroupId,
    eventType: "explore_with_leo",
    metadata: {
      adventureId: buildAdventureId(created._id),
      title: created.title,
      phase: "generated",
    },
  });

  const adventure = serializeAdventureRow(
    {
      _id: created._id,
      title: created.title,
      status: created.status,
      progressPercent: created.progressPercent,
      metadata: created.metadata as { content?: StoredAdventureContent },
    },
    gradeName
  );

  if (!adventure) {
    return {
      ok: false as const,
      code: "UNKNOWN_ERROR",
      message: "Could not serialize adventure.",
      status: 500,
    };
  }

  const { status: _s, progressPercent: _p, ...payload } = adventure;

  return {
    ok: true as const,
    data: {
      adventureId: buildAdventureId(created._id),
      adventure: payload,
    },
  };
}
