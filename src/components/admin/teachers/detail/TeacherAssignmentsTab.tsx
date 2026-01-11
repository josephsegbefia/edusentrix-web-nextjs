// src/components/admin/teachers/detail/TeacherAssignmentsTab.tsx
"use client";

import * as React from "react";
import { Plus, ClipboardList, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

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
  const [editingAssignment, setEditingAssignment] = React.useState<TeacherAssignmentDTO | null>(null);

  const deactivateMutation = useDeactivateTeacherAssignment(teacher.id);

  const handleEdit = (assignment: TeacherAssignmentDTO) => {
    setEditingAssignment(assignment);
    setEditOpen(true);
  };

  const handleDeactivate = async (assignment: TeacherAssignmentDTO) => {
    if (!confirm(`Are you sure you want to deactivate this assignment?\n\n${assignment.subject?.name} • ${assignment.classGroup?.label || assignment.classGroup?.name}`)) {
      return;
    }
    try {
      await deactivateMutation.mutateAsync(assignment.id);
      toast.success("Assignment deactivated", {
        description: `${assignment.subject?.name || "Assignment"} has been deactivated.`,
      });
    } catch (e: unknown) {
      const error = e as { message?: string };
      toast.error(error?.message || "Failed to deactivate assignment");
    }
  };

  return (
    <>
      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Assignments</CardTitle>
          <Button className="gap-2" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Create Assignment
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {atCapacity ? (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-amber-100">
              <p className="text-sm font-semibold">Capacity warning</p>
              <p className="text-sm text-white/80">
                This teacher currently has <b>{activeCount}</b> active
                assignments (limit: <b>{maxClasses}</b>).
              </p>
            </div>
          ) : null}

          <Separator className="bg-white/10" />

          {isLoading ? (
            <div className="flex items-center gap-3 py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
              <p className="text-sm text-muted-foreground">
                Loading assignments…
              </p>
            </div>
          ) : isError ? (
            <p className="py-10 text-sm text-red-300/80">
              Failed to load assignments.
            </p>
          ) : assignments.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-start gap-4">
                <div className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/5">
                  <ClipboardList className="h-5 w-5 text-white/80" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold">No assignments yet</p>
                  <p className="text-sm text-muted-foreground">
                    Create the first assignment to connect a subject and class
                    group for this teacher.
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <Button className="gap-2" onClick={() => setOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Create Assignment
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {assignments.map((a) => (
                <div
                  key={a.id}
                  className="group flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/8"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <p className="text-sm font-semibold">
                        {a.subject?.name ?? "—"}{" "}
                        <span className="text-muted-foreground/70">•</span>{" "}
                        {a.classGroup?.label || a.classGroup?.name || "—"}
                      </p>
                      {a.schedule?.dayOfWeek != null &&
                      a.schedule?.startTime &&
                      a.schedule?.endTime ? (
                        <p className="text-xs text-muted-foreground">
                          Scheduled: {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][a.schedule.dayOfWeek] || a.schedule.dayOfWeek} • {a.schedule.startTime}
                          -{a.schedule.endTime}
                          {a.schedule.location ? ` • ${a.schedule.location}` : ""}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No schedule set.
                        </p>
                      )}
                      {a.notes ? (
                        <p className="text-xs text-muted-foreground/80">
                          {a.notes}
                        </p>
                      ) : null}
                      {a.workloadHours > 0 && (
                        <p className="text-xs text-muted-foreground/60">
                          Workload: {a.workloadHours} hrs/week
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10"
                        onClick={() => handleEdit(a)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-white/60 hover:text-red-300 hover:bg-red-500/10"
                        onClick={() => handleDeactivate(a)}
                        disabled={deactivateMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
