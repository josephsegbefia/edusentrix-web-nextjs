import "server-only";

import type { Types } from "mongoose";
import { Lesson } from "@/models/Lesson";
import { LessonSession } from "@/models/LessonSession";
import { LessonDelivery } from "@/models/LessonDelivery";
import type { ILessonFlashcard } from "@/models/LessonFlashcard";
import { canManageLessonSessionContent } from "@/lib/lessons/session-access";

export async function canTeacherManageFlashcard(input: {
  card: Pick<ILessonFlashcard, "lessonId" | "sessionId">;
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
  isAdmin?: boolean;
}): Promise<boolean> {
  if (input.card.sessionId) {
    const session = await LessonSession.findOne({
      _id: input.card.sessionId,
      schoolId: input.schoolId,
    })
      .select("ownerTeacherId")
      .lean();
    if (!session) return false;
    return canManageLessonSessionContent({
      session,
      teacherId: input.teacherId,
      isAdmin: input.isAdmin,
    });
  }

  if (!input.card.lessonId) return false;

  const lesson = await Lesson.findOne({
    _id: input.card.lessonId,
    schoolId: input.schoolId,
    teacherId: input.teacherId,
  })
    .select("_id")
    .lean();

  return Boolean(lesson);
}

export async function loadSessionForFlashcardManage(
  sessionId: Types.ObjectId,
  schoolId: Types.ObjectId,
  teacherId: Types.ObjectId,
  isAdmin?: boolean,
) {
  const session = await LessonSession.findOne({ _id: sessionId, schoolId }).lean();
  if (!session) return null;
  if (
    !canManageLessonSessionContent({
      session,
      teacherId,
      isAdmin,
    })
  ) {
    return null;
  }
  const delivery = await LessonDelivery.findOne({
    sessionId: session._id,
    schoolId,
  }).lean();
  return { session, delivery };
}
