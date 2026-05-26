import "server-only";

import { Types } from "mongoose";
import { classSessionDeckFilter } from "@/lib/lessons/flashcard-deck-session";

/** Decks auto-published on delivery complete often have an empty publishToClassGroupIds array. */
export function publishedDeckFilterForClass(classGroupId: Types.ObjectId) {
  return {
    $or: [
      { publishToClassGroupIds: { $size: 0 } },
      { publishToClassGroupIds: classGroupId },
    ],
  };
}

export function deckAvailableAtFilter(now = new Date()) {
  return {
    $or: [
      { availableFrom: { $exists: false } },
      { availableFrom: null },
      { availableFrom: { $lte: now } },
    ],
  };
}

/** Teacher/class deck visible to all students in publishToClassGroupIds. */
export function publishedClassDeckQuery(input: {
  schoolId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  sessionId?: Types.ObjectId;
  deckId?: Types.ObjectId;
  now?: Date;
}) {
  const query: Record<string, unknown> = {
    status: "published",
    $and: [
      input.sessionId
        ? classSessionDeckFilter(input.schoolId, input.sessionId)
        : {
            schoolId: input.schoolId,
            $or: [
              { generatedForStudentId: null },
              { generatedForStudentId: { $exists: false } },
            ],
          },
      publishedDeckFilterForClass(input.classGroupId),
      deckAvailableAtFilter(input.now),
    ],
  };
  if (!input.sessionId) {
    (query as { schoolId?: Types.ObjectId }).schoolId = input.schoolId;
  }
  if (input.deckId) query._id = input.deckId;
  return query;
}

/** @deprecated Use publishedClassDeckQuery — class-wide decks only. */
export const publishedStudentDeckQuery = publishedClassDeckQuery;

export function publishedStudentLeoDeckQuery(input: {
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  sessionId?: Types.ObjectId;
  deckId?: Types.ObjectId;
}) {
  const query: Record<string, unknown> = {
    schoolId: input.schoolId,
    status: "published",
    generatedForStudentId: input.studentId,
  };
  if (input.sessionId) query.sessionId = input.sessionId;
  if (input.deckId) query._id = input.deckId;
  return query;
}

export function studentCanAccessPublishedDeck(
  deck: {
    generatedForStudentId?: Types.ObjectId | null;
    publishToClassGroupIds?: Types.ObjectId[];
    status?: string;
    availableFrom?: Date | null;
    availableUntil?: Date | null;
  },
  context: { studentId: Types.ObjectId; classGroupId: Types.ObjectId | null },
  now = new Date()
) {
  if (deck.status !== "published") return false;
  if (deck.availableFrom && deck.availableFrom > now) return false;
  if (deck.availableUntil && deck.availableUntil < now) return false;

  if (deck.generatedForStudentId) {
    return String(deck.generatedForStudentId) === String(context.studentId);
  }

  if (!context.classGroupId) return false;
  const groups = deck.publishToClassGroupIds ?? [];
  if (groups.length === 0) return true;
  return groups.some((id) => String(id) === String(context.classGroupId));
}
