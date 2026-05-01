import type { Types } from "mongoose";
import { LessonFlashcardDeck, type ILessonFlashcardDeck } from "@/models/LessonFlashcardDeck";

/**
 * Ensure there is exactly one flashcard deck per lesson (MVP).
 */
export async function getOrCreateLessonFlashcardDeck(
  schoolId: Types.ObjectId,
  lessonId: Types.ObjectId,
  teacherId: Types.ObjectId
): Promise<ILessonFlashcardDeck> {
  const existing = await LessonFlashcardDeck.findOne({ schoolId, lessonId }).lean();
  if (existing) {
    return existing as ILessonFlashcardDeck;
  }

  try {
    const created = await LessonFlashcardDeck.create({
      schoolId,
      lessonId,
      teacherId,
      title: "Flashcards",
    });
    return created.toObject() as ILessonFlashcardDeck;
  } catch (e) {
    const again = await LessonFlashcardDeck.findOne({ schoolId, lessonId }).lean();
    if (again) {
      return again as ILessonFlashcardDeck;
    }
    throw e;
  }
}
