import "server-only";

import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getStudentLearnAccess } from "@/lib/learn/access";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import { canStudentViewNotebookNotes } from "@/lib/lessons/notebook-notes-visibility";
import {
  LearnSubjectJourney,
  type ILearnSubjectJourney,
  type LearnJourneyStepKey,
} from "@/models/LearnSubjectJourney";
import { LessonDelivery } from "@/models/LessonDelivery";
import { LessonFlashcard } from "@/models/LessonFlashcard";
import { LessonSession } from "@/models/LessonSession";
import { StudentFlashcardProgress } from "@/models/StudentFlashcardProgress";
import {
  buildJourneyAssignmentsSection,
  resolveLinkedAssignmentIds,
} from "./link-assignments";
import { buildJourneyExploreSection } from "./link-explore";

import {
  serializeSubjectJourneySummary,
  type MobileJourneyAssignmentSummary,
  type MobileSubjectJourneySummary,
} from "./serialize-todays-journey";

export type MobileSubjectJourneyDetail = MobileSubjectJourneySummary & {
  source: {
    lessonSessionId: string;
    lessonNoteId?: string;
    schemeItemId?: string;
    coveredAt: string;
    teacherName?: string;
  };
  notebook: {
    sessionId: string;
    title: string;
    contentHtml: string;
    keyTerms: string[];
    summary: string;
    route: string;
  };
  flashcards: {
    deckId?: string;
    totalCards: number;
    masteredCards: number;
    dueCards: number;
    preview: Array<{ id: string; front: string; back?: string }>;
    route?: string;
  };
  explore: {
    status: "locked" | "available" | "generating" | "ready" | "completed";
    adventureId?: string;
    title: string;
    description: string;
    route?: string;
  };
  extraAi: {
    enabled: boolean;
    suggestedPrompts: Array<{
      id: string;
      label: string;
      mode:
        | "simple_explanation"
        | "ghanaian_example"
        | "practice_questions"
        | "diagram_help"
        | "mistake_explanation"
        | "assignment_hint";
    }>;
    leoContext: Record<string, string>;
  };
  assignments: MobileJourneyAssignmentSummary[];
  reflection?: {
    confidence?: "not_yet" | "a_little" | "good" | "very_well";
    studentNote?: string;
  };
};

type JourneyResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; status: number };

function stripHtml(html: string, maxLen = 220) {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1)}…`;
}

function extractKeyTerms(html: string) {
  const terms = new Set<string>();
  const boldMatches = html.matchAll(/<(?:strong|b)[^>]*>([^<]{2,48})<\/(?:strong|b)>/gi);
  for (const match of boldMatches) {
    const term = match[1]?.replace(/\s+/g, " ").trim();
    if (term) terms.add(term);
  }
  return Array.from(terms).slice(0, 8);
}

function buildSuggestedPrompts(subjectName: string, topicTitle: string) {
  return [
    {
      id: "simple",
      label: "Explain this simply",
      mode: "simple_explanation" as const,
    },
    {
      id: "ghana",
      label: "Give a Ghanaian example",
      mode: "ghanaian_example" as const,
    },
    {
      id: "practice",
      label: "Ask me practice questions",
      mode: "practice_questions" as const,
    },
    {
      id: "diagram",
      label: "Help me picture this",
      mode: "diagram_help" as const,
    },
  ].map((prompt) => ({
    ...prompt,
    label: prompt.id === "simple" ? `Explain ${topicTitle} simply` : prompt.label,
  }));
}

async function assertJourneyAccess(context: LearnMobileStudentContext) {
  await connectToDatabase();
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

async function loadScopedJourney(context: LearnMobileStudentContext, journeyId: string) {
  if (!Types.ObjectId.isValid(journeyId)) {
    return {
      ok: false as const,
      code: "JOURNEY_NOT_FOUND",
      message: "Subject journey not found.",
      status: 404,
    };
  }

  const journey = await LearnSubjectJourney.findOne({
    _id: journeyId,
    schoolId: context.schoolId,
    studentId: context.studentId,
  }).lean<ILearnSubjectJourney | null>();

  if (!journey) {
    return {
      ok: false as const,
      code: "JOURNEY_NOT_FOUND",
      message: "Subject journey not found.",
      status: 404,
    };
  }

  return { ok: true as const, journey };
}

async function buildNotebookSection(
  context: LearnMobileStudentContext,
  journey: ILearnSubjectJourney
) {
  const session = await LessonSession.findOne({
    _id: journey.lessonSessionId,
    schoolId: context.schoolId,
    classGroupId: context.classGroupId,
  })
    .select("_id title boardNotes notebookNotesPublished")
    .lean<{
      _id: Types.ObjectId;
      title: string;
      boardNotes?: { contentHtml?: string } | null;
      notebookNotesPublished?: boolean;
    } | null>();

  const delivery = session
    ? await LessonDelivery.findOne({
        schoolId: context.schoolId,
        classGroupId: context.classGroupId,
        sessionId: session._id,
      })
        .select("status")
        .lean<{ status: string } | null>()
    : null;

  const contentHtml = session?.boardNotes?.contentHtml ?? "";
  const canView = session
    ? canStudentViewNotebookNotes({
        notebookNotesPublished: Boolean(session.notebookNotesPublished),
        boardNotesHtml: contentHtml,
        deliveryStatus: delivery?.status ?? null,
      })
    : false;

  return {
    sessionId: String(journey.lessonSessionId),
    title: session?.title ?? journey.topicTitle,
    contentHtml: canView ? contentHtml : "",
    keyTerms: canView ? extractKeyTerms(contentHtml) : [],
    summary: canView
      ? stripHtml(contentHtml, 180)
      : "Your teacher has not shared notebook notes for this lesson yet.",
    route: `/(student)/notebooks/${String(journey.lessonSessionId)}`,
  };
}

async function buildFlashcardsSection(
  context: LearnMobileStudentContext,
  journey: ILearnSubjectJourney
) {
  const deckId = journey.linkedFlashcardDeckId;
  if (!deckId) {
    return {
      totalCards: 0,
      masteredCards: 0,
      dueCards: 0,
      preview: [] as Array<{ id: string; front: string; back?: string }>,
    };
  }

  const [cards, progressRows] = await Promise.all([
    LessonFlashcard.find({ schoolId: context.schoolId, deckId })
      .sort({ order: 1 })
      .limit(6)
      .lean<Array<{ _id: Types.ObjectId; front: string; back: string }>>(),
    StudentFlashcardProgress.find({
      schoolId: context.schoolId,
      studentId: context.studentId,
      deckId,
    })
      .select("status")
      .lean<Array<{ status: string }>>(),
  ]);

  const masteredCards = progressRows.filter((row) => row.status === "mastered").length;
  const dueCards = progressRows.filter(
    (row) => row.status === "needs_review" || row.status === "learning"
  ).length;

  return {
    deckId: String(deckId),
    totalCards: cards.length,
    masteredCards,
    dueCards: dueCards || Math.max(cards.length - masteredCards, 0),
    preview: cards.slice(0, 3).map((card) => ({
      id: String(card._id),
      front: card.front,
      back: card.back,
    })),
    route: `/(student)/flashcards/${String(deckId)}`,
  };
}

async function buildExploreSection(
  context: LearnMobileStudentContext,
  journey: ILearnSubjectJourney
) {
  return buildJourneyExploreSection(context, journey);
}

async function buildAssignmentsSection(
  context: LearnMobileStudentContext,
  journey: ILearnSubjectJourney
) {
  return buildJourneyAssignmentsSection(context, journey);
}

export { resolveLinkedAssignmentIds } from "./link-assignments";
export { resolveLinkedExploreAdventureId } from "./link-explore";

export async function loadSubjectJourneyDetail(
  context: LearnMobileStudentContext,
  journeyId: string
): Promise<JourneyResult<MobileSubjectJourneyDetail>> {
  const gate = await assertJourneyAccess(context);
  if (!gate.ok) return gate;

  const loaded = await loadScopedJourney(context, journeyId);
  if (!loaded.ok) return loaded;

  const { journey } = loaded;
  const summary = serializeSubjectJourneySummary(journey);

  const [notebook, flashcards, explore, assignments] = await Promise.all([
    buildNotebookSection(context, journey),
    buildFlashcardsSection(context, journey),
    buildExploreSection(context, journey),
    buildAssignmentsSection(context, journey),
  ]);

  const reflection = journey.reflection?.confidence
    ? {
        confidence: journey.reflection.confidence,
        studentNote: journey.reflection.studentNote ?? undefined,
      }
    : undefined;

  return {
    ok: true,
    data: {
      ...summary,
      source: {
        lessonSessionId: String(journey.lessonSessionId),
        lessonNoteId: journey.lessonNoteId ? String(journey.lessonNoteId) : undefined,
        schemeItemId: journey.schemeItemId ? String(journey.schemeItemId) : undefined,
        coveredAt: journey.coveredAt.toISOString(),
        teacherName: journey.teacherName ?? undefined,
      },
      notebook,
      flashcards,
      explore,
      extraAi: {
        enabled: true,
        suggestedPrompts: buildSuggestedPrompts(journey.subjectName, journey.topicTitle),
        leoContext: {
          source: "daily_quest_board",
          subjectName: journey.subjectName,
          lessonTitle: journey.topicTitle,
          lessonSessionId: String(journey.lessonSessionId),
          journeyId: String(journey._id),
        },
      },
      assignments,
      reflection,
    },
  };
}

export async function loadScopedSubjectJourney(
  context: LearnMobileStudentContext,
  journeyId: string
) {
  const gate = await assertJourneyAccess(context);
  if (!gate.ok) return gate;
  return loadScopedJourney(context, journeyId);
}

export type { LearnJourneyStepKey };
