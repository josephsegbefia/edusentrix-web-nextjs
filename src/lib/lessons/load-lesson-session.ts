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
  classGroupId?: Types.ObjectId | null;
}) {
  const session = await LessonSession.findOne({
    _id: input.sessionId,
    schoolId: input.schoolId,
  }).lean();

  if (!session) return { kind: "not_found" as const };

  const deliveries = await LessonDelivery.find({
    sessionId: session._id,
    schoolId: input.schoolId,
  }).lean();

  const targetClassGroupId = input.classGroupId
    ? String(input.classGroupId)
    : String(session.classGroupId);

  const delivery =
    deliveries.find((d) => String(d.classGroupId) === targetClassGroupId) ??
    deliveries.find((d) => String(d.classGroupId) === String(session.classGroupId)) ??
    deliveries[0] ??
    null;

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

  return {
    kind: "ok" as const,
    session,
    delivery,
    deliveries,
    activeClassGroupId: delivery ? String(delivery.classGroupId) : targetClassGroupId,
  };
}
