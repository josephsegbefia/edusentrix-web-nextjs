"use client";

import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { useTeacherAssignments } from "@/hooks/teacher/useTeacherAssignments";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { AssignmentCard } from "@/components/teacher/studio/AssignmentCard";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { GlassPanel } from "@/components/ui/glass-panel";
import { cn } from "@/lib/utils";
import { glassInsetClass, glassPrimaryButtonClass } from "@/lib/ui/glass-surfaces";

export default function TeacherProjectsPage() {
  const busyToast = useBusyToast();
  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canCreate = can(permissions, PERMISSIONS.assignmentsCreate);
  const canPublish = can(permissions, PERMISSIONS.assignmentsPublish);
  const { data, isLoading, refetch } = useTeacherAssignments({ type: "project" });
  const assignments = data?.data.assignments || [];

  const handlePublish = async (id: string) => {
    await busyToast.promise(
      fetch(`/api/teacher/studio/assignments/${id}/publish`, { method: "POST" }).then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data?.error || "Failed to publish project");
        }
        return res.json();
      }),
      {
        loading: "Publishing project...",
        success: "Project published",
        error: "Failed to publish project",
      }
    );
    await refetch();
  };

  const handleClose = async (id: string) => {
    await busyToast.promise(
      fetch(`/api/teacher/studio/assignments/${id}/close`, { method: "POST" }).then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data?.error || "Failed to close project");
        }
        return res.json();
      }),
      {
        loading: "Closing project...",
        success: "Project closed",
        error: "Failed to close project",
      }
    );
    await refetch();
  };

  const handleArchive = async (id: string) => {
    await busyToast.promise(
      fetch(`/api/teacher/studio/assignments/${id}`, { method: "DELETE" }).then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data?.error || "Failed to archive project");
        }
        return res.json();
      }),
      {
        loading: "Archiving project...",
        success: "Project archived",
        error: "Failed to archive project",
      }
    );
    await refetch();
  };

  const newProjectAction = canCreate ? (
    <Button asChild className={glassPrimaryButtonClass}>
      <Link href="/teacher/studio/assignments/new?type=project">
        <Plus className="h-4 w-4" />
        New project
      </Link>
    </Button>
  ) : null;

  return (
    <WorkspacePageShell>
      <WorkspacePageHeader
        icon={FileText}
        title="Projects"
        subtitle="Track long-form class projects."
        badge={
          !isLoading && assignments.length > 0 ? (
            <span className="rounded-full border border-teal-400/30 bg-teal-500/15 px-3 py-1 text-xs font-medium text-teal-200">
              {assignments.length} project{assignments.length === 1 ? "" : "s"}
            </span>
          ) : undefined
        }
        actions={newProjectAction}
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className={cn(glassInsetClass, "h-28 animate-pulse rounded-2xl")} />
          ))}
        </div>
      ) : assignments.length === 0 ? (
        <GlassPanel className="p-10 text-center">
          <p className="text-sm text-white/60">No projects yet. Create your first project.</p>
          {canCreate ? (
            <Button asChild className={cn("mt-4", glassPrimaryButtonClass)}>
              <Link href="/teacher/studio/assignments/new?type=project">
                <Plus className="h-4 w-4" />
                New project
              </Link>
            </Button>
          ) : null}
        </GlassPanel>
      ) : (
        <div className="space-y-4">
          {assignments.map((assignment) => (
            <AssignmentCard
              key={assignment.id}
              assignment={assignment}
              itemLabel="Project"
              onPublish={canPublish ? handlePublish : undefined}
              onClose={canPublish ? handleClose : undefined}
              onArchive={canCreate ? handleArchive : undefined}
            />
          ))}
        </div>
      )}
    </WorkspacePageShell>
  );
}
