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
  const deliveryBySession = new Map(
    input.deliveries.map((d) => [String(d.sessionId), d]),
  );

  const sessionDtos: LessonWeekPlanSessionDto[] = input.sessions
    .sort((a, b) => a.sequenceInWeek - b.sequenceInWeek)
    .map((s) => {
      const delivery = deliveryBySession.get(String(s._id));
      return {
        id: String(s._id),
        weekPlanId: String(s.weekPlanId),
        sequenceInWeek: s.sequenceInWeek,
        title: s.title,
        scheduledDate: formatDateYmdUtc(new Date(s.scheduledDate)),
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        durationMinutes: s.durationMinutes,
        status: s.status,
        planNotes: s.planNotes?.trim() || null,
        contentBlockCount: Array.isArray(s.contentBlocks) ? s.contentBlocks.length : 0,
        delivery: delivery
          ? {
              id: String(delivery._id),
              status: delivery.status,
              actualTeacherId: delivery.actualTeacherId
                ? String(delivery.actualTeacherId)
                : null,
            }
          : null,
      };
    });

  const summary = {
    total: sessionDtos.length,
    completed: sessionDtos.filter((s) => s.delivery?.status === "completed").length,
    delivered: sessionDtos.filter(
      (s) => s.delivery?.status === "delivered" || s.delivery?.status === "completed",
    ).length,
    scheduled: sessionDtos.filter((s) => s.delivery?.status === "scheduled").length,
  };

  return {
    id: String(input.plan._id),
    title: input.plan.title,
    weekLabel: input.plan.weekLabel,
    weekStartDate: formatDateYmdUtc(new Date(input.plan.weekStartDate)),
    weekEndDate: formatDateYmdUtc(new Date(input.plan.weekEndDate)),
    classGroupId: String(input.plan.classGroupId),
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
