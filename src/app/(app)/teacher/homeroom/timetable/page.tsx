"use client";

import { Table2 } from "lucide-react";
import { ComingSoonPanel } from "@/components/ui/coming-soon-panel";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";

export default function TeacherHomeroomTimetablePage() {
  const { data: contextData } = useTeacherContext();
  const homeroomClassName = contextData?.data.teacher.homeroomClassName;

  return (
    <WorkspacePageShell>
      <WorkspacePageHeader
        icon={Table2}
        title="Homeroom timetable"
        subtitle="Build and review your class schedule. Timetable editing for homeroom classes is being rebuilt."
        badge={
          homeroomClassName ? (
            <span className="rounded-full border border-teal-400/30 bg-teal-500/15 px-3 py-1 text-xs font-medium text-teal-200">
              {homeroomClassName}
            </span>
          ) : undefined
        }
      />
      <ComingSoonPanel
        title="Homeroom timetable"
        description="Timetable editing for homeroom classes is paused while we rebuild it. Your other teacher tools are unchanged."
      />
    </WorkspacePageShell>
  );
}
