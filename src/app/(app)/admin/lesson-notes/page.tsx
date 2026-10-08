"use client";

import { AdminLessonNotesInbox } from "@/components/admin/lesson-notes/AdminLessonNotesInbox";
import { WorkspaceScope } from "@/components/theme/workspace-scope";

export default function AdminLessonNotesPage() {
  return (
    <WorkspaceScope>
      <AdminLessonNotesInbox />
    </WorkspaceScope>
  );
}
