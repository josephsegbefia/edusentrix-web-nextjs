/** Notebook notes are shared only after publish and once the class session has started teaching. */
export function canStudentViewNotebookNotes(input: {
  notebookNotesPublished: boolean;
  boardNotesHtml?: string | null;
  deliveryStatus?: string | null;
}): boolean {
  if (!input.notebookNotesPublished) return false;
  if (!input.boardNotesHtml?.trim()) return false;
  return (
    input.deliveryStatus === "delivered" ||
    input.deliveryStatus === "completed" ||
    input.deliveryStatus === "in_progress"
  );
}
