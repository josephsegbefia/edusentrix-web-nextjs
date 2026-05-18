import "server-only";

import type { Types } from "mongoose";
import type { ILessonDelivery } from "@/models/LessonDelivery";
import type { ILessonSession } from "@/models/LessonSession";

export function canReadLessonSession(input: {
  session: Pick<ILessonSession, "ownerTeacherId">;
  delivery: Pick<ILessonDelivery, "scheduledTeacherId"> | null;
  teacherId: Types.ObjectId;
  isAdmin?: boolean;
}): boolean {
  if (input.isAdmin) return true;
  if (String(input.session.ownerTeacherId) === String(input.teacherId)) return true;
  if (input.delivery && String(input.delivery.scheduledTeacherId) === String(input.teacherId)) {
    return true;
  }
  return false;
}

export function canManageLessonSessionContent(input: {
  session: Pick<ILessonSession, "ownerTeacherId">;
  teacherId: Types.ObjectId;
  isAdmin?: boolean;
}): boolean {
  if (input.isAdmin) return true;
  return String(input.session.ownerTeacherId) === String(input.teacherId);
}

export function canTeachLessonSession(input: {
  session: Pick<ILessonSession, "ownerTeacherId">;
  delivery: Pick<ILessonDelivery, "scheduledTeacherId"> | null;
  teacherId: Types.ObjectId;
  isAdmin?: boolean;
}): boolean {
  return canReadLessonSession(input);
}

export function canCompleteLessonDelivery(input: {
  session: Pick<ILessonSession, "ownerTeacherId">;
  delivery: Pick<ILessonDelivery, "scheduledTeacherId">;
  teacherId: Types.ObjectId;
  isAdmin?: boolean;
}): boolean {
  return canReadLessonSession({
    session: input.session,
    delivery: input.delivery,
    teacherId: input.teacherId,
    isAdmin: input.isAdmin,
  });
}
