"use client";

import { AdminLessonNotesInbox } from "@/components/admin/lesson-notes/AdminLessonNotesInbox";

export default function AdminLessonNotesAwaitingReviewPage() {
  return (
    <AdminLessonNotesInbox
      initialStatus="submitted"
      title="Lesson Notes Awaiting Review"
      description="Fresh teacher submissions land here before they can be approved for use."
      emptyMessage="There are no freshly submitted lesson notes awaiting review."
    />
  );
}
