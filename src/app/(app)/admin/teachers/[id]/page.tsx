// src/app/(app)/admin/teachers/[id]/page.tsx
"use client";

import * as React from "react";
import { Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useTeacher,
  useUpdateTeacher,
  useActivateTeacher,
  useDeactivateTeacher,
  useDeleteTeacher,
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

  const isChangingStatus =
    activateTeacher.isPending ||
    deactivateTeacher.isPending ||
    deleteTeacher.isPending;

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
    if (!confirm(`Are you sure you want to deactivate ${teacher.fullName}?`))
      return;
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
    if (
      !confirm(
        `Are you sure you want to terminate ${teacher.fullName}?\n\nThis will:\n• Set their status to "Terminated"\n• Deactivate all their active assignments\n• Remove them as homeroom teacher (if applicable)\n\nThis action cannot be undone.`
      )
    )
      return;
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
      <div className="space-y-6">
        <Card className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-950/40 via-slate-950/60 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-500/10 via-transparent to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 flex items-center justify-between gap-4 p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10">
                <AlertTriangle className="h-6 w-6 text-red-400" />
              </div>
              <div>
                <div className="font-semibold text-white">
                  Missing teacher identifier
                </div>
                <p className="text-sm text-red-200/70">
                  The teacher ID was not provided in the URL.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push("/admin/teachers")}
              className="gap-2 rounded-xl border-red-500/30 bg-red-500/10 text-red-200 hover:border-red-500/50 hover:bg-red-500/20"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Teachers
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        {/* Premium header skeleton */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 via-slate-950/95 to-black p-8 shadow-2xl shadow-black/40">
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-transparent blur-3xl"
            aria-hidden="true"
          />
          <div className="flex animate-pulse items-center gap-4">
            <div className="h-9 w-9 rounded-xl bg-white/10" />
              <div className="space-y-2">
              <div className="h-8 w-48 rounded bg-white/10" />
              <div className="h-4 w-64 rounded bg-white/5" />
                </div>
              </div>
            </div>

        {/* Header card skeleton */}
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
          <CardContent className="flex animate-pulse items-center gap-6 p-8">
            <div className="h-24 w-24 rounded-2xl bg-white/10" />
            <div className="flex-1 space-y-3">
              <div className="h-6 w-48 rounded bg-white/10" />
              <div className="flex gap-2">
                <div className="h-5 w-20 rounded-full bg-white/10" />
                <div className="h-5 w-24 rounded-full bg-white/5" />
              </div>
              <div className="h-4 w-64 rounded bg-white/5" />
            </div>
          </CardContent>
        </Card>

        {/* Tabs skeleton */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={i}
              className={cn(
                "h-10 rounded-xl",
                i === 1 ? "w-28 bg-indigo-500/20" : "w-24 bg-white/5"
              )}
            />
          ))}
        </div>

        {/* Content skeleton */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card className="h-64 animate-pulse rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-black shadow-xl" />
          <Card className="h-64 animate-pulse rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-black shadow-xl" />
        </div>
      </div>
    );
  }

  if (isError || !teacher) {
    return (
      <div className="space-y-6">
        <Card className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-950/40 via-slate-950/60 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-500/10 via-transparent to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 flex flex-col items-center justify-center gap-4 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10">
              <AlertTriangle className="h-8 w-8 text-red-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-white">
                  Unable to load teacher details
              </h2>
              <p className="max-w-md text-sm text-red-200/70">
                The teacher might not exist or you might not have permission to
                view their profile.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push("/admin/teachers")}
              className="mt-2 gap-2 rounded-xl border-red-500/30 bg-red-500/10 text-red-200 hover:border-red-500/50 hover:bg-red-500/20"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Teachers
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Premium Page Header */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 via-slate-950/95 to-black p-8 shadow-2xl shadow-black/40">
        {/* Background decorations */}
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-gradient-to-tr from-violet-500/10 via-fuchsia-500/5 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => router.push("/admin/teachers")}
              className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 transition-all duration-200 hover:border-white/20 hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 shadow-lg shadow-indigo-500/10">
                <Users className="h-6 w-6 text-indigo-300" />
              </div>
          <div>
                <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                  Teacher Profile
                </h1>
                <p className="text-sm text-white/50">
                  View and manage teacher details
                </p>
              </div>
            </div>
          </div>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-white/50">
            <button
              type="button"
              onClick={() => router.push("/admin/teachers")}
              className="hover:text-white/80 transition-colors"
            >
              Teachers
            </button>
            <ChevronRight className="h-3 w-3" />
            <span className="text-white/80">{teacher.fullName}</span>
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
    </div>
  );
}

export default function TeacherDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-8">
          {/* Premium header skeleton */}
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 via-slate-950/95 to-black p-8 shadow-2xl shadow-black/40">
            <div
              className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-transparent blur-3xl"
              aria-hidden="true"
            />
            <div className="flex animate-pulse items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-white/10" />
            <div className="space-y-2">
                <div className="h-8 w-48 rounded bg-white/10" />
                <div className="h-4 w-64 rounded bg-white/5" />
              </div>
            </div>
          </div>

          {/* Header card skeleton */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-950/90 to-black p-8 shadow-2xl shadow-black/40">
            <div className="flex animate-pulse items-center gap-6">
              <div className="h-24 w-24 rounded-2xl bg-white/10" />
              <div className="flex-1 space-y-3">
                <div className="h-6 w-48 rounded bg-white/10" />
                <div className="flex gap-2">
                  <div className="h-5 w-20 rounded-full bg-white/10" />
                  <div className="h-5 w-24 rounded-full bg-white/5" />
                </div>
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
