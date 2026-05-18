import "server-only";

import type { Types } from "mongoose";
import { Lesson } from "@/models/Lesson";
import { LessonSession } from "@/models/LessonSession";
import type { ILessonResource } from "@/models/LessonResource";
import { canManageLessonSessionContent } from "@/lib/lessons/session-access";

export async function canTeacherManageResource(input: {
  resource: Pick<ILessonResource, "lessonId" | "sessionId">;
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
  isAdmin?: boolean;
}): Promise<boolean> {
  if (input.resource.sessionId) {
    const session = await LessonSession.findOne({
      _id: input.resource.sessionId,
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
  if (!input.resource.lessonId) return false;
  const lesson = await Lesson.findOne({
    _id: input.resource.lessonId,
    schoolId: input.schoolId,
    teacherId: input.teacherId,
  })
    .select("_id")
    .lean();
  return Boolean(lesson);
}
