import type { ILessonDelivery } from "@/models/LessonDelivery";
import type { ILessonSession } from "@/models/LessonSession";
import type { LessonSessionDetailDto } from "@/types/lessons-v2";
import { getEffectiveDeliverySchedule } from "@/lib/lessons/delivery-schedule";
import { formatDateYmdUtc } from "@/lib/lessons/timetable-slots-for-week";
import { normalizeContentBlocks, countUnreviewedAiBlocks } from "@/lib/lessons/content-blocks";

function formatDeliverySummary(delivery: ILessonDelivery) {
  return {
    id: String(delivery._id),
    classGroupId: String(delivery.classGroupId),
    status: delivery.status,
    scheduledTeacherId: String(delivery.scheduledTeacherId),
    ownerTeacherId: String(delivery.ownerTeacherId),
    actualTeacherId: delivery.actualTeacherId ? String(delivery.actualTeacherId) : null,
    substituteReason: delivery.substituteReason ?? null,
    startedAt: delivery.startedAt?.toISOString() ?? null,
    endedAt: delivery.endedAt?.toISOString() ?? null,
    completedAt: delivery.completedAt?.toISOString() ?? null,
    attendanceBeforeId: delivery.attendanceBeforeId
      ? String(delivery.attendanceBeforeId)
      : null,
    attendanceAfterId: delivery.attendanceAfterId
      ? String(delivery.attendanceAfterId)
      : null,
  };
}

export function formatLessonSessionDetail(input: {
  session: ILessonSession;
  delivery: ILessonDelivery | null;
  deliveries?: ILessonDelivery[];
  activeClassGroupId?: string | null;
  sharedClassGroupIds?: string[];
}): LessonSessionDetailDto {
  const { session: s, delivery } = input;
  const schedule =
    delivery != null ? getEffectiveDeliverySchedule(s, delivery) : null;

  return {
    id: String(s._id),
    weekPlanId: String(s.weekPlanId),
    lessonNoteId: String(s.lessonNoteId),
    classGroupId: schedule?.classGroupId ?? String(s.classGroupId),
    activeClassGroupId: input.activeClassGroupId ?? schedule?.classGroupId ?? String(s.classGroupId),
    sharedClassGroupIds: input.sharedClassGroupIds ?? [],
    subjectOfferingId: String(s.subjectOfferingId),
    sequenceInWeek: s.sequenceInWeek,
    title: s.title,
    scheduledDate: schedule?.scheduledDate ?? formatDateYmdUtc(new Date(s.scheduledDate)),
    dayOfWeek: schedule?.dayOfWeek ?? s.dayOfWeek,
    startTime: schedule?.startTime ?? s.startTime,
    endTime: schedule?.endTime ?? s.endTime,
    durationMinutes: schedule?.durationMinutes ?? s.durationMinutes,
    status: s.status,
    planNotes: s.planNotes?.trim() || null,
    contentBlocks: normalizeContentBlocks(s.contentBlocks ?? []),
    contentVersion: s.contentVersion || 1,
    unreviewedAiBlockCount: countUnreviewedAiBlocks(normalizeContentBlocks(s.contentBlocks ?? [])),
    studentVisibility: s.studentVisibility,
    parentVisibility: s.parentVisibility,
    adminVisibility: s.adminVisibility,
    noteSectionAllocation: {
      schemeItemIds: (s.noteSectionAllocation?.schemeItemIds ?? []).map((id) => String(id)),
      noteSectionKeys: s.noteSectionAllocation?.noteSectionKeys ?? [],
      coverageWeight: s.noteSectionAllocation?.coverageWeight ?? 0,
    },
    delivery: delivery ? formatDeliverySummary(delivery) : null,
    classDeliveries: (input.deliveries ?? (delivery ? [delivery] : [])).map(formatDeliverySummary),
  };
}
