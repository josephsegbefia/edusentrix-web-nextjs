import type { ILessonDelivery } from "@/models/LessonDelivery";
import type { ILessonSession } from "@/models/LessonSession";
import type { ILessonWeekPlan } from "@/models/LessonWeekPlan";
import type { LessonWeekPlanDto, LessonWeekPlanSessionDto } from "@/types/lessons-v2";
import { formatDateYmdUtc } from "@/lib/lessons/timetable-slots-for-week";

export function formatWeekPlanDto(input: {
  plan: ILessonWeekPlan;
  sessions: ILessonSession[];
  deliveries: ILessonDelivery[];
  lessonNoteTopic?: string | null;
}): LessonWeekPlanDto {
  const deliveriesBySession = new Map<string, ILessonDelivery[]>();
  for (const delivery of input.deliveries) {
    const key = String(delivery.sessionId);
    const list = deliveriesBySession.get(key) ?? [];
    list.push(delivery);
    deliveriesBySession.set(key, list);
  }

  const sessionDtos: LessonWeekPlanSessionDto[] = input.sessions
    .sort((a, b) => a.sequenceInWeek - b.sequenceInWeek)
    .map((s) => {
      const sessionDeliveries = deliveriesBySession.get(String(s._id)) ?? [];
      const delivery =
        sessionDeliveries.find(
          (d) => String(d.classGroupId) === String(input.plan.classGroupId),
        ) ?? sessionDeliveries[0] ?? null;
      return {
        id: String(s._id),
        weekPlanId: String(s.weekPlanId),
        sequenceInWeek: s.sequenceInWeek,
        timetableSlotIds: (s.timetableSlotIds?.length ? s.timetableSlotIds : s.timetableSlotId ? [s.timetableSlotId] : [])
          .map((id) => String(id)),
        periodCount: s.timetableSlotIds?.length || 1,
        isDoublePeriod: (s.timetableSlotIds?.length || 1) > 1,
        title: s.title,
        scheduledDate: formatDateYmdUtc(new Date(s.scheduledDate)),
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        durationMinutes: s.durationMinutes,
        status: s.status,
        planNotes: s.planNotes?.trim() || null,
        contentBlockCount: Array.isArray(s.contentBlocks) ? s.contentBlocks.length : 0,
        hasNotebookNotes: Boolean(s.boardNotes?.contentHtml?.trim()),
        notebookNotesPublished: Boolean(s.notebookNotesPublished),
        delivery: delivery
          ? {
              id: String(delivery._id),
              classGroupId: String(delivery.classGroupId),
              status: delivery.status,
              actualTeacherId: delivery.actualTeacherId
                ? String(delivery.actualTeacherId)
                : null,
            }
          : null,
        classDeliveries: sessionDeliveries.map((d) => ({
          id: String(d._id),
          classGroupId: String(d.classGroupId),
          status: d.status,
          actualTeacherId: d.actualTeacherId ? String(d.actualTeacherId) : null,
        })),
      };
    });

  const summary = {
    total: sessionDtos.length,
    completed: sessionDtos.filter((s) => s.delivery?.status === "completed").length,
    delivered: sessionDtos.filter(
      (s) => s.delivery?.status === "delivered" || s.delivery?.status === "completed",
    ).length,
    scheduled: sessionDtos.filter((s) => s.delivery?.status === "scheduled").length,
    notebookNotesReady: sessionDtos.filter((s) => s.hasNotebookNotes).length,
    notebookNotesShared: sessionDtos.filter((s) => s.notebookNotesPublished).length,
  };

  return {
    id: String(input.plan._id),
    title: input.plan.title,
    weekLabel: input.plan.weekLabel,
    weekStartDate: formatDateYmdUtc(new Date(input.plan.weekStartDate)),
    weekEndDate: formatDateYmdUtc(new Date(input.plan.weekEndDate)),
    classGroupId: String(input.plan.classGroupId),
    classGroupIds: (input.plan.classGroupIds?.length
      ? input.plan.classGroupIds
      : [input.plan.classGroupId]
    ).map((id) => String(id)),
    subjectOfferingId: String(input.plan.subjectOfferingId),
    lessonNoteId: String(input.plan.lessonNoteId),
    lessonNoteTopic: input.lessonNoteTopic ?? null,
    status: input.plan.status,
    sessions: sessionDtos,
    deliverySummary: summary,
  };
}

export function groupWeekPlansByWeek(
  plans: LessonWeekPlanDto[],
): Array<{
  weekStartDate: string;
  weekEndDate: string;
  weekLabel: string;
  plans: LessonWeekPlanDto[];
}> {
  const map = new Map<string, LessonWeekPlanDto[]>();
  for (const plan of plans) {
    const key = plan.weekStartDate;
    const list = map.get(key) || [];
    list.push(plan);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([weekStartDate, grouped]) => ({
      weekStartDate,
      weekEndDate: grouped[0]?.weekEndDate || weekStartDate,
      weekLabel: grouped[0]?.weekLabel || "",
      plans: grouped.sort((a, b) => a.title.localeCompare(b.title)),
    }));
}
