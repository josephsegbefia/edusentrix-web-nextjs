import "server-only";

import type { ILessonSession } from "@/models/LessonSession";
import type { TeachingDeck } from "@/types/teaching-deck";
import { buildTeachingDeckFromSessionInput } from "@/lib/lessons/build-teaching-deck-shared";
import { formatDateYmdUtc } from "@/lib/lessons/timetable-slots-for-week";

export function buildTeachingDeckFromSession(session: ILessonSession): TeachingDeck {
  return buildTeachingDeckFromSessionInput({
    title: session.title,
    scheduledDate: formatDateYmdUtc(new Date(session.scheduledDate)),
    startTime: session.startTime,
    endTime: session.endTime,
    planNotes: session.planNotes?.trim() || null,
    contentBlocks: session.contentBlocks ?? [],
    contentVersion: session.contentVersion || 1,
  });
}

export function teachingDeckNeedsRebuild(
  session: ILessonSession,
  deck: TeachingDeck | null | undefined,
): boolean {
  if (!deck?.slides?.length) return true;
  return (deck.sourceContentVersion || 0) !== (session.contentVersion || 1);
}
