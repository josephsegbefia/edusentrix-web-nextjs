import type mongoose from "mongoose";
import type { ILessonFlashcard } from "@/models/LessonFlashcard";
import type { LessonFlashcardDeckDto, LessonFlashcardDto } from "@/types/lesson-flashcards";

export function formatFlashcardDeck(d: {
  _id: mongoose.Types.ObjectId;
  lessonId?: mongoose.Types.ObjectId | null;
  sessionId?: mongoose.Types.ObjectId | null;
  title: string;
  description?: string;
  status?: "draft" | "published" | "archived";
  publishToClassGroupIds?: mongoose.Types.ObjectId[];
  availableFrom?: Date;
  availableUntil?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}): LessonFlashcardDeckDto {
  return {
    id: String(d._id),
    lessonId: d.lessonId ? String(d.lessonId) : null,
    sessionId: d.sessionId ? String(d.sessionId) : null,
    title: d.title,
    description: d.description ?? null,
    status: d.status ?? "draft",
    publishToClassGroupIds: (d.publishToClassGroupIds ?? []).map((id) => String(id)),
    availableFrom: d.availableFrom ? new Date(d.availableFrom).toISOString() : null,
    availableUntil: d.availableUntil ? new Date(d.availableUntil).toISOString() : null,
    createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
    updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : null,
  };
}

export function formatFlashcard(c: ILessonFlashcard): LessonFlashcardDto {
  return {
    id: String(c._id),
    deckId: String(c.deckId),
    lessonId: c.lessonId ? String(c.lessonId) : null,
    sessionId: c.sessionId ? String(c.sessionId) : null,
    front: c.front,
    back: c.back,
    hint: c.hint ?? null,
    explanation: c.explanation ?? null,
    imageUrl: c.imageUrl ?? null,
    difficulty: c.difficulty ?? null,
    cardType: c.cardType ?? null,
    order: c.order,
    createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : null,
    updatedAt: c.updatedAt ? new Date(c.updatedAt).toISOString() : null,
  };
}
