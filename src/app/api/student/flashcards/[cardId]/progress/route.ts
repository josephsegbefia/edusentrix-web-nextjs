import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { Student } from "@/models/Student";
import { Lesson, type ILesson } from "@/models/Lesson";
import { LessonFlashcard, type ILessonFlashcard } from "@/models/LessonFlashcard";
import { StudentFlashcardProgress, type FlashcardProgressStatus } from "@/models/StudentFlashcardProgress";

const ProgressSchema = z.object({
  status: z.enum(["new", "learning", "known", "needs_review"]),
});

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ cardId: string }> }) {
  try {
    const context = await requireSchoolMember({ allowedRoles: ["student"] });
    await connectToDatabase();
    const { cardId } = await params;

    const flashcardId = toObjectIdOrNull(cardId);
    if (!flashcardId) {
      return Response.json({ success: false, error: "Invalid flashcard ID" }, { status: 400 });
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

    const card = (await LessonFlashcard.findOne({
      _id: flashcardId,
      schoolId: context.schoolId,
    }).lean()) as ILessonFlashcard | null;

    if (!card) {
      return Response.json({ success: false, error: "Flashcard not found" }, { status: 404 });
    }

    const lesson = (await Lesson.findOne({
      _id: card.lessonId,
      schoolId: context.schoolId,
      classGroupId: student.classGroupId,
      status: "published",
    })
      .select("_id")
      .lean()) as Pick<ILesson, "_id"> | null;

    if (!lesson) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const raw = await req.json().catch(() => null);
    const parsed = ProgressSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues?.map((i) => i.message).join(", ") || "Invalid data";
      return Response.json({ success: false, error: `Validation failed: ${msg}` }, { status: 400 });
    }

    const status = parsed.data.status as FlashcardProgressStatus;
    const now = new Date();

    await StudentFlashcardProgress.findOneAndUpdate(
      {
        schoolId: context.schoolId,
        studentId: student._id,
        flashcardId: card._id,
      },
      {
        $set: {
          schoolId: context.schoolId,
          studentId: student._id,
          deckId: card.deckId,
          flashcardId: card._id,
          status,
          lastReviewedAt: now,
        },
        $inc: { reviewCount: 1 },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return Response.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to update flashcard progress:", e);
    const message = e instanceof Error ? e.message : "Failed to save progress";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
