import "server-only";

import type { Types } from "mongoose";
import { LessonSession } from "@/models/LessonSession";
import { LessonDelivery } from "@/models/LessonDelivery";
import { canReadLessonSession } from "@/lib/lessons/session-access";

export async function loadLessonSessionForTeacher(input: {
  sessionId: Types.ObjectId;
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
  isAdmin?: boolean;
}) {
  const session = await LessonSession.findOne({
    _id: input.sessionId,
    schoolId: input.schoolId,
  }).lean();

  if (!session) return { kind: "not_found" as const };

  const delivery = await LessonDelivery.findOne({
    sessionId: session._id,
    schoolId: input.schoolId,
  }).lean();

  if (
    !canReadLessonSession({
      session,
      delivery,
      teacherId: input.teacherId,
      isAdmin: input.isAdmin,
    })
  ) {
    return { kind: "forbidden" as const };
  }

  return { kind: "ok" as const, session, delivery };
}
