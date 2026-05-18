import type { ILessonSession } from "@/models/LessonSession";
import type { StudentLessonSessionContentDto } from "@/types/lesson-content-blocks";
import type { LessonContentBlock } from "@/types/lesson-content-blocks";
import { formatDateYmdUtc } from "@/lib/lessons/timetable-slots-for-week";
import { sanitizeLessonHtml } from "@/lib/lessons/content-safety";

export function formatStudentSessionContent(
  session: ILessonSession,
  blocks: LessonContentBlock[],
): StudentLessonSessionContentDto {
  return {
    sessionId: String(session._id),
    title: session.title,
    contentVersion: session.contentVersion || 1,
    scheduledDate: formatDateYmdUtc(new Date(session.scheduledDate)),
    blocks: blocks.map((b) => ({
      id: b.id,
      type: b.type,
      title: b.title?.trim() || null,
      bodyHtml: sanitizeLessonHtml(b.bodyHtml),
      order: b.order,
      estimatedMinutes: b.estimatedMinutes ?? null,
    })),
  };
}
