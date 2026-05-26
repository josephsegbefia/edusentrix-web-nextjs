import * as React from "react";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { AdminLessonSessionsOverview } from "@/components/admin/lesson-sessions/AdminLessonSessionsOverview";

export const metadata = { title: "Lesson Sessions" };

export default function AdminLessonSessionsPage() {
  return (
    <WorkspacePageShell>
      <WorkspacePageHeader
        iconName="presentation"
        title="Lesson Sessions"
        subtitle="Monitor teaching sessions across all classes — track delivery status, content coverage, and assessments."
        backHref="/admin/lessons/analytics"
        backLabel="Lessons"
      />
      <AdminLessonSessionsOverview />
    </WorkspacePageShell>
  );
}
