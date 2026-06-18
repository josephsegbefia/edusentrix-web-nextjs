import type { ILessonSession } from "@/models/LessonSession";
import type { StudentLessonSessionContentDto } from "@/types/lesson-content-blocks";
import type { LessonContentBlock } from "@/types/lesson-content-blocks";
import { formatDateYmdUtc } from "@/lib/lessons/timetable-slots-for-week";
import { sanitizeLessonHtml } from "@/lib/lessons/content-safety";
import { canStudentViewNotebookNotes } from "@/lib/lessons/notebook-notes-visibility";
import { filterStudentVisibleContentBlocks } from "@/lib/lessons/content-readiness";

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

  const studentBlocks = filterStudentVisibleContentBlocks(blocks);

  return {
    sessionId: String(session._id),
    title: session.title,
    contentVersion: session.contentVersion || 1,
    scheduledDate: formatDateYmdUtc(new Date(session.scheduledDate)),
    blocks: studentBlocks.map((b) => ({
      id: b.id,
      type: b.type,
      title: b.title?.trim() || null,
      bodyHtml: sanitizeLessonHtml(b.bodyHtml),
      order: b.order,
      estimatedMinutes: b.estimatedMinutes ?? null,
      resourceUrl: b.resourceUrl ?? null,
      mathMeta: b.mathMeta
        ? {
            latex: b.mathMeta.latex ?? null,
            plainText: b.mathMeta.plainText ?? null,
            renderMode: b.mathMeta.renderMode,
          }
        : null,
      accessibilityMeta: b.accessibilityMeta || b.assetMeta
        ? {
            altText: b.assetMeta?.altText ?? b.accessibilityMeta?.altText ?? null,
            caption: b.assetMeta?.caption ?? b.accessibilityMeta?.caption ?? null,
          }
        : null,
      diagramMeta: b.diagramMeta ?? null,
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
