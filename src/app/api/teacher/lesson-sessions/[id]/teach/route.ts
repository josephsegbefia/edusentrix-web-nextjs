import { getEffectiveDeliverySchedule } from "@/lib/lessons/delivery-schedule";
import {
  buildTeachingDeckFromSession,
  teachingDeckNeedsRebuild,
} from "@/lib/lessons/build-teaching-deck";
import { requireSessionTeachContext } from "@/lib/lessons/session-teach-access";
import type { SessionTeachContextResponse } from "@/types/teaching-deck";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const classGroupId = new URL(req.url).searchParams.get("classGroupId");
    const result = await requireSessionTeachContext(id, classGroupId);
    if ("error" in result) return result.error;

    const { session, delivery, settings } = result;
    const schedule = getEffectiveDeliverySchedule(session, delivery);

    if (teachingDeckNeedsRebuild(session, session.teachingDeck ?? undefined)) {
      session.teachingDeck = buildTeachingDeckFromSession(session);
      await session.save();
    }

    const body: SessionTeachContextResponse = {
      success: true,
      data: {
        session: {
          id: String(session._id),
          title: session.title,
          scheduledDate: schedule.scheduledDate,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          durationMinutes: schedule.durationMinutes,
          planNotes: session.planNotes?.trim() || null,
          classGroupId: schedule.classGroupId,
        },
        deck: session.teachingDeck!,
        delivery: {
          id: String(delivery._id),
          status: delivery.status,
          startedAt: delivery.startedAt?.toISOString() ?? null,
          endedAt: delivery.endedAt?.toISOString() ?? null,
          completedAt: delivery.completedAt?.toISOString() ?? null,
          attendanceBeforeId: delivery.attendanceBeforeId
            ? String(delivery.attendanceBeforeId)
            : null,
          attendanceAfterId: delivery.attendanceAfterId
            ? String(delivery.attendanceAfterId)
            : null,
        },
        enableTeachingMode: settings.enableTeachingMode,
      },
    };

    return Response.json(body);
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[lesson-sessions teach GET]", e);
    const message = e instanceof Error ? e.message : "Failed to load teaching mode";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
