"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Plus, Pencil, Power, PowerOff, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { TeacherStatus } from "@/types/admin/teacher";
import { useRemoveSubject, useRemoveHomeroom, useTeacherSubjects, useTeacherHomeroom } from "@/hooks/admin/useTeachers";
import { useBusyToast } from "@/hooks/useBusyToast";
import { AssignSubjectModal } from "@/components/modals/AssignSubjectModal";
import { AssignHomeroomModal } from "@/components/modals/AssignHomeroomModal";
import { useTeacherWorkload } from "@/hooks/admin/useTeacherWorkload";
import { AlertTriangle, TrendingUp, Users, BookOpen, Clock } from "lucide-react";
import type { TeacherDetailTabId } from "@/components/admin/teachers/detail/TeacherDetailTabs";

type TeacherOverviewTabProps = {
  teacher: {
    id: string;
    fullName: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    status: TeacherStatus;
    homeroom?: { id: string; name: string } | null;
    subjects?: Array<{ id: string; name: string }>;
    employeeId?: string | null;
    department?: string | null;
    hireDate?: string | Date | null;
    terminationDate?: string | Date | null;
    createdAt: string | Date;
    updatedAt?: string | Date | null;
  };
  onEdit?: () => void;
  onActivate?: () => void;
  onDeactivate?: () => void;
  onDelete?: () => void;
  isChangingStatus?: boolean;
  onNavigateToTab?: (tab: TeacherDetailTabId) => void;
};

function formatDate(value?: string | Date | null) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function getStatusBadgeClass(status: TeacherStatus): string {
  switch (status) {
    case "active":
      return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
    case "inactive":
      return "border-neutral-400/30 bg-neutral-500/10 text-neutral-200";
    case "on_leave":
      return "border-amber-400/30 bg-amber-500/10 text-amber-200";
    case "terminated":
      return "border-red-400/30 bg-red-500/10 text-red-200";
    default:
      return "border-white/10 bg-white/5 text-white/80";
  }
}

function getStatusLabel(status: TeacherStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "inactive":
      return "Inactive";
    case "on_leave":
      return "On Leave";
    case "terminated":
      return "Terminated";
    default:
      return status;
  }
}

export function TeacherOverviewTab({
  teacher,
  onEdit,
  onActivate,
  onDeactivate,
  onDelete,
  isChangingStatus,
  onNavigateToTab,
}: TeacherOverviewTabProps) {
  const canActivate = teacher.status === "inactive" || teacher.status === "terminated" || teacher.status === "on_leave";
  const canDeactivate = teacher.status === "active";
  const canDelete = teacher.status !== "terminated";

  const [assignSubjectOpen, setAssignSubjectOpen] = React.useState(false);
  const [assignHomeroomOpen, setAssignHomeroomOpen] = React.useState(false);

  const { data: subjectsData } = useTeacherSubjects(teacher.id);
  const { data: homeroomData } = useTeacherHomeroom(teacher.id);
  const { data: workloadData } = useTeacherWorkload(teacher.id);
  const subjects = subjectsData?.data ?? [];
  const homeroom = homeroomData?.data ?? null;
  const workload = workloadData?.data;

  const removeSubjectMutation = useRemoveSubject();
  const removeHomeroomMutation = useRemoveHomeroom();
  const busy = useBusyToast();

  const handleRemoveSubject = async (subjectId: string, subjectName: string) => {
    if (!confirm(`Remove "${subjectName}" from ${teacher.fullName}?`)) return;
    try {
      await busy.promise(
        removeSubjectMutation.mutateAsync({ teacherId: teacher.id, subjectId }),
        {
          loading: "Removing subject...",
          success: `"${subjectName}" removed successfully`,
          error: (e: Error) => e.message || "Failed to remove subject",
        }
      );
    } catch {
      // Error already handled by busy.promise
    }
  };

  const handleRemoveHomeroom = async () => {
    if (!homeroom) return;
    if (!confirm(`Remove ${teacher.fullName} as homeroom teacher for "${homeroom.name}"?`)) return;
    try {
      await busy.promise(
        removeHomeroomMutation.mutateAsync(teacher.id),
        {
          loading: "Removing homeroom...",
          success: "Homeroom assignment removed successfully",
          error: (e: Error) => e.message || "Failed to remove homeroom",
        }
      );
    } catch {
      // Error already handled by busy.promise
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Overview main */}
      <Card className="lg:col-span-2 border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CardTitle>Overview</CardTitle>
            <Badge
              variant="outline"
              className={getStatusBadgeClass(teacher.status)}
            >
              {getStatusLabel(teacher.status)}
            </Badge>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setAssignSubjectOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Assign Subjects
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Subjects */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80 mb-2">
              Subjects ({subjects.length})
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {subjects.length > 0 ? (
                subjects.map((s) => (
                  <Badge
                    key={s.id}
                    variant="outline"
                    className="border-white/10 bg-white/5 group gap-1 pr-1"
                  >
                    {s.name}
                    <button
                      type="button"
                      onClick={() => handleRemoveSubject(s.id, s.name)}
                      disabled={removeSubjectMutation.isPending}
                      className="ml-1 rounded-full hover:bg-white/10 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      title={`Remove ${s.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground/80">
                  No subjects assigned yet.
                </p>
              )}
            </div>
          </div>

          {/* Homeroom */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                Homeroom Class
              </p>
              {!homeroom && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs gap-1"
                  onClick={() => setAssignHomeroomOpen(true)}
                >
                  <Plus className="h-3 w-3" />
                  Assign
                </Button>
              )}
            </div>
            {homeroom ? (
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-brand/30 bg-brand/10 text-brand gap-1 pr-1"
                >
                  {homeroom.name}
                  {homeroom.gradeName && ` (${homeroom.gradeName})`}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-white/60 hover:text-red-300 hover:bg-red-500/10"
                  onClick={handleRemoveHomeroom}
                  disabled={removeHomeroomMutation.isPending}
                  title="Remove homeroom assignment"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/80">
                No homeroom assigned.
              </p>
            )}
          </div>

          {/* Professional quick info */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                Employee ID
              </p>
              <p className="mt-1 text-sm">{teacher.employeeId ?? "—"}</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                Department
              </p>
              <p className="mt-1 text-sm">{teacher.department ?? "—"}</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                Hire Date
              </p>
              <p className="mt-1 text-sm">{formatDate(teacher.hireDate)}</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                Termination Date
              </p>
              <p className="mt-1 text-sm">
                {formatDate(teacher.terminationDate)}
              </p>
            </div>
          </div>

          {/* Workload Visualization */}
          {workload && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80 mb-3">
                Current Workload
              </p>
              <div className="space-y-4">
                {/* Warnings */}
                {(workload.warnings.isOverCapacity || workload.warnings.isAboveAverage) && (
                  <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-300 mt-0.5" />
                      <div className="flex-1 text-xs">
                        {workload.warnings.isOverCapacity && (
                          <p className="text-amber-200 font-medium mb-1">
                            Over Capacity: This teacher has exceeded their maximum capacity limits.
                          </p>
                        )}
                        {workload.warnings.isAboveAverage && !workload.warnings.isOverCapacity && (
                          <p className="text-amber-200 font-medium mb-1">
                            Above Average: This teacher's workload is significantly above the school average.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Workload Metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                        Classes
                      </p>
                    </div>
                    <p className="text-2xl font-bold">{workload.current.classes}</p>
                    {workload.capacity.maxClasses && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">of {workload.capacity.maxClasses}</span>
                          <span className={workload.capacity.classUtilization && workload.capacity.classUtilization > 100 ? "text-red-400" : "text-muted-foreground"}>
                            {workload.capacity.classUtilization?.toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              workload.capacity.classUtilization && workload.capacity.classUtilization > 100
                                ? "bg-red-500"
                                : workload.capacity.classUtilization && workload.capacity.classUtilization > 80
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            }`}
                            style={{
                              width: `${Math.min(workload.capacity.classUtilization || 0, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                        Students
                      </p>
                    </div>
                    <p className="text-2xl font-bold">{workload.current.students}</p>
                    {workload.capacity.maxStudents && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">of {workload.capacity.maxStudents}</span>
                          <span className={workload.capacity.studentUtilization && workload.capacity.studentUtilization > 100 ? "text-red-400" : "text-muted-foreground"}>
                            {workload.capacity.studentUtilization?.toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              workload.capacity.studentUtilization && workload.capacity.studentUtilization > 100
                                ? "bg-red-500"
                                : workload.capacity.studentUtilization && workload.capacity.studentUtilization > 80
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            }`}
                            style={{
                              width: `${Math.min(workload.capacity.studentUtilization || 0, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional Metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Workload Hours</p>
                    </div>
                    <p className="text-lg font-semibold">{workload.current.workloadHours}h</p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">vs School Avg</p>
                    </div>
                    <p className={`text-lg font-semibold ${
                      workload.comparison.differenceFromAverage > 0 ? "text-amber-400" : "text-emerald-400"
                    }`}>
                      {workload.comparison.differenceFromAverage > 0 ? "+" : ""}
                      {workload.comparison.differenceFromAverage.toFixed(1)} classes
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Avg: {workload.comparison.schoolAvgClasses.toFixed(1)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Meta */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                Created
              </p>
              <p className="mt-1 text-sm">{formatDate(teacher.createdAt)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                Updated
              </p>
              <p className="mt-1 text-sm">
                {formatDate(teacher.updatedAt)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Right rail */}
      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4" />
            Edit profile
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => onNavigateToTab?.("assignments")}
          >
            Manage assignments
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => onNavigateToTab?.("attendance")}
          >
            Record attendance
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => onNavigateToTab?.("documents")}
          >
            Upload documents
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => onNavigateToTab?.("notes")}
          >
            Add internal note
          </Button>

          {/* Status Management */}
          <Separator className="my-3 bg-white/10" />
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80 mb-2">
            Status Management
          </p>

          {canActivate && (
            <Button
              variant="outline"
              className="w-full justify-start gap-2 border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 hover:text-emerald-100"
              onClick={onActivate}
              disabled={isChangingStatus}
            >
              <Power className="h-4 w-4" />
              Activate Teacher
            </Button>
          )}

          {canDeactivate && (
            <Button
              variant="outline"
              className="w-full justify-start gap-2 border-amber-400/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 hover:text-amber-100"
              onClick={onDeactivate}
              disabled={isChangingStatus}
            >
              <PowerOff className="h-4 w-4" />
              Deactivate Teacher
            </Button>
          )}

          {canDelete && (
            <Button
              variant="outline"
              className="w-full justify-start gap-2 border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-red-100"
              onClick={onDelete}
              disabled={isChangingStatus}
            >
              <Trash2 className="h-4 w-4" />
              Terminate Teacher
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <AssignSubjectModal
        open={assignSubjectOpen}
        onOpenChange={setAssignSubjectOpen}
        teacherId={teacher.id}
        teacherName={teacher.fullName}
      />

      <AssignHomeroomModal
        open={assignHomeroomOpen}
        onOpenChange={setAssignHomeroomOpen}
        teacherId={teacher.id}
        teacherName={teacher.fullName}
      />
    </div>
  );
}
