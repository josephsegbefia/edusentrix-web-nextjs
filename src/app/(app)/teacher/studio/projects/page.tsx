"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useTeacherAssignments } from "@/hooks/teacher/useTeacherAssignments";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { AssignmentCard } from "@/components/teacher/studio/AssignmentCard";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Projects</h1>
          <p className="text-sm text-white/60">Track long-form class projects.</p>
        </div>
        {canCreate && (
          <Button asChild className="bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30">
            <Link href="/teacher/studio/assignments/new?type=project">
              <Plus className="h-4 w-4" />
              New project
            </Link>
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
          ))}
        </div>
      ) : assignments.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
          No projects yet. Create your first project.
        </div>
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
    </div>
  );
}
