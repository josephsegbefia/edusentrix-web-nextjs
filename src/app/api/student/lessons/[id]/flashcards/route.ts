import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { Student } from "@/models/Student";
import { Lesson, type ILesson } from "@/models/Lesson";
import { LessonFlashcardDeck } from "@/models/LessonFlashcardDeck";
import { LessonFlashcard, type ILessonFlashcard } from "@/models/LessonFlashcard";
import { StudentFlashcardProgress } from "@/models/StudentFlashcardProgress";
import type { LessonFlashcardDto, StudentLessonFlashcardsResponse } from "@/types/lesson-flashcards";
import { assertLessonsFeatureEnabled, assertLessonsModuleEnabled } from "@/lib/lessons/settings";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
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

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireSchoolMember({ allowedRoles: ["student"] });
    await connectToDatabase();
    const { id } = await params;
    const moduleGate = await assertLessonsModuleEnabled(context.schoolId);
    if (!moduleGate.ok) {
      return Response.json({ success: false, error: moduleGate.error }, { status: moduleGate.status });
    }
    const featureGate = assertLessonsFeatureEnabled(moduleGate.settings, "enableFlashcards", "Lesson flashcards");
    if (!featureGate.ok) {
      return Response.json({ success: false, error: featureGate.error }, { status: featureGate.status });
    }

    const lessonId = toObjectIdOrNull(id);
    if (!lessonId) {
      return Response.json({ success: false, error: "Invalid lesson ID" }, { status: 400 });
    }

    const student = (await Student.findOne({
      userId: context.userId,
      schoolId: context.schoolId,
      status: "active",
    })
      .select("_id classGroupId")
      .lean()) as { _id: mongoose.Types.ObjectId; classGroupId: mongoose.Types.ObjectId } | null;

    if (!student) {
      return Response.json({ success: false, error: "Student not found" }, { status: 404 });
    }

    const lesson = (await Lesson.findOne({
      _id: lessonId,
      schoolId: context.schoolId,
      classGroupId: student.classGroupId,
      status: "published",
    })
      .select("_id")
      .lean()) as Pick<ILesson, "_id"> | null;

    if (!lesson) {
      return Response.json({ success: false, error: "Lesson not found" }, { status: 404 });
    }

    const deck = await LessonFlashcardDeck.findOne({
      schoolId: context.schoolId,
      lessonId,
      status: "published",
      $or: [
        { publishToClassGroupIds: { $size: 0 } },
        { publishToClassGroupIds: student.classGroupId },
        { publishToClassGroupIds: { $exists: false } },
      ],
      $and: [
        { $or: [{ availableFrom: { $lte: new Date() } }, { availableFrom: null }, { availableFrom: { $exists: false } }] },
        { $or: [{ availableUntil: { $gte: new Date() } }, { availableUntil: null }, { availableUntil: { $exists: false } }] },
      ],
    })
      .select("_id title")
      .lean() as { _id: mongoose.Types.ObjectId; title: string } | null;

    if (!deck) {
      const body: StudentLessonFlashcardsResponse = {
        success: true,
        data: { deck: null, cards: [] },
      };
      return Response.json(body);
    }

    const cards = (await LessonFlashcard.find({
      schoolId: context.schoolId,
      deckId: deck._id,
    })
      .sort({ order: 1, createdAt: 1 })
      .lean()) as ILessonFlashcard[];

    const cardIds = cards.map((c) => c._id);
    const progressRows = cardIds.length
      ? await StudentFlashcardProgress.find({
          schoolId: context.schoolId,
          studentId: student._id,
          flashcardId: { $in: cardIds },
        })
          .select("flashcardId status reviewCount")
          .lean()
      : [];

    const progressByCard = new Map(
      progressRows.map((p) => [
        String((p as { flashcardId: mongoose.Types.ObjectId }).flashcardId),
        {
          status: (p as { status: string }).status,
          reviewCount: (p as { reviewCount: number }).reviewCount,
        },
      ])
    );

    const dataCards = cards.map((c) => {
      const pr = progressByCard.get(String(c._id));
      return {
        ...formatCard(c),
        progress: pr
          ? { status: pr.status as "new" | "learning" | "known" | "needs_review", reviewCount: pr.reviewCount }
          : null,
      };
    });

    const body: StudentLessonFlashcardsResponse = {
      success: true,
      data: {
        deck: { id: String(deck._id), title: deck.title },
        cards: dataCards,
      },
    };

    return Response.json(body);
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to load student lesson flashcards:", e);
    const message = e instanceof Error ? e.message : "Failed to load flashcards";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
