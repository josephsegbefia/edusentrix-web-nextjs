"use client";

import * as React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useTeacherAssignments } from "@/hooks/teacher/useTeacherAssignments";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useBusyToast } from "@/hooks/useBusyToast";
import { AssignmentCard } from "@/components/teacher/studio/AssignmentCard";
import { AssignmentFilters, type AssignmentFiltersValue } from "@/components/teacher/studio/AssignmentFilters";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";

export default function TeacherAssignmentsPage() {
  const busyToast = useBusyToast();
  const [filters, setFilters] = React.useState<AssignmentFiltersValue>({});

  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canCreate = can(permissions, PERMISSIONS.assignmentsCreate);
  const canPublish = can(permissions, PERMISSIONS.assignmentsPublish);

  const { data, isLoading, refetch, isFetching } = useTeacherAssignments(filters);
  const { data: classesData } = useTeacherClasses();

  const assignments = data?.data.assignments || [];

  const subjects = React.useMemo(() => {
    const map = new Map<string, string>();
    (classesData?.data.classes || []).forEach((item: any) => {
      if (item.subjectId && item.subjectName) {
        map.set(item.subjectId, item.subjectName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [classesData]);

  const classGroups = React.useMemo(() => {
    const map = new Map<string, string>();
    (classesData?.data.classes || []).forEach((item: any) => {
      if (item._id && item.name) {
        map.set(item._id, item.name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [classesData]);

  const handlePublish = async (id: string) => {
    await busyToast.promise(
      fetch(`/api/teacher/studio/assignments/${id}/publish`, { method: "POST" }).then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data?.error || "Failed to publish assignment");
        }
        return res.json();
      }),
      {
        loading: "Publishing assignment...",
        success: "Assignment published",
        error: "Failed to publish assignment",
      }
    );
    await refetch();
  };

  const handleClose = async (id: string) => {
    await busyToast.promise(
      fetch(`/api/teacher/studio/assignments/${id}/close`, { method: "POST" }).then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data?.error || "Failed to close assignment");
        }
        return res.json();
      }),
      {
        loading: "Closing assignment...",
        success: "Assignment closed",
        error: "Failed to close assignment",
      }
    );
    await refetch();
  };

  const handleArchive = async (id: string) => {
    await busyToast.promise(
      fetch(`/api/teacher/studio/assignments/${id}`, { method: "DELETE" }).then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data?.error || "Failed to archive assignment");
        }
        return res.json();
      }),
      {
        loading: "Archiving assignment...",
        success: "Assignment archived",
        error: "Failed to archive assignment",
      }
    );
    await refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Assignments</h1>
          <p className="text-sm text-white/60">Create, publish, and track assignments.</p>
        </div>
        {canCreate && (
          <Button
            asChild
            className="bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30"
          >
            <Link href="/teacher/studio/assignments/new">
              <Plus className="h-4 w-4" />
              New assignment
            </Link>
          </Button>
        )}
      </div>

      <AssignmentFilters
        subjects={subjects}
        classGroups={classGroups}
        value={filters}
        onChange={setFilters}
      />

      {isLoading || isFetching ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
          ))}
        </div>
      ) : assignments.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
          No assignments yet. Create your first assignment to get started.
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map((assignment) => (
            <AssignmentCard
              key={assignment.id}
              assignment={assignment}
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
