// src/components/admin/teachers/detail/TeacherAssignmentsTab.tsx
"use client";

import * as React from "react";
import {
  Plus,
  ClipboardList,
  Pencil,
  Trash2,
  Clock,
  MapPin,
  BookOpen,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import {
  useAcademicPeriods,
  type AcademicPeriodDTO,
} from "@/hooks/admin/useAcademicPeriods";
import {
  useTeacherAssignments,
  useDeactivateTeacherAssignment,
  type TeacherAssignmentDTO,
} from "@/hooks/admin/useTeacherAssignments";
import { CreateTeacherAssignmentModal } from "@/components/admin/teachers/detail/CreateTeacherAssignmentModal";
import { EditTeacherAssignmentModal } from "@/components/admin/teachers/detail/EditTeacherAssignmentModal";

export function TeacherAssignmentsTab({
  teacher,
}: {
  teacher: { id: string; fullName: string; maxClasses: number | null };
}) {
  const { data: periodsRes } = useAcademicPeriods();
  const periods = periodsRes?.periods ?? [];
  const currentPeriod =
    periods.find((p: AcademicPeriodDTO) => p.isCurrent) || periods[0] || null;

  const [periodId, setPeriodId] = React.useState<string>("");

  React.useEffect(() => {
    if (!periodId && currentPeriod?._id) setPeriodId(currentPeriod._id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPeriod?._id]);

  const { data, isLoading, isError } = useTeacherAssignments(
    teacher.id,
    periodId || undefined,
    "active"
  );
  const assignments = data?.data ?? [];

  const activeCount = assignments.length;
  const maxClasses = teacher.maxClasses;
  const atCapacity =
    typeof maxClasses === "number" &&
    maxClasses >= 0 &&
    activeCount >= maxClasses;

  const [open, setOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editingAssignment, setEditingAssignment] =
    React.useState<TeacherAssignmentDTO | null>(null);

  const deactivateMutation = useDeactivateTeacherAssignment(teacher.id);

  const handleEdit = (assignment: TeacherAssignmentDTO) => {
    setEditingAssignment(assignment);
    setEditOpen(true);
  };

  const handleDeactivate = async (assignment: TeacherAssignmentDTO) => {
    if (
      !confirm(
        `Are you sure you want to deactivate this assignment?\n\n${
          assignment.subject?.name
        } • ${assignment.classGroup?.label || assignment.classGroup?.name}`
      )
    ) {
      return;
    }
    try {
      await deactivateMutation.mutateAsync(assignment.id);
      toast.success("Assignment deactivated", {
        description: `${
          assignment.subject?.name || "Assignment"
        } has been deactivated.`,
      });
    } catch (e: unknown) {
      const error = e as { message?: string };
      toast.error(error?.message || "Failed to deactivate assignment");
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header Card */}
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-linear-to-br from-purple-500/15 via-indigo-500/10 to-transparent blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
            aria-hidden="true"
          />

          <CardHeader className="relative z-10 flex flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-linear-to-br from-purple-500/20 to-indigo-500/20 shadow-inner shadow-white/5">
                <ClipboardList className="h-5 w-5 text-purple-300" />
              </div>
              <div className="space-y-0.5">
                <CardTitle className="text-lg font-semibold tracking-tight text-white">
                  Assignments
                </CardTitle>
                <p className="text-xs text-white/50">
                  {activeCount} active assignment
                  {activeCount !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <Button
              className="gap-2 rounded-xl border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20"
              variant="outline"
              onClick={() => setOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Create Assignment
            </Button>
          </CardHeader>
        </Card>

        {/* Capacity Warning */}
        {atCapacity && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 shadow-lg shadow-black/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-300" />
              <div>
                <p className="text-sm font-semibold text-amber-200">
                  Capacity Warning
                </p>
                <p className="text-sm text-amber-200/80">
                  This teacher currently has <b>{activeCount}</b> active
                  assignments (limit: <b>{maxClasses}</b>).
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Assignments List Card */}
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-indigo-500/5 via-transparent to-transparent"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
            aria-hidden="true"
          />

          <CardContent className="relative z-10 p-6">
            {isLoading ? (
              <div className="flex items-center justify-center gap-3 py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-purple-400" />
                <p className="text-sm text-white/60">Loading assignments…</p>
              </div>
            ) : isError ? (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
                <p className="text-sm text-red-300">
                  Failed to load assignments.
                </p>
              </div>
            ) : assignments.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/2 p-8">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-linear-to-br from-purple-500/20 to-indigo-500/20">
                    <ClipboardList className="h-7 w-7 text-purple-300" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-white">
                      No assignments yet
                    </p>
                    <p className="text-sm text-white/50">
                      Create the first assignment to connect a subject and class
                      group for this teacher.
                    </p>
                  </div>
                  <Button
                    className="mt-2 gap-2 rounded-xl border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20"
                    variant="outline"
                    onClick={() => setOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Create Assignment
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {assignments.map((a) => (
                  <AssignmentCard
                    key={a.id}
                    assignment={a}
                    onEdit={handleEdit}
                    onDeactivate={handleDeactivate}
                    isDeactivating={deactivateMutation.isPending}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CreateTeacherAssignmentModal
        open={open}
        onOpenChange={setOpen}
        teacher={teacher}
        currentActiveAssignmentsCount={activeCount}
      />

      {editingAssignment && (
        <EditTeacherAssignmentModal
          open={editOpen}
          onOpenChange={(v) => {
            setEditOpen(v);
            if (!v) setEditingAssignment(null);
          }}
          teacher={teacher}
          assignment={editingAssignment}
        />
      )}
    </>
  );
}

// Assignment Card Component
function AssignmentCard({
  assignment,
  onEdit,
  onDeactivate,
  isDeactivating,
}: {
  assignment: TeacherAssignmentDTO;
  onEdit: (a: TeacherAssignmentDTO) => void;
  onDeactivate: (a: TeacherAssignmentDTO) => void;
  isDeactivating: boolean;
}) {
  const hasSchedule =
    assignment.schedule?.dayOfWeek != null &&
    assignment.schedule?.startTime &&
    assignment.schedule?.endTime;

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/2 p-5 transition-all duration-200 hover:border-purple-500/30 hover:bg-white/5">
      {/* Accent bar */}
      <div
        className="absolute inset-y-0 left-0 w-1 bg-linear-to-b from-purple-500 to-indigo-500"
        aria-hidden="true"
      />

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3 pl-3">
          {/* Subject & Class */}
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="rounded-lg border-indigo-500/30 bg-indigo-500/10 text-indigo-200"
            >
              <BookOpen className="mr-1.5 h-3 w-3" />
              {assignment.subject?.name ?? "—"}
            </Badge>
            <span className="text-white/30">•</span>
            <Badge
              variant="outline"
              className="rounded-lg border-purple-500/30 bg-purple-500/10 text-purple-200"
            >
              {assignment.classGroup?.label ||
                assignment.classGroup?.name ||
                "—"}
            </Badge>
          </div>

          {/* Schedule */}
          {hasSchedule ? (
            <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {dayNames[assignment.schedule!.dayOfWeek!] ||
                  assignment.schedule!.dayOfWeek}{" "}
                • {assignment.schedule!.startTime}-
                {assignment.schedule!.endTime}
              </span>
              {assignment.schedule?.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {assignment.schedule.location}
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs text-white/40">No schedule set</p>
          )}

          {/* Notes */}
          {assignment.notes && (
            <p className="text-xs text-white/50 line-clamp-2">
              {assignment.notes}
            </p>
          )}

          {/* Workload */}
          {assignment.workloadHours > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-white/40">
              <Zap className="h-3 w-3" />
              {assignment.workloadHours} hrs/week
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
            onClick={() => onEdit(assignment)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-white/60 hover:bg-red-500/10 hover:text-red-300"
            onClick={() => onDeactivate(assignment)}
            disabled={isDeactivating}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
