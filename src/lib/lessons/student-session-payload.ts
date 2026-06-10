import type { ILessonSession } from "@/models/LessonSession";
import type { StudentLessonSessionContentDto } from "@/types/lesson-content-blocks";
import type { LessonContentBlock } from "@/types/lesson-content-blocks";
import { formatDateYmdUtc } from "@/lib/lessons/timetable-slots-for-week";
import { sanitizeLessonHtml } from "@/lib/lessons/content-safety";
import { canStudentViewNotebookNotes } from "@/lib/lessons/notebook-notes-visibility";

export function formatStudentSessionContent(
  session: ILessonSession,
  blocks: LessonContentBlock[],
  options?: { deliveryStatus?: string | null },
): StudentLessonSessionContentDto {
  const showNotebook = canStudentViewNotebookNotes({
    notebookNotesPublished: Boolean(session.notebookNotesPublished),
    boardNotesHtml: session.boardNotes?.contentHtml,
    deliveryStatus: options?.deliveryStatus,
  });

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
    notebookNotes:
      showNotebook && session.boardNotes
        ? {
            contentHtml: sanitizeLessonHtml(session.boardNotes.contentHtml),
            publishedAt: new Date(session.boardNotes.generatedAt).toISOString(),
            aiGenerated: session.boardNotes.aiGenerated,
          }
        : null,
  };
}
