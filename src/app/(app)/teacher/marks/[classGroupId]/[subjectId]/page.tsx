"use client";

import { useParams } from "next/navigation";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { TeacherMarksDetailClient } from "@/components/teacher/marks/TeacherMarksDetailClient";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";
import { GlassPanel } from "@/components/ui/glass-panel";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";

export default function TeacherMarksDetailPage() {
  const params = useParams<{ classGroupId: string; subjectId: string }>();
  const classGroupId = params?.classGroupId;
  const subjectId = params?.subjectId;
  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canView = can(permissions, PERMISSIONS.gradebookView);

  if (!canView) {
    return (
      <div className="mx-auto w-full max-w-[1400px] p-4 md:p-6">
        <WorkspacePageShell>
          <WorkspacePageHeader
            iconName="book-open-check"
            title="Marks & Reports"
            subtitle="Gradebook access is not enabled for your role."
            backHref="/teacher/marks"
            backLabel="Back to marks"
          />
          <GlassPanel className="p-6">
            <p className="text-sm text-white/60">
              Ask your admin to grant gradebook permissions before using the marks workspace.
            </p>
          </GlassPanel>
        </WorkspacePageShell>
      </div>
    );
  }

  if (!classGroupId || !subjectId) {
    return null;
  }

  return <TeacherMarksDetailClient classGroupId={classGroupId} subjectId={subjectId} />;
}
