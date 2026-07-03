import { notFound } from "next/navigation";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { AdminLessonSessionDetail } from "@/components/admin/lesson-sessions/AdminLessonSessionDetail";

export const metadata = { title: "Lesson Session Detail" };

export default async function AdminLessonSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id) notFound();

  return (
    <WorkspacePageShell>
      <WorkspacePageHeader
        iconName="presentation"
        title="Lesson Session"
        subtitle="Review schedule, delivery status, content readiness, and class-level teaching progress."
        backHref="/admin/lessons/sessions"
        backLabel="Lesson sessions"
      />
      <AdminLessonSessionDetail sessionId={id} />
    </WorkspacePageShell>
  );
}
