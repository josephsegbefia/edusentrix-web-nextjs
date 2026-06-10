import "server-only";

import type { ILessonSession } from "@/models/LessonSession";
import type { StudentNotebookNotesDto } from "@/types/lesson-content-blocks";
import { normalizeContentBlocks } from "@/lib/lessons/content-blocks";
import { sanitizeLessonHtml } from "@/lib/lessons/content-safety";
import { formatDateYmdUtc } from "@/lib/lessons/timetable-slots-for-week";
import { canStudentViewNotebookNotes } from "@/lib/lessons/notebook-notes-visibility";

export function formatParentSessionPayload(
  session: ILessonSession,
  options?: { deliveryStatus?: string | null },
) {
  const blocks = normalizeContentBlocks(session.contentBlocks ?? [])
    .filter((b) => b.type !== "exit_ticket")
    .slice(0, 8)
    .map((b) => ({
      id: b.id,
      type: b.type,
      title: b.title?.trim() || null,
      bodyHtml: sanitizeLessonHtml(b.bodyHtml),
    }));

  const showNotebook = canStudentViewNotebookNotes({
    notebookNotesPublished: Boolean(session.notebookNotesPublished),
    boardNotesHtml: session.boardNotes?.contentHtml,
    deliveryStatus: options?.deliveryStatus,
  });

  const notebookNotes: StudentNotebookNotesDto | null =
    showNotebook && session.boardNotes
      ? {
          contentHtml: sanitizeLessonHtml(session.boardNotes.contentHtml),
          publishedAt: new Date(session.boardNotes.generatedAt).toISOString(),
          aiGenerated: session.boardNotes.aiGenerated,
        }
      : null;

  return {
    sessionId: String(session._id),
    title: session.title,
    scheduledDate: formatDateYmdUtc(new Date(session.scheduledDate)),
    summaryBlocks: blocks,
    planNotesExcerpt: session.planNotes?.trim().slice(0, 1200) || null,
    notebookNotes,
  };
}
