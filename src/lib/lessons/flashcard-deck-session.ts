import type { Types } from "mongoose";
import {
  LessonFlashcardDeck,
  type ILessonFlashcardDeck,
} from "@/models/LessonFlashcardDeck";

/** One flashcard deck per lesson session (v2). */
export async function getOrCreateSessionFlashcardDeck(
  schoolId: Types.ObjectId,
  sessionId: Types.ObjectId,
  teacherId: Types.ObjectId,
): Promise<ILessonFlashcardDeck> {
  const existing = await LessonFlashcardDeck.findOne({ schoolId, sessionId }).lean();
  if (existing) {
    return existing as ILessonFlashcardDeck;
  }

  try {
    const created = await LessonFlashcardDeck.create({
      schoolId,
      sessionId,
      teacherId,
      title: "Flashcards",
    });
    return created.toObject() as ILessonFlashcardDeck;
  } catch (e) {
    const again = await LessonFlashcardDeck.findOne({ schoolId, sessionId }).lean();
    if (again) {
      return again as ILessonFlashcardDeck;
    }
    throw e;
  }
}
