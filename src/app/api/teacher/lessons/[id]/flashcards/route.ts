import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { Lesson, type ILesson } from "@/models/Lesson";
import { LessonFlashcard, type ILessonFlashcard } from "@/models/LessonFlashcard";
import { getOrCreateLessonFlashcardDeck } from "@/lib/lessons/flashcard-deck";
import type { LessonFlashcardDeckDto, LessonFlashcardDto } from "@/types/lesson-flashcards";

const CreateCardSchema = z.object({
  front: z.string().trim().min(1).max(4000),
  back: z.string().trim().min(1).max(4000),
});

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function formatDeck(d: { _id: mongoose.Types.ObjectId; lessonId: mongoose.Types.ObjectId; title: string; createdAt?: Date; updatedAt?: Date }): LessonFlashcardDeckDto {
  return {
    id: String(d._id),
    lessonId: String(d.lessonId),
    title: d.title,
    createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
    updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : null,
  };
}

function formatCard(c: ILessonFlashcard): LessonFlashcardDto {
  return {
    id: String(c._id),
    deckId: String(c.deckId),
    lessonId: String(c.lessonId),
    front: c.front,
    back: c.back,
    order: c.order,
    createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : null,
    updatedAt: c.updatedAt ? new Date(c.updatedAt).toISOString() : null,
  };
}

async function loadLessonForTeacherLessonId(
  lessonId: mongoose.Types.ObjectId,
  schoolId: mongoose.Types.ObjectId,
  teacherId: mongoose.Types.ObjectId
) {
  return Lesson.findOne({
    _id: lessonId,
    schoolId,
    teacherId,
  })
    .select("_id")
    .lean() as Promise<Pick<ILesson, "_id"> | null>;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.journalView)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const lessonId = toObjectIdOrNull(id);
    if (!lessonId) {
      return Response.json({ success: false, error: "Invalid lesson ID" }, { status: 400 });
    }

    const lesson = await loadLessonForTeacherLessonId(lessonId, context.schoolId, context.teacherId);
    if (!lesson) {
      return Response.json({ success: false, error: "Lesson not found" }, { status: 404 });
    }

    const deckDoc = await getOrCreateLessonFlashcardDeck(
      context.schoolId,
      lessonId,
      context.teacherId
    );

    const cards = (await LessonFlashcard.find({
      schoolId: context.schoolId,
      deckId: deckDoc._id,
    })
      .sort({ order: 1, createdAt: 1 })
      .lean()) as ILessonFlashcard[];

    return Response.json({
      success: true,
      data: {
        deck: formatDeck(deckDoc),
        cards: cards.map(formatCard),
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to load lesson flashcards:", e);
    const message = e instanceof Error ? e.message : "Failed to load flashcards";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.journalWrite)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const lessonId = toObjectIdOrNull(id);
    if (!lessonId) {
      return Response.json({ success: false, error: "Invalid lesson ID" }, { status: 400 });
    }

    const lesson = await loadLessonForTeacherLessonId(lessonId, context.schoolId, context.teacherId);
    if (!lesson) {
      return Response.json({ success: false, error: "Lesson not found" }, { status: 404 });
    }

    const raw = await req.json().catch(() => null);
    const parsed = CreateCardSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues?.map((i) => i.message).join(", ") || "Invalid data";
      return Response.json({ success: false, error: `Validation failed: ${msg}` }, { status: 400 });
    }

    const deckDoc = await getOrCreateLessonFlashcardDeck(
      context.schoolId,
      lessonId,
      context.teacherId
    );

    const maxOrder = await LessonFlashcard.findOne({
      schoolId: context.schoolId,
      deckId: deckDoc._id,
    })
      .sort({ order: -1 })
      .select("order")
      .lean() as { order?: number } | null;

    const nextOrder = (maxOrder?.order ?? -1) + 1;

    const created = await LessonFlashcard.create({
      schoolId: context.schoolId,
      lessonId,
      deckId: deckDoc._id,
      front: parsed.data.front,
      back: parsed.data.back,
      order: nextOrder,
    });

    return Response.json({
      success: true,
      data: { id: String(created._id) },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to create flashcard:", e);
    const message = e instanceof Error ? e.message : "Failed to create flashcard";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
