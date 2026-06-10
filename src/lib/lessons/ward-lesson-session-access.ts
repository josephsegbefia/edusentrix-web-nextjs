import "server-only";

import type { Types } from "mongoose";
import { LessonSession, type ILessonSession } from "@/models/LessonSession";
import { LessonDelivery } from "@/models/LessonDelivery";

type DeliveryLean = {
  _id: Types.ObjectId;
  status: string;
  classGroupId: Types.ObjectId;
} | null;

/** Load a lesson session visible to a student or parent in a specific class group. */
export async function loadWardAccessibleSession(input: {
  sessionId: Types.ObjectId;
  schoolId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  audience: "student" | "parent";
  select?: string;
}): Promise<{ session: ILessonSession | null; delivery: DeliveryLean }> {
  const session = await LessonSession.findOne({
    _id: input.sessionId,
    schoolId: input.schoolId,
    status: { $ne: "archived" },
  })
    .select(input.select ?? "")
    .lean<ILessonSession | null>();

  if (!session) {
    return { session: null, delivery: null };
  }

  const belongsToClass = String(session.classGroupId) === String(input.classGroupId);

  const delivery = (await LessonDelivery.findOne({
    schoolId: input.schoolId,
    sessionId: input.sessionId,
    classGroupId: input.classGroupId,
  })
    .select("_id status classGroupId")
    .lean()) as DeliveryLean;

  if (!belongsToClass && !delivery) {
    return { session: null, delivery: null };
  }

  const taught =
    delivery?.status === "delivered" ||
    delivery?.status === "completed" ||
    delivery?.status === "in_progress";

  if (input.audience === "student") {
    const published = session.studentVisibility === "published";
    if (!published && !taught) {
      return { session: null, delivery: null };
    }
  } else {
    const parentVisible = Boolean(session.parentVisibility);
    const completed = delivery?.status === "completed";
    if (!parentVisible && !completed) {
      return { session: null, delivery: null };
    }
  }

  return { session, delivery };
}
