import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { LessonFlashcard, type ILessonFlashcard } from "@/models/LessonFlashcard";
import { Lesson, type ILesson } from "@/models/Lesson";

const PatchCardSchema = z.object({
  front: z.string().trim().min(1).max(4000).optional(),
  back: z.string().trim().min(1).max(4000).optional(),
});

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ cardId: string }> }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.journalWrite)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { cardId } = await params;
    const cardObjId = toObjectIdOrNull(cardId);
    if (!cardObjId) {
      return Response.json({ success: false, error: "Invalid flashcard ID" }, { status: 400 });
    }

    const existing = (await LessonFlashcard.findOne({
      _id: cardObjId,
      schoolId: context.schoolId,
    }).lean()) as ILessonFlashcard | null;

    if (!existing) {
      return Response.json({ success: false, error: "Flashcard not found" }, { status: 404 });
    }

    const lesson = (await Lesson.findOne({
      _id: existing.lessonId,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    })
      .select("_id")
      .lean()) as Pick<ILesson, "_id"> | null;

    if (!lesson) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const raw = await req.json().catch(() => null);
    const parsed = PatchCardSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues?.map((i) => i.message).join(", ") || "Invalid data";
      return Response.json({ success: false, error: `Validation failed: ${msg}` }, { status: 400 });
    }

    const update: Record<string, string> = {};
    if (parsed.data.front !== undefined) update.front = parsed.data.front;
    if (parsed.data.back !== undefined) update.back = parsed.data.back;

    if (Object.keys(update).length === 0) {
      return Response.json({ success: true });
    }

    await LessonFlashcard.updateOne({ _id: cardObjId }, { $set: update });

    return Response.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to update flashcard:", e);
    const message = e instanceof Error ? e.message : "Failed to update flashcard";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ cardId: string }> }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.journalWrite)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { cardId } = await params;
    const cardObjId = toObjectIdOrNull(cardId);
    if (!cardObjId) {
      return Response.json({ success: false, error: "Invalid flashcard ID" }, { status: 400 });
    }

    const existing = (await LessonFlashcard.findOne({
      _id: cardObjId,
      schoolId: context.schoolId,
    }).lean()) as ILessonFlashcard | null;

    if (!existing) {
      return Response.json({ success: false, error: "Flashcard not found" }, { status: 404 });
    }

    const lesson = (await Lesson.findOne({
      _id: existing.lessonId,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    })
      .select("_id")
      .lean()) as Pick<ILesson, "_id"> | null;

    if (!lesson) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    await LessonFlashcard.deleteOne({ _id: cardObjId });

    return Response.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to delete flashcard:", e);
    const message = e instanceof Error ? e.message : "Failed to delete flashcard";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
