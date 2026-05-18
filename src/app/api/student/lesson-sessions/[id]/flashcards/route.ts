import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { Student } from "@/models/Student";
import { LessonSession } from "@/models/LessonSession";
import { LessonFlashcardDeck } from "@/models/LessonFlashcardDeck";
import { LessonFlashcard, type ILessonFlashcard } from "@/models/LessonFlashcard";
import { StudentFlashcardProgress } from "@/models/StudentFlashcardProgress";
import type { StudentLessonFlashcardsResponse } from "@/types/lesson-flashcards";
import { assertLessonsFeatureEnabled, assertLessonsModuleEnabled } from "@/lib/lessons/settings";
import { formatFlashcard } from "@/lib/lessons/format-flashcards";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireSchoolMember({ allowedRoles: ["student"] });
    await connectToDatabase();
    const moduleGate = await assertLessonsModuleEnabled(context.schoolId);
    if (!moduleGate.ok) {
      return Response.json({ success: false, error: moduleGate.error }, { status: moduleGate.status });
    }
    const featureGate = assertLessonsFeatureEnabled(
      moduleGate.settings,
      "enableFlashcards",
      "Lesson flashcards",
    );
    if (!featureGate.ok) {
      return Response.json({ success: false, error: featureGate.error }, { status: featureGate.status });
    }

    const { id } = await params;
    const sessionId = toObjectIdOrNull(id);
    if (!sessionId) {
      return Response.json({ success: false, error: "Invalid session ID" }, { status: 400 });
    }

    const student = await Student.findOne({
      userId: context.userId,
      schoolId: context.schoolId,
      status: "active",
    })
      .select("_id classGroupId")
      .lean();

    if (!student?.classGroupId) {
      return Response.json({ success: false, error: "Student not found" }, { status: 404 });
    }

    const session = await LessonSession.findOne({
      _id: sessionId,
      schoolId: context.schoolId,
      classGroupId: student.classGroupId,
      studentVisibility: "published",
    })
      .select("_id")
      .lean();

    if (!session) {
      return Response.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    const deck = await LessonFlashcardDeck.findOne({
      schoolId: context.schoolId,
      sessionId,
    }).lean();

    if (!deck) {
      const empty: StudentLessonFlashcardsResponse = {
        success: true,
        data: { deck: null, cards: [] },
      };
      return Response.json(empty);
    }

    const cards = (await LessonFlashcard.find({
      schoolId: context.schoolId,
      deckId: deck._id,
    })
      .sort({ order: 1, createdAt: 1 })
      .lean()) as ILessonFlashcard[];

    const progressRows = await StudentFlashcardProgress.find({
      schoolId: context.schoolId,
      studentId: student._id,
      cardId: { $in: cards.map((c) => c._id) },
    }).lean();

    const progressByCard = new Map(progressRows.map((p) => [String(p.cardId), p]));

    const body: StudentLessonFlashcardsResponse = {
      success: true,
      data: {
        deck: { id: String(deck._id), title: deck.title },
        cards: cards.map((c) => {
          const progress = progressByCard.get(String(c._id));
          return {
            ...formatFlashcard(c),
            progress: progress
              ? { status: progress.status, reviewCount: progress.reviewCount ?? 0 }
              : null,
          };
        }),
      },
    };
    return Response.json(body);
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[student lesson-sessions flashcards]", e);
    const message = e instanceof Error ? e.message : "Failed to load flashcards";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
