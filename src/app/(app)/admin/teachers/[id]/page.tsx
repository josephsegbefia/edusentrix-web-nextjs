// src/app/(app)/admin/teachers/[id]/page.tsx
"use client";

import * as React from "react";
import { Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import { useTeacher, useUpdateTeacher, useActivateTeacher, useDeactivateTeacher, useDeleteTeacher } from "@/hooks/admin/useTeachers";
import { useBusyToast } from "@/hooks/useBusyToast";
import { TeacherDetailHeader } from "@/components/admin/teachers/detail/TeacherDetailHeader";
import {
  TeacherDetailTabs,
  type TeacherDetailTabId,
} from "@/components/admin/teachers/detail/TeacherDetailTabs";
import { TeacherOverviewTab } from "@/components/admin/teachers/detail/TeacherOverviewTab";
import { TeacherAssignmentsTab } from "@/components/admin/teachers/detail/TeacherAssignmentsTab";
import { TeacherAttendanceTab } from "@/components/admin/teachers/detail/TeacherAttendanceTab";
import { TeacherDocumentsTab } from "@/components/admin/teachers/detail/TeacherDocumentsTab";
import { TeacherNotesTab } from "@/components/admin/teachers/detail/TeacherNotesTab";
import { TeacherPerformanceTab } from "@/components/admin/teachers/detail/TeacherPerformanceTab";
import { TeacherActivityTab } from "@/components/admin/teachers/detail/TeacherActivityTab";
import EditTeacherModal from "@/components/modals/EditTeacherModal";
function getInitialTab(sp: URLSearchParams | null): TeacherDetailTabId {
  if (!sp) return "overview";
  const raw = sp.get("tab");
  if (
    raw === "overview" ||
    raw === "assignments" ||
    raw === "performance" ||
    raw === "attendance" ||
    raw === "documents" ||
    raw === "notes" ||
    raw === "activity"
  ) {
    return raw;
  }
  return "overview";
}

function TeacherDetailContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const busy = useBusyToast();

  const teacherId = params?.id;
  const [activeTab, setActiveTab] = React.useState<TeacherDetailTabId>(() =>
    getInitialTab(searchParams)
  );
  const [editOpen, setEditOpen] = React.useState(false);

  const { data, isLoading, isError } = useTeacher(String(teacherId));
  const teacher = data?.data;
  const updateTeacher = useUpdateTeacher();
  const activateTeacher = useActivateTeacher();
  const deactivateTeacher = useDeactivateTeacher();
  const deleteTeacher = useDeleteTeacher();

  const isChangingStatus = activateTeacher.isPending || deactivateTeacher.isPending || deleteTeacher.isPending;

  const handleActivate = async () => {
    if (!teacher) return;
    try {
      await busy.promise(
        activateTeacher.mutateAsync(teacher.id),
        {
          loading: "Activating teacher...",
          success: "Teacher activated successfully",
          error: (e: Error) => e.message || "Failed to activate teacher",
        }
      );
    } catch {
      // Error already handled by busy.promise
    }
  };

  const handleDeactivate = async () => {
    if (!teacher) return;
    if (!confirm(`Are you sure you want to deactivate ${teacher.fullName}?`)) return;
    try {
      await busy.promise(
        deactivateTeacher.mutateAsync(teacher.id),
        {
          loading: "Deactivating teacher...",
          success: "Teacher deactivated successfully",
          error: (e: Error) => e.message || "Failed to deactivate teacher",
        }
      );
    } catch {
      // Error already handled by busy.promise
    }
  };

  const handleDelete = async () => {
    if (!teacher) return;
    if (!confirm(`Are you sure you want to terminate ${teacher.fullName}?\n\nThis will:\n• Set their status to "Terminated"\n• Deactivate all their active assignments\n• Remove them as homeroom teacher (if applicable)\n\nThis action cannot be undone.`)) return;
    try {
      await busy.promise(
        deleteTeacher.mutateAsync(teacher.id),
        {
          loading: "Terminating teacher...",
          success: "Teacher terminated successfully",
          error: (e: Error) => e.message || "Failed to terminate teacher",
        }
      );
    } catch {
      // Error already handled by busy.promise
    }
  };

  // Sync tab → URL
  React.useEffect(() => {
    if (!teacherId) return;
    const current = new URLSearchParams(searchParams.toString());
    current.set("tab", activeTab);
    const qs = current.toString();
    router.replace(
      qs
        ? `/admin/teachers/${encodeURIComponent(teacherId)}?${qs}`
        : `/admin/teachers/${encodeURIComponent(teacherId)}`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, teacherId]);

  function handleTabChange(tab: TeacherDetailTabId) {
    setActiveTab(tab);
  }

  if (!teacherId) {
    return (
      <div className="space-y-6">
        <Card className="relative overflow-hidden border border-red-500/40 bg-linear-to-br from-red-950/40 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-red-500/20 via-red-500/5 to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 flex items-center justify-between gap-3 py-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <div className="font-semibold">Missing teacher identifier</div>
                <p className="text-xs text-red-100/80">
                  The teacher ID was not provided in the URL.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push("/admin/teachers")}
              className="cursor-pointer border border-red-300/60 bg-transparent text-xs text-red-50 transition-all duration-200 hover:scale-105 hover:border-red-300/80 hover:bg-red-900/40 hover:shadow-md hover:shadow-red-500/20 active:scale-95"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Back to Teachers
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/5 via-primary/2 to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 flex animate-pulse items-center justify-between gap-6 p-6">
            <div className="flex flex-1 items-center gap-4">
              <div className="size-16 rounded-full bg-white/10" />
              <div className="space-y-2">
                <div className="h-4 w-40 rounded bg-white/15" />
                <div className="flex gap-2">
                  <div className="h-3 w-24 rounded-full bg-white/10" />
                  <div className="h-3 w-20 rounded-full bg-white/10" />
                </div>
              </div>
            </div>
            <div className="hidden w-64 space-y-2 md:block">
              <div className="h-3 w-full rounded bg-white/10" />
              <div className="flex gap-2">
                <div className="h-8 flex-1 rounded bg-white/10" />
                <div className="h-8 flex-1 rounded bg-white/10" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs skeleton */}
        <div className="flex gap-2 border-b border-white/10 pb-2">
          <div className="h-7 w-20 rounded-full bg-white/10" />
          <div className="h-7 w-24 rounded-full bg-white/5" />
          <div className="h-7 w-32 rounded-full bg-white/5" />
        </div>

        {/* Content skeleton */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
          <div className="space-y-4">
            <Card className="relative overflow-hidden h-40 animate-pulse border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur" />
          </div>
          <div className="space-y-4">
            <Card className="relative overflow-hidden h-40 animate-pulse border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !teacher) {
    return (
      <div className="space-y-6">
        <Card className="relative overflow-hidden border border-red-500/40 bg-linear-to-br from-red-950/40 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-red-500/20 via-red-500/5 to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 flex items-center justify-between gap-3 py-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <div className="font-semibold">
                  Unable to load teacher details
                </div>
                <p className="text-xs text-red-100/80">
                  The teacher might not exist or you might not have access.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push("/admin/teachers")}
              className="cursor-pointer border border-red-300/60 bg-transparent text-xs text-red-50 transition-all duration-200 hover:scale-105 hover:border-red-300/80 hover:bg-red-900/40 hover:shadow-md hover:shadow-red-500/20 active:scale-95"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Back to Teachers
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => router.push("/admin/teachers")}
            className="h-9 w-9 cursor-pointer border border-white/10 bg-white/5 transition-all duration-200 hover:scale-105 hover:border-white/20 hover:bg-white/10 hover:shadow-md hover:shadow-black/20 active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="mb-2 text-3xl font-bold">Teacher Profile</h1>
            <p className="text-muted">
              View and manage teacher information, assignments, performance, and
              more
            </p>
          </div>
        </div>
      </div>

      <TeacherDetailHeader teacher={teacher} />

      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-muted/10 via-muted/5 to-transparent"
          aria-hidden="true"
        />
        <CardContent className="relative z-10 p-0">
          <TeacherDetailTabs value={activeTab} onChange={handleTabChange} />
        </CardContent>
      </Card>

      <div>
        {activeTab === "overview" ? (
          <TeacherOverviewTab
            teacher={teacher}
            onEdit={() => setEditOpen(true)}
            onActivate={handleActivate}
            onDeactivate={handleDeactivate}
            onDelete={handleDelete}
            isChangingStatus={isChangingStatus}
            onNavigateToTab={handleTabChange}
          />
        ) : activeTab === "assignments" ? (
          <TeacherAssignmentsTab
            teacher={{
              id: teacher.id,
              fullName: teacher.fullName,
              maxClasses: teacher.maxClasses ?? null,
            }}
          />
        ) : activeTab === "attendance" ? (
          <TeacherAttendanceTab
            teacher={{
              id: teacher.id,
              fullName: teacher.fullName,
            }}
          />
        ) : activeTab === "performance" ? (
          <TeacherPerformanceTab
            teacher={{
              id: teacher.id,
              fullName: teacher.fullName,
            }}
          />
        ) : activeTab === "attendance" ? (
          <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                Attendance tab coming soon
              </p>
            </CardContent>
          </Card>
        ) : activeTab === "documents" ? (
          <TeacherDocumentsTab
            teacher={{
              id: teacher.id,
              fullName: teacher.fullName,
            }}
          />
        ) : activeTab === "notes" ? (
          <TeacherNotesTab
            teacher={{
              id: teacher.id,
              fullName: teacher.fullName,
            }}
          />
        ) : activeTab === "activity" ? (
          <TeacherActivityTab
            teacher={{
              id: teacher.id,
              fullName: teacher.fullName,
            }}
          />
        ) : null}
      </div>

      {/* Edit Teacher Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {teacher && (
            <EditTeacherModal
              teacher={teacher}
              onClose={() => setEditOpen(false)}
              onSubmit={async (payload) => {
                await busy.promise(
                  updateTeacher.mutateAsync({
                    teacherId: teacher.id,
                    payload,
                  }),
                  {
                    loading: "Updating teacher...",
                    success: "Teacher updated successfully",
                    error: "Failed to update teacher",
                  }
                );
              }}
              isLoading={updateTeacher.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function TeacherDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 animate-pulse rounded border border-white/10 bg-white/5" />
            <div className="space-y-2">
              <div className="h-8 w-64 animate-pulse rounded bg-white/10" />
              <div className="h-4 w-96 animate-pulse rounded bg-white/5" />
            </div>
          </div>
        </div>
      }
    >
      <TeacherDetailContent />
    </Suspense>
  );
}
