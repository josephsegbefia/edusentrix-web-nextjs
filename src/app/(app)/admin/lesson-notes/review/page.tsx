"use client";

import { AdminLessonNotesInbox } from "@/components/admin/lesson-notes/AdminLessonNotesInbox";
import { WorkspaceScope } from "@/components/theme/workspace-scope";

export default function AdminLessonNotesAwaitingReviewPage() {
  return (
    <WorkspaceScope>
      <AdminLessonNotesInbox
        initialStatus="submitted"
        title="Lesson Notes Awaiting Review"
        description="Fresh teacher submissions land here before they can be approved for use."
        emptyMessage="There are no freshly submitted lesson notes awaiting review."
      />
    </WorkspaceScope>
  );
}
