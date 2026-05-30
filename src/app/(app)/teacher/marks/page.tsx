"use client";

import * as React from "react";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { GradebookSelector } from "@/components/teacher/gradebook/GradebookSelector";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { GlassPanel } from "@/components/ui/glass-panel";

export default function TeacherMarksPage() {
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
      <div className="mx-auto w-full max-w-[1200px] p-4 md:p-6">
        <WorkspacePageShell>
          <WorkspacePageHeader
            iconName="book-open-check"
            title="Marks & Reports"
            subtitle="Record marks using your school's assessment plan and grading policy."
          />
          <GlassPanel className="p-6">
            <p className="text-sm text-white/60">
              Your role does not include gradebook access. Ask an admin to grant gradebook
              permissions.
            </p>
          </GlassPanel>
        </WorkspacePageShell>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] p-4 md:p-6">
      <WorkspacePageShell>
        <WorkspacePageHeader
          iconName="book-open-check"
          title="Marks & Reports"
          subtitle="Open a class subject workspace powered by your active assessment plan and grading policy."
        />
        <GradebookSelector
          classes={classes}
          loading={isLoading}
          basePath="/teacher/marks"
          openLabel="Open marks workspace"
        />
      </WorkspacePageShell>
    </div>
  );
}
