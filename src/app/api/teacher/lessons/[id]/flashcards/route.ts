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
import { assertLessonsFeatureEnabled, assertLessonsModuleEnabled } from "@/lib/lessons/settings";
import { recordLessonAudit } from "@/lib/lessons/lesson-audit";

const CreateCardSchema = z.object({
  front: z.string().trim().min(1).max(4000),
  back: z.string().trim().min(1).max(4000),
  hint: z.string().trim().max(2000).optional().nullable(),
  explanation: z.string().trim().max(4000).optional().nullable(),
  imageUrl: z.string().trim().url().max(2000).optional().nullable(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional().nullable(),
  cardType: z.enum(["qa", "term_definition", "image_prompt", "concept_example"]).optional().nullable(),
});

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function formatDeck(d: {
  _id: mongoose.Types.ObjectId;
  lessonId: mongoose.Types.ObjectId;
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
    lessonId: String(d.lessonId),
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

function formatCard(c: ILessonFlashcard): LessonFlashcardDto {
  return {
    id: String(c._id),
    deckId: String(c.deckId),
    lessonId: String(c.lessonId),
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
    const moduleGate = await assertLessonsModuleEnabled(context.schoolId);
    if (!moduleGate.ok) {
      return Response.json({ success: false, error: moduleGate.error }, { status: moduleGate.status });
    }
    const featureGate = assertLessonsFeatureEnabled(moduleGate.settings, "enableFlashcards", "Lesson flashcards");
    if (!featureGate.ok) {
      return Response.json({ success: false, error: featureGate.error }, { status: featureGate.status });
    }

    if (!can(context.permissions, PERMISSIONS.lessonFlashcardsRead)) {
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
    const moduleGate = await assertLessonsModuleEnabled(context.schoolId);
    if (!moduleGate.ok) {
      return Response.json({ success: false, error: moduleGate.error }, { status: moduleGate.status });
    }
    const featureGate = assertLessonsFeatureEnabled(moduleGate.settings, "enableFlashcards", "Lesson flashcards");
    if (!featureGate.ok) {
      return Response.json({ success: false, error: featureGate.error }, { status: featureGate.status });
    }

    if (!can(context.permissions, PERMISSIONS.lessonFlashcardsManage)) {
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
      hint: parsed.data.hint?.trim() || undefined,
      explanation: parsed.data.explanation?.trim() || undefined,
      imageUrl: parsed.data.imageUrl?.trim() || undefined,
      difficulty: parsed.data.difficulty ?? "medium",
      cardType: parsed.data.cardType ?? "qa",
      order: nextOrder,
    });

    void recordLessonAudit({
      schoolId: context.schoolId,
      lessonId,
      actorId: context.userId,
      action: "flashcard_added",
      metadata: { deckId: String(deckDoc._id), cardId: String(created._id) },
      httpRequest: req,
      actorRole: context.isAdmin ? "school_admin" : "teacher",
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
