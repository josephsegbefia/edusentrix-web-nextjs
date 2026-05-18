import "server-only";

import type { ILessonSession } from "@/models/LessonSession";
import { normalizeContentBlocks } from "@/lib/lessons/content-blocks";
import { sanitizeLessonHtml } from "@/lib/lessons/content-safety";
import { formatDateYmdUtc } from "@/lib/lessons/timetable-slots-for-week";

export function formatParentSessionPayload(session: ILessonSession) {
  const blocks = normalizeContentBlocks(session.contentBlocks ?? [])
    .filter((b) => b.type !== "exit_ticket")
    .slice(0, 8)
    .map((b) => ({
      id: b.id,
      type: b.type,
      title: b.title?.trim() || null,
      bodyHtml: sanitizeLessonHtml(b.bodyHtml),
    }));

  return {
    sessionId: String(session._id),
    title: session.title,
    scheduledDate: formatDateYmdUtc(new Date(session.scheduledDate)),
    summaryBlocks: blocks,
    planNotesExcerpt: session.planNotes?.trim().slice(0, 1200) || null,
  };
}
