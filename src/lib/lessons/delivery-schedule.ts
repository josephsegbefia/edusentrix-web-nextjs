import type { ILessonDelivery } from "@/models/LessonDelivery";
import type { ILessonSession } from "@/models/LessonSession";
import { formatDateYmdUtc } from "@/lib/lessons/timetable-slots-for-week";

export { pickLessonDeliveryForClass } from "@/lib/lessons/pick-lesson-delivery";

export type EffectiveDeliverySchedule = {
  classGroupId: string;
  scheduledDate: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  timetableSlotId: string | null;
  timetableSlotIds: string[];
};

/** Delivery schedule override when set; otherwise inherit from the anchor session. */
export function getEffectiveDeliverySchedule(
  session: Pick<
    ILessonSession,
    | "classGroupId"
    | "scheduledDate"
    | "dayOfWeek"
    | "startTime"
    | "endTime"
    | "durationMinutes"
    | "timetableSlotId"
    | "timetableSlotIds"
  >,
  delivery: Pick<
    ILessonDelivery,
    | "classGroupId"
    | "scheduledDate"
    | "dayOfWeek"
    | "startTime"
    | "endTime"
    | "durationMinutes"
    | "timetableSlotId"
    | "timetableSlotIds"
  >,
): EffectiveDeliverySchedule {
  const usesOverride =
    delivery.scheduledDate != null &&
    delivery.startTime != null &&
    delivery.endTime != null;

  const scheduledDate = usesOverride
    ? formatDateYmdUtc(new Date(delivery.scheduledDate!))
    : formatDateYmdUtc(new Date(session.scheduledDate));

  const slotIds = (
    delivery.timetableSlotIds?.length
      ? delivery.timetableSlotIds
      : delivery.timetableSlotId
        ? [delivery.timetableSlotId]
        : session.timetableSlotIds?.length
          ? session.timetableSlotIds
          : session.timetableSlotId
            ? [session.timetableSlotId]
            : []
  ).map((id) => String(id));

  return {
    classGroupId: String(delivery.classGroupId),
    scheduledDate,
    dayOfWeek: usesOverride ? (delivery.dayOfWeek ?? session.dayOfWeek) : session.dayOfWeek,
    startTime: usesOverride ? delivery.startTime! : session.startTime,
    endTime: usesOverride ? delivery.endTime! : session.endTime,
    durationMinutes: usesOverride
      ? delivery.durationMinutes ?? session.durationMinutes
      : session.durationMinutes,
    timetableSlotId: slotIds[0] ?? null,
    timetableSlotIds: slotIds,
  };
}
