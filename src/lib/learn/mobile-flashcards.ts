import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import { getStudentLearnAccess } from "@/lib/learn/access";
import { recordLearnMobileActivity } from "@/lib/learn/mobile-activity";
import { studentCanAccessPublishedDeck } from "@/lib/learn/student-deck-access";
import { LessonFlashcard } from "@/models/LessonFlashcard";
import { LessonFlashcardDeck } from "@/models/LessonFlashcardDeck";
import { LessonSession } from "@/models/LessonSession";
import { StudentFlashcardProgress, type FlashcardProgressStatus } from "@/models/StudentFlashcardProgress";
import { SubjectOffering } from "@/models/SubjectOffering";

type DeckRow = {
  _id: Types.ObjectId;
  title: string;
  description?: string | null;
  status: string;
  sessionId?: Types.ObjectId | null;
  generatedForStudentId?: Types.ObjectId | null;
  subjectOfferingId?: Types.ObjectId | null;
  publishToClassGroupIds: Types.ObjectId[];
  availableFrom?: Date | null;
  availableUntil?: Date | null;
};

type CardRow = {
  _id: Types.ObjectId;
  deckId: Types.ObjectId;
  front: string;
  back: string;
  hint?: string | null;
  explanation?: string | null;
  order: number;
};

type ProgressRow = {
  flashcardId: Types.ObjectId;
  deckId: Types.ObjectId;
  status: FlashcardProgressStatus;
  lastReviewedAt?: Date | null;
};

function isDeckAvailable(deck: DeckRow, now = new Date()) {
  if (deck.status !== "published") return false;
  if (deck.availableFrom && deck.availableFrom > now) return false;
  if (deck.availableUntil && deck.availableUntil < now) return false;
  return true;
}

function mapProgressToMobile(status?: FlashcardProgressStatus | null): string {
  if (!status || status === "new") return "new";
  if (status === "known") return "known";
  if (status === "needs_review") return "needs_practice";
  return "learning";
}

function mapMobileToProgress(status: "known" | "needs_practice" | "learning" | "new"): FlashcardProgressStatus {
  if (status === "known") return "known";
  if (status === "needs_practice") return "needs_review";
  if (status === "new") return "new";
  return "learning";
}

async function assertFlashcardAccess(context: LearnMobileStudentContext) {
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

  return { ok: true as const, access };
}

async function loadPublishedDecks(context: LearnMobileStudentContext) {
  const now = new Date();
  const decks = await LessonFlashcardDeck.find({
    schoolId: context.schoolId,
    status: "published",
    $or: [
      {
        $and: [
          {
            $or: [
              { generatedForStudentId: null },
              { generatedForStudentId: { $exists: false } },
            ],
          },
          {
            $or: [
              { publishToClassGroupIds: { $size: 0 } },
              { publishToClassGroupIds: context.classGroupId },
            ],
          },
        ],
      },
      { generatedForStudentId: context.studentId },
    ],
  })
    .sort({ updatedAt: -1 })
    .lean<DeckRow[]>();

  return decks.filter(
    (deck) =>
      isDeckAvailable(deck, now) &&
      studentCanAccessPublishedDeck(deck, {
        studentId: context.studentId,
        classGroupId: context.classGroupId,
      }, now)
  );
}

async function resolveDeckContext(
  schoolId: Types.ObjectId,
  deck: DeckRow
) {
  let subjectName = "Subject";
  let topicName = deck.title;
  let sourceLessonTitle: string | undefined;

  if (deck.sessionId) {
    const session = await LessonSession.findOne({ _id: deck.sessionId, schoolId })
      .select("title subjectOfferingId")
      .lean<{ title?: string; subjectOfferingId?: Types.ObjectId } | null>();

    if (session) {
      sourceLessonTitle = session.title;
      topicName = session.title;
      if (session.subjectOfferingId) {
        const offering = await SubjectOffering.findOne({
          _id: session.subjectOfferingId,
          schoolId,
        })
          .select("displayName shortName")
          .lean<{ displayName?: string; shortName?: string } | null>();
        subjectName = offering?.shortName || offering?.displayName || subjectName;
      }
    }
  }

  return {
    subjectId: deck.sessionId ? String(deck.sessionId) : String(deck._id),
    subjectName,
    topicName,
    sourceLessonTitle,
  };
}

async function buildDeckSummary(
  context: LearnMobileStudentContext,
  deck: DeckRow,
  progressRows: ProgressRow[]
) {
  const cards = await LessonFlashcard.find({ schoolId: context.schoolId, deckId: deck._id })
    .select("_id")
    .lean<Array<{ _id: Types.ObjectId }>>();

  const progressMap = new Map(progressRows.map((p) => [String(p.flashcardId), p]));
  let masteredCards = 0;
  let needsPracticeCards = 0;
  let lastReviewedAt: Date | undefined;

  for (const card of cards) {
    const progress = progressMap.get(String(card._id));
    if (!progress) continue;
    if (progress.status === "known") masteredCards += 1;
    if (progress.status === "needs_review") needsPracticeCards += 1;
    if (progress.lastReviewedAt) {
      if (!lastReviewedAt || progress.lastReviewedAt > lastReviewedAt) {
        lastReviewedAt = progress.lastReviewedAt;
      }
    }
  }

  const meta = await resolveDeckContext(context.schoolId, deck);

  return {
    id: String(deck._id),
    title: deck.title,
    subjectId: meta.subjectId,
    subjectName: meta.subjectName,
    topicName: meta.topicName,
    totalCards: cards.length,
    masteredCards,
    needsPracticeCards,
    lastReviewedAt: lastReviewedAt?.toISOString(),
    sourceLessonTitle: meta.sourceLessonTitle,
  };
}

export async function buildMobileFlashcardDecksList(context: LearnMobileStudentContext) {
  await connectToDatabase();
  const gate = await assertFlashcardAccess(context);
  if (!gate.ok) return gate;

  const decks = await loadPublishedDecks(context);
  const deckIds = decks.map((d) => d._id);

  const allProgress = await StudentFlashcardProgress.find({
    schoolId: context.schoolId,
    studentId: context.studentId,
    deckId: { $in: deckIds },
  })
    .select("flashcardId deckId status lastReviewedAt")
    .lean<ProgressRow[]>();

  const progressByDeck = new Map<string, ProgressRow[]>();
  for (const row of allProgress) {
    const key = String(row.deckId);
    const list = progressByDeck.get(key) ?? [];
    list.push(row);
    progressByDeck.set(key, list);
  }

  const summaries = await Promise.all(
    decks.map((deck) =>
      buildDeckSummary(context, deck, progressByDeck.get(String(deck._id)) ?? [])
    )
  );

  return {
    ok: true as const,
    data: {
      header: {
        title: "Flashcards",
        leoTip:
          "Leo suggests quick review sessions. Mark cards honestly so weak ideas come back later.",
      },
      decks: summaries,
    },
  };
}

export async function buildMobileFlashcardDeckDetail(
  context: LearnMobileStudentContext,
  deckId: string
) {
  await connectToDatabase();
  const gate = await assertFlashcardAccess(context);
  if (!gate.ok) return gate;

  if (!Types.ObjectId.isValid(deckId)) {
    return { ok: false as const, code: "DECK_NOT_FOUND", message: "Deck not found.", status: 404 };
  }

  const deck = await LessonFlashcardDeck.findOne({
    _id: new Types.ObjectId(deckId),
    schoolId: context.schoolId,
    status: "published",
  }).lean<DeckRow | null>();

  if (
    !deck ||
    !isDeckAvailable(deck) ||
    !studentCanAccessPublishedDeck(deck, {
      studentId: context.studentId,
      classGroupId: context.classGroupId,
    })
  ) {
    return { ok: false as const, code: "DECK_NOT_FOUND", message: "Deck not found.", status: 404 };
  }

  const [cards, progressRows] = await Promise.all([
    LessonFlashcard.find({ schoolId: context.schoolId, deckId: deck._id })
      .sort({ order: 1 })
      .lean<CardRow[]>(),
    StudentFlashcardProgress.find({
      schoolId: context.schoolId,
      studentId: context.studentId,
      deckId: deck._id,
    })
      .select("flashcardId status lastReviewedAt")
      .lean<ProgressRow[]>(),
  ]);

  const progressMap = new Map(progressRows.map((p) => [String(p.flashcardId), p]));
  const deckSummary = await buildDeckSummary(context, deck, progressRows);

  return {
    ok: true as const,
    data: {
      deck: deckSummary,
      leoTip: "Flip the card, say the answer out loud, then choose how well you knew it.",
      cards: cards.map((card) => {
        const progress = progressMap.get(String(card._id));
        return {
          id: String(card._id),
          deckId: String(deck._id),
          front: card.front,
          back: card.back,
          hint: card.hint ?? undefined,
          example: card.explanation ?? undefined,
          status: mapProgressToMobile(progress?.status),
        };
      }),
    },
  };
}

const DEFAULT_FLASHCARD_REVIEW_SECONDS = 45;

export async function reviewMobileFlashcard(
  context: LearnMobileStudentContext,
  cardId: string,
  rating: "known" | "needs_practice" | "learning" | "new",
  elapsedSeconds?: number
) {
  await connectToDatabase();
  const gate = await assertFlashcardAccess(context);
  if (!gate.ok) return gate;

  if (!Types.ObjectId.isValid(cardId)) {
    return { ok: false as const, code: "DECK_NOT_FOUND", message: "Card not found.", status: 404 };
  }

  const card = await LessonFlashcard.findOne({
    _id: new Types.ObjectId(cardId),
    schoolId: context.schoolId,
  }).lean<CardRow | null>();

  if (!card) {
    return { ok: false as const, code: "DECK_NOT_FOUND", message: "Card not found.", status: 404 };
  }

  const deck = await LessonFlashcardDeck.findOne({
    _id: card.deckId,
    schoolId: context.schoolId,
    status: "published",
  }).lean<DeckRow | null>();

  if (
    !deck ||
    !isDeckAvailable(deck) ||
    !studentCanAccessPublishedDeck(deck, {
      studentId: context.studentId,
      classGroupId: context.classGroupId,
    })
  ) {
    return { ok: false as const, code: "DECK_NOT_FOUND", message: "Deck not available.", status: 403 };
  }

  const status = mapMobileToProgress(rating);
  const now = new Date();

  await StudentFlashcardProgress.findOneAndUpdate(
    {
      schoolId: context.schoolId,
      studentId: context.studentId,
      flashcardId: card._id,
    },
    {
      $set: {
        schoolId: context.schoolId,
        studentId: context.studentId,
        deckId: card.deckId,
        flashcardId: card._id,
        status,
        lastReviewedAt: now,
      },
      $inc: { reviewCount: 1 },
    },
    { upsert: true }
  );

  const durationSeconds =
    typeof elapsedSeconds === "number" && elapsedSeconds > 0
      ? elapsedSeconds
      : DEFAULT_FLASHCARD_REVIEW_SECONDS;

  await recordLearnMobileActivity({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
    gradeId: context.gradeId,
    classGroupId: context.classGroupId,
    eventType: "flashcard_reviewed",
    topic: deck.title,
    durationSeconds,
    metadata: { cardId: String(card._id), deckId: String(deck._id), rating },
  });

  const progressRows = await StudentFlashcardProgress.find({
    schoolId: context.schoolId,
    studentId: context.studentId,
    deckId: deck._id,
  })
    .select("flashcardId status lastReviewedAt")
    .lean<ProgressRow[]>();

  const deckSummary = await buildDeckSummary(context, deck, progressRows);

  return {
    ok: true as const,
    data: {
      cardId: String(card._id),
      status: mapProgressToMobile(status),
      deck: deckSummary,
    },
  };
}

export async function startMobileFlashcardSession(
  context: LearnMobileStudentContext,
  deckId: string
) {
  const detail = await buildMobileFlashcardDeckDetail(context, deckId);
  if (!detail.ok) return detail;

  const sessionId = `fc-${deckId}-${Date.now()}`;

  await recordLearnMobileActivity({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
    gradeId: context.gradeId,
    classGroupId: context.classGroupId,
    eventType: "flashcard_reviewed",
    topic: detail.data.deck.title,
    metadata: { phase: "session_started", sessionId, deckId },
  });

  return {
    ok: true as const,
    data: {
      sessionId,
      deckId,
      startedAt: new Date().toISOString(),
      cardCount: detail.data.cards.length,
    },
  };
}
