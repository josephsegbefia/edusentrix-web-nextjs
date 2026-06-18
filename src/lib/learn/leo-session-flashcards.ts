import "server-only";

import OpenAI from "openai";
import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { normalizeContentBlocks } from "@/lib/lessons/content-blocks";
import {
  buildSessionFlashcardSystemInstruction,
  buildSessionFlashcardUserPrompt,
  dedupeFlashcardCandidates,
  parseLeoFlashcardResponse,
} from "@/lib/lessons/flashcard-generation";
import {
  publishedClassDeckQuery,
  publishedStudentLeoDeckQuery,
} from "@/lib/learn/student-deck-access";
import { ensureStudentLeoSessionFlashcardDeck } from "@/lib/lessons/flashcard-deck-session";
import { LessonFlashcard } from "@/models/LessonFlashcard";
import { LessonFlashcardDeck } from "@/models/LessonFlashcardDeck";
import type { ILessonSession } from "@/models/LessonSession";

export const LEO_STUDENT_FLASHCARD_MIN = 10;
export const LEO_STUDENT_FLASHCARD_MAX = 12;

export type SessionFlashcardRow = {
  _id: Types.ObjectId;
  front: string;
  back: string;
  order: number;
};

export type ResolvedSessionFlashcards = {
  deckId: Types.ObjectId;
  cards: SessionFlashcardRow[];
  source: "teacher_class" | "leo_student";
};

function stripHtml(html: string, maxLen = 400) {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1)}…`;
}

function sessionContentSummary(session: Pick<ILessonSession, "title" | "planNotes" | "contentBlocks">) {
  const blocks = normalizeContentBlocks(session.contentBlocks ?? []);
  return blocks
    .slice(0, 12)
    .map((b) => `${b.type}: ${b.title || ""}\n${stripHtml(b.bodyHtml ?? "")}`)
    .join("\n\n");
}

async function loadClassPublishedCards(input: {
  schoolId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  sessionId: Types.ObjectId;
  limit?: number;
}) {
  const deck = await LessonFlashcardDeck.findOne(
    publishedClassDeckQuery({
      schoolId: input.schoolId,
      classGroupId: input.classGroupId,
      sessionId: input.sessionId,
    })
  )
    .select("_id")
    .lean<{ _id: Types.ObjectId } | null>();

  if (!deck) return null;

  const cards = await LessonFlashcard.find({
    schoolId: input.schoolId,
    deckId: deck._id,
  })
    .sort({ order: 1 })
    .limit(input.limit ?? 30)
    .select("_id front back order")
    .lean<SessionFlashcardRow[]>();

  if (cards.length === 0) return null;

  return { deckId: deck._id, cards, source: "teacher_class" as const };
}

async function loadStudentLeoCards(input: {
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  sessionId: Types.ObjectId;
  limit?: number;
}) {
  const deck = await LessonFlashcardDeck.findOne(
    publishedStudentLeoDeckQuery({
      schoolId: input.schoolId,
      studentId: input.studentId,
      sessionId: input.sessionId,
    })
  )
    .select("_id")
    .lean<{ _id: Types.ObjectId } | null>();

  if (!deck) return null;

  const cards = await LessonFlashcard.find({
    schoolId: input.schoolId,
    deckId: deck._id,
  })
    .sort({ order: 1 })
    .limit(input.limit ?? 30)
    .select("_id front back order")
    .lean<SessionFlashcardRow[]>();

  if (cards.length < LEO_STUDENT_FLASHCARD_MIN) return null;

  return { deckId: deck._id, cards, source: "leo_student" as const };
}

async function generateLeoFlashcardDrafts(
  session: Pick<ILessonSession, "title" | "planNotes" | "contentBlocks">,
  maxCards: number
): Promise<Array<{ front: string; back: string }> | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  const contentSummary = sessionContentSummary(session);
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are Leo, a warm learning companion for Ghanaian school students.\n${buildSessionFlashcardSystemInstruction(maxCards)}`,
        },
        {
          role: "user",
          content: buildSessionFlashcardUserPrompt({
            title: session.title,
            planNotes: session.planNotes?.slice(0, 1200) || "",
            contentSummary: contentSummary || "(summary from lesson title only)",
            maxCards,
            existingCards: [],
          }),
        },
      ],
      temperature: 0.65,
      response_format: { type: "json_object" },
      max_tokens: 3500,
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) return null;

    let data: unknown;
    try {
      data = JSON.parse(responseText);
    } catch {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (!match) return null;
      data = JSON.parse(match[0]);
    }

    const parsed = parseLeoFlashcardResponse(data);
    const { unique } = dedupeFlashcardCandidates(parsed, []);

    return unique.length >= LEO_STUDENT_FLASHCARD_MIN ? unique.slice(0, maxCards) : null;
  } catch (e) {
    console.error("[leo-session-flashcards] OpenAI", e);
    return null;
  }
}

async function persistStudentLeoDeck(input: {
  schoolId: Types.ObjectId;
  sessionId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  studentId: Types.ObjectId;
  teacherId: Types.ObjectId;
  sessionTitle: string;
  cards: Array<{ front: string; back: string }>;
}) {
  const existing = await LessonFlashcardDeck.findOne({
    schoolId: input.schoolId,
    sessionId: input.sessionId,
    generatedForStudentId: input.studentId,
  })
    .select("_id")
    .lean<{ _id: Types.ObjectId } | null>();

  const deckDoc = await ensureStudentLeoSessionFlashcardDeck({
    schoolId: input.schoolId,
    sessionId: input.sessionId,
    studentId: input.studentId,
    teacherId: input.teacherId,
    sessionTitle: input.sessionTitle,
    classGroupId: input.classGroupId,
  });
  const deck = { _id: deckDoc._id };

  if (existing) {
    await LessonFlashcardDeck.updateOne(
      { _id: deck._id },
      {
        $set: {
          status: "published",
          title: `${input.sessionTitle} — Leo cards`,
        },
      }
    );
    await LessonFlashcard.deleteMany({
      schoolId: input.schoolId,
      deckId: deck._id,
    });
  }

  const docs = input.cards.map((card, index) => ({
    schoolId: input.schoolId,
    sessionId: input.sessionId,
    deckId: deck!._id,
    front: card.front,
    back: card.back,
    difficulty: "medium" as const,
    cardType: "qa" as const,
    order: index,
  }));

  await LessonFlashcard.insertMany(docs);

  const saved = await LessonFlashcard.find({
    schoolId: input.schoolId,
    deckId: deck._id,
  })
    .sort({ order: 1 })
    .select("_id front back order")
    .lean<SessionFlashcardRow[]>();

  return {
    deckId: deck._id,
    cards: saved,
    source: "leo_student" as const,
  };
}

/**
 * Flashcards for a covered lesson session:
 * 1) Teacher-published class deck (all students in the class)
 * 2) Else Leo-generated deck stored for this student (reused on later visits)
 */
export async function resolveSessionFlashcardsForStudent(input: {
  schoolId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  studentId: Types.ObjectId;
  session: Pick<
    ILessonSession,
    "_id" | "title" | "planNotes" | "contentBlocks" | "ownerTeacherId"
  >;
  cardLimit?: number;
  generateIfMissing?: boolean;
}): Promise<ResolvedSessionFlashcards | null> {
  await connectToDatabase();

  const limit = input.cardLimit ?? LEO_STUDENT_FLASHCARD_MAX;
  const sessionId = input.session._id;

  const classDeck = await loadClassPublishedCards({
    schoolId: input.schoolId,
    classGroupId: input.classGroupId,
    sessionId,
    limit,
  });
  if (classDeck) {
    return {
      deckId: classDeck.deckId,
      cards: classDeck.cards.slice(0, limit),
      source: classDeck.source,
    };
  }

  const studentDeck = await loadStudentLeoCards({
    schoolId: input.schoolId,
    studentId: input.studentId,
    sessionId,
    limit,
  });
  if (studentDeck) {
    return {
      deckId: studentDeck.deckId,
      cards: studentDeck.cards.slice(0, limit),
      source: studentDeck.source,
    };
  }

  if (input.generateIfMissing === false) return null;

  const drafts = await generateLeoFlashcardDrafts(
    input.session,
    Math.max(LEO_STUDENT_FLASHCARD_MIN, limit)
  );
  if (!drafts) return null;

  return persistStudentLeoDeck({
    schoolId: input.schoolId,
    sessionId,
    classGroupId: input.classGroupId,
    studentId: input.studentId,
    teacherId: input.session.ownerTeacherId,
    sessionTitle: input.session.title,
    cards: drafts,
  });
}
