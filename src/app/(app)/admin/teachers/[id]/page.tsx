// src/app/(app)/admin/teachers/[id]/page.tsx
"use client";

import * as React from "react";
import { Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useTeacher,
  useUpdateTeacher,
  useActivateTeacher,
  useDeactivateTeacher,
  useDeleteTeacher,
  useUpdateTeacherLeave,
} from "@/hooks/admin/useTeachers";
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
import { TeacherDutiesTab } from "@/components/admin/teachers/detail/TeacherDutiesTab";
import EditTeacherModal from "@/components/modals/EditTeacherModal";
import { UpdateLeaveModal } from "@/components/modals/UpdateLeaveModal";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
function getInitialTab(sp: URLSearchParams | null): TeacherDetailTabId {
  if (!sp) return "overview";
  const raw = sp.get("tab");
  if (
    raw === "overview" ||
    raw === "assignments" ||
    raw === "duties" ||
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
  const { confirm, confirmationDialog } = useConfirmationDialog();

  const teacherId = params?.id;
  const [activeTab, setActiveTab] = React.useState<TeacherDetailTabId>(() =>
    getInitialTab(searchParams)
  );
  const [editOpen, setEditOpen] = React.useState(false);
  const [updateLeaveOpen, setUpdateLeaveOpen] = React.useState(false);

  const { data, isLoading, isError } = useTeacher(String(teacherId));
  const teacher = data?.data;
  const updateTeacher = useUpdateTeacher();
  const activateTeacher = useActivateTeacher();
  const deactivateTeacher = useDeactivateTeacher();
  const deleteTeacher = useDeleteTeacher();
  const updateTeacherLeave = useUpdateTeacherLeave();

  const isChangingStatus =
    activateTeacher.isPending ||
    deactivateTeacher.isPending ||
    deleteTeacher.isPending ||
    updateTeacherLeave.isPending;

  const handleActivate = async () => {
    if (!teacher) return;
    try {
      await busy.promise(activateTeacher.mutateAsync(teacher.id), {
        loading: "Activating teacher...",
        success: "Teacher activated successfully",
        error: (e: Error) => e.message || "Failed to activate teacher",
      });
    } catch {
      // Error already handled by busy.promise
    }
  };

  const handleDeactivate = async () => {
    if (!teacher) return;
    const decision = await confirm({
      title: "Deactivate Teacher?",
      description: `Are you sure you want to deactivate ${teacher.fullName}?`,
      confirmLabel: "Deactivate",
      cancelLabel: "Keep Active",
      intent: "warning",
    });
    if (decision !== "confirm") return;
    try {
      await busy.promise(deactivateTeacher.mutateAsync(teacher.id), {
        loading: "Deactivating teacher...",
        success: "Teacher deactivated successfully",
        error: (e: Error) => e.message || "Failed to deactivate teacher",
      });
    } catch {
      // Error already handled by busy.promise
    }
  };

  const handleDelete = async () => {
    if (!teacher) return;
    const decision = await confirm({
      title: "Terminate Teacher?",
      description: `Are you sure you want to terminate ${teacher.fullName}? This will set their status to "Terminated", deactivate active assignments, and remove homeroom assignments. This action cannot be undone.`,
      confirmLabel: "Terminate",
      cancelLabel: "Cancel",
      intent: "destructive",
    });
    if (decision !== "confirm") return;
    try {
      await busy.promise(deleteTeacher.mutateAsync(teacher.id), {
        loading: "Terminating teacher...",
        success: "Teacher terminated successfully",
        error: (e: Error) => e.message || "Failed to terminate teacher",
      });
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
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="flex max-w-md flex-col items-center gap-6 rounded-2xl border border-red-500/20 bg-red-950/20 px-8 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15">
            <AlertTriangle className="h-7 w-7 text-red-400" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-white">
              Missing teacher identifier
            </h2>
            <p className="text-sm text-white/60">
              The teacher ID was not provided in the URL.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push("/admin/teachers")}
            className="gap-2 rounded-lg border-white/15 bg-white/5 text-white/90 hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Teachers
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Page header skeleton */}
        <div className="flex items-center gap-4">
          <div className="h-9 w-9 animate-pulse rounded-lg bg-white/10" />
          <div className="space-y-2">
            <div className="h-5 w-32 animate-pulse rounded bg-white/10" />
            <div className="h-3 w-48 animate-pulse rounded bg-white/5" />
          </div>
        </div>

        {/* Profile header skeleton */}
        <div className="flex animate-pulse items-center gap-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <div className="h-20 w-20 shrink-0 rounded-2xl bg-white/10" />
          <div className="flex-1 space-y-3">
            <div className="h-7 w-56 rounded bg-white/10" />
            <div className="flex gap-2">
              <div className="h-6 w-16 rounded-full bg-white/5" />
              <div className="h-6 w-24 rounded-full bg-white/5" />
            </div>
            <div className="h-4 w-72 rounded bg-white/5" />
          </div>
        </div>

        {/* Tabs skeleton - keep structure for consistency */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={i}
              className={cn(
                "h-10 animate-pulse rounded-xl",
                i === 1 ? "w-28 bg-indigo-500/20" : "w-24 bg-white/5"
              )}
            />
          ))}
        </div>

        {/* Content skeleton */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="h-80 animate-pulse rounded-2xl border border-white/10 bg-white/[0.02]" />
          <div className="h-80 animate-pulse rounded-2xl border border-white/10 bg-white/[0.02]" />
        </div>
      </div>
    );
  }

  if (isError || !teacher) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <div className="flex max-w-md flex-col items-center gap-6 rounded-2xl border border-red-500/20 bg-red-950/20 px-8 py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15">
            <AlertTriangle className="h-8 w-8 text-red-400" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-white">
              Unable to load teacher details
            </h2>
            <p className="text-sm text-white/60">
              The teacher might not exist or you might not have permission to
              view their profile.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push("/admin/teachers")}
            className="gap-2 rounded-lg border-white/15 bg-white/5 text-white/90 hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Teachers
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => router.push("/admin/teachers")}
            className="h-9 w-9 shrink-0 rounded-lg border border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <nav className="flex items-center gap-2 text-xs text-white/50">
              <button
                type="button"
                onClick={() => router.push("/admin/teachers")}
                className="transition-colors hover:text-white/80"
              >
                Teachers
              </button>
              <ChevronRight className="h-3 w-3" />
              <span className="text-white/80">{teacher.fullName}</span>
            </nav>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">
              Teacher Profile
            </h1>
          </div>
        </div>
      </div>

      {/* Teacher Header Card */}
      <TeacherDetailHeader teacher={teacher} />

      {/* Tabs Navigation */}
      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/5 via-transparent to-transparent"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
          aria-hidden="true"
        />
        <CardContent className="relative z-10 p-0">
          <TeacherDetailTabs value={activeTab} onChange={handleTabChange} />
        </CardContent>
      </Card>

      {/* Tab Content */}
      <div>
        {activeTab === "overview" ? (
          <TeacherOverviewTab
            teacher={teacher}
            onEdit={() => setEditOpen(true)}
            onActivate={handleActivate}
            onDeactivate={handleDeactivate}
            onDelete={handleDelete}
            onUpdateLeave={() => setUpdateLeaveOpen(true)}
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
        ) : activeTab === "duties" ? (
          <TeacherDutiesTab
            teacher={{
              id: teacher.id,
              fullName: teacher.fullName,
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
      {teacher && (
        <EditTeacherModal
          open={editOpen}
          onOpenChange={setEditOpen}
          teacher={teacher}
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

      {/* Update Leave Modal */}
      {teacher && teacher.status === "on_leave" && (
        <UpdateLeaveModal
          open={updateLeaveOpen}
          onOpenChange={setUpdateLeaveOpen}
          teacherName={teacher.fullName}
          initialStartDate={teacher.leaveStartDate ?? null}
          initialEndDate={teacher.leaveEndDate ?? null}
          initialReason={teacher.leaveReason ?? null}
          onSubmit={async (payload) => {
            await busy.promise(
              updateTeacherLeave.mutateAsync({
                teacherId: teacher.id,
                ...payload,
              }),
              {
                loading: "Updating leave dates...",
                success: "Leave dates updated successfully",
                error: (e: Error) => e.message || "Failed to update leave",
              }
            );
          }}
          isPending={updateTeacherLeave.isPending}
        />
      )}
      {confirmationDialog}
    </div>
  );
}

export default function TeacherDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="h-9 w-9 animate-pulse rounded-lg bg-white/10" />
            <div className="space-y-2">
              <div className="h-5 w-32 animate-pulse rounded bg-white/10" />
              <div className="h-3 w-48 animate-pulse rounded bg-white/5" />
            </div>
          </div>
          <div className="flex animate-pulse items-center gap-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <div className="h-20 w-20 shrink-0 rounded-2xl bg-white/10" />
            <div className="flex-1 space-y-3">
              <div className="h-7 w-56 rounded bg-white/10" />
              <div className="flex gap-2">
                <div className="h-6 w-16 rounded-full bg-white/5" />
                <div className="h-6 w-24 rounded-full bg-white/5" />
              </div>
            </div>
          </div>
        </div>
      }
    >
      <TeacherDetailContent />
    </Suspense>
  );
}
