"use client";

import * as React from "react";
import { BookOpenCheck } from "lucide-react";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { GradebookSelector } from "@/components/teacher/gradebook/GradebookSelector";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { GlassPanel } from "@/components/ui/glass-panel";

export default function TeacherGradebookPage() {
  const { data: classesData, isLoading } = useTeacherClasses();
  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canView = can(permissions, PERMISSIONS.gradebookView);

  const classes = React.useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        subjects: Array<{ id: string; name: string; studentCount: number }>;
      }
    >();

    (classesData?.data.classes || []).forEach((item) => {
      if (!item._id || !item.subjectId) return;
      if (!map.has(item._id)) {
        map.set(item._id, {
          id: item._id,
          name: item.name,
          subjects: [],
        });
      }
      const entry = map.get(item._id);
      if (!entry) return;
      if (!entry.subjects.some((subject) => subject.id === item.subjectId)) {
        entry.subjects.push({
          id: item.subjectId,
          name: item.subjectName,
          studentCount: item.studentCount,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [classesData]);

  if (!canView) {
    return (
      <WorkspacePageShell>
        <WorkspacePageHeader
          icon={BookOpenCheck}
          title="Gradebook"
          subtitle="Record and publish grades once access is enabled."
        />
        <GlassPanel className="p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-teal-400/30 bg-teal-500/15 text-teal-200">
              <BookOpenCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Gradebook access required</h2>
              <p className="mt-2 text-sm text-white/60">
                Your role doesn&apos;t currently include gradebook permissions. Ask an admin to grant
                gradebook access.
              </p>
            </div>
          </div>
        </GlassPanel>
      </WorkspacePageShell>
    );
  }

  return (
    <WorkspacePageShell>
      <WorkspacePageHeader
        icon={BookOpenCheck}
        title="Gradebook"
        subtitle="Jump into a class gradebook to record marks, review totals, and publish results."
      />
      <GradebookSelector classes={classes} loading={isLoading} />
    </WorkspacePageShell>
  );
}
