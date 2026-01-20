"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  BookOpen,
  Briefcase,
  Calendar,
  Clock,
  FileText,
  Home,
  Pencil,
  Plus,
  Power,
  PowerOff,
  StickyNote,
  Trash2,
  TrendingUp,
  Users,
  X,
  Zap,
  ArrowRight,
  CalendarCheck,
  FolderOpen,
} from "lucide-react";
import type { TeacherStatus } from "@/types/admin/teacher";
import {
  useRemoveSubject,
  useRemoveHomeroom,
  useTeacherSubjects,
  useTeacherHomeroom,
} from "@/hooks/admin/useTeachers";
import { useBusyToast } from "@/hooks/useBusyToast";
import { AssignSubjectModal } from "@/components/modals/AssignSubjectModal";
import { AssignHomeroomModal } from "@/components/modals/AssignHomeroomModal";
import { useTeacherWorkload } from "@/hooks/admin/useTeacherWorkload";
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

const statusConfig: Record<
  TeacherStatus,
  { bg: string; border: string; text: string; dot: string }
> = {
  active: {
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/40",
    text: "text-emerald-300",
    dot: "bg-emerald-500",
  },
  inactive: {
    bg: "bg-slate-500/15",
    border: "border-slate-500/40",
    text: "text-slate-300",
    dot: "bg-slate-500",
  },
  on_leave: {
    bg: "bg-amber-500/15",
    border: "border-amber-500/40",
    text: "text-amber-300",
    dot: "bg-amber-500",
  },
  terminated: {
    bg: "bg-red-500/15",
    border: "border-red-500/40",
    text: "text-red-300",
    dot: "bg-red-500",
  },
};

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

// Premium stat card component
type StatCardProps = {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  description?: string;
  tone: "indigo" | "purple" | "emerald" | "amber" | "cyan" | "rose";
  valueClassName?: string;
};

const toneStyles: Record<
  StatCardProps["tone"],
  { gradient: string; iconBg: string; iconColor: string }
> = {
  indigo: {
    gradient: "from-indigo-500/10 via-indigo-500/5 to-transparent",
    iconBg: "bg-indigo-500/20 border-indigo-500/30",
    iconColor: "text-indigo-300",
  },
  purple: {
    gradient: "from-purple-500/10 via-purple-500/5 to-transparent",
    iconBg: "bg-purple-500/20 border-purple-500/30",
    iconColor: "text-purple-300",
  },
  emerald: {
    gradient: "from-emerald-500/10 via-emerald-500/5 to-transparent",
    iconBg: "bg-emerald-500/20 border-emerald-500/30",
    iconColor: "text-emerald-300",
  },
  amber: {
    gradient: "from-amber-500/10 via-amber-500/5 to-transparent",
    iconBg: "bg-amber-500/20 border-amber-500/30",
    iconColor: "text-amber-300",
  },
  cyan: {
    gradient: "from-cyan-500/10 via-cyan-500/5 to-transparent",
    iconBg: "bg-cyan-500/20 border-cyan-500/30",
    iconColor: "text-cyan-300",
  },
  rose: {
    gradient: "from-rose-500/10 via-rose-500/5 to-transparent",
    iconBg: "bg-rose-500/20 border-rose-500/30",
    iconColor: "text-rose-300",
  },
};

function StatCard({
  icon: Icon,
  label,
  value,
  description,
  tone,
  valueClassName,
}: StatCardProps) {
  const style = toneStyles[tone];

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 to-black p-5 shadow-xl shadow-black/30 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
      {/* Gradient overlay */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-linear-to-br opacity-60 transition-opacity duration-300 group-hover:opacity-100",
          style.gradient
        )}
        aria-hidden="true"
      />

      {/* Top shine */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
        aria-hidden="true"
      />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl border",
                style.iconBg
              )}
            >
              <Icon className={cn("h-4 w-4", style.iconColor)} />
            </div>
            <span className="text-[11px] font-medium uppercase tracking-[0.15em] text-white/50">
              {label}
            </span>
          </div>
          <div
            className={cn(
              "text-2xl font-bold tracking-tight text-white",
              valueClassName
            )}
          >
            {value}
          </div>
          {description && (
            <p className="text-[11px] text-white/40">{description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Quick action button component
type QuickActionProps = {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  variant?: "default" | "success" | "warning" | "danger";
  disabled?: boolean;
};

function QuickAction({
  icon: Icon,
  label,
  onClick,
  variant = "default",
  disabled,
}: QuickActionProps) {
  const variants = {
    default:
      "border-white/10 bg-white/5 text-white/80 hover:border-indigo-500/30 hover:bg-indigo-500/10 hover:text-white",
    success:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200",
    warning:
      "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 hover:text-amber-200",
    danger:
      "border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200",
  };

  return (
    <Button
      variant="outline"
      className={cn(
        "group w-full justify-between gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all duration-200",
        variants[variant],
        disabled && "opacity-50 cursor-not-allowed"
      )}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100" />
    </Button>
  );
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
  const canActivate =
    teacher.status === "inactive" ||
    teacher.status === "terminated" ||
    teacher.status === "on_leave";
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
  const homeroomLabel = homeroom
    ? `${homeroom.name}${homeroom.gradeName ? ` (${homeroom.gradeName})` : ""}`
    : "Not assigned";
  const workloadClasses = workload?.current.classes;
  const workloadStudents = workload?.current.students;
  const maxClasses = workload?.capacity.maxClasses;
  const maxStudents = workload?.capacity.maxStudents;

  const removeSubjectMutation = useRemoveSubject();
  const removeHomeroomMutation = useRemoveHomeroom();
  const busy = useBusyToast();

  const handleRemoveSubject = async (
    subjectId: string,
    subjectName: string
  ) => {
    if (!confirm(`Remove "${subjectName}" from ${teacher.fullName}?`)) return;
    try {
      await busy.promise(
        removeSubjectMutation.mutateAsync({ teacherId: teacher.id, subjectId }),
        {
          loading: "Removing subject...",
          success: `"${subjectName}" removed successfully`,
          error: "Failed to remove subject",
        }
      );
    } catch {
      // Error already handled by busy.promise
    }
  };

  const handleRemoveHomeroom = async () => {
    if (!homeroom) return;
    if (
      !confirm(
        `Remove ${teacher.fullName} as homeroom teacher for "${homeroom.name}"?`
      )
    )
      return;
    try {
      await busy.promise(removeHomeroomMutation.mutateAsync(teacher.id), {
        loading: "Removing homeroom...",
        success: "Homeroom assignment removed successfully",
        error: "Failed to remove homeroom",
      });
    } catch {
      // Error already handled by busy.promise
    }
  };

  const statusStyle = statusConfig[teacher.status];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
      {/* Main Content */}
      <div className="space-y-6">
        {/* Overview Header Card */}
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
          {/* Decorative elements */}
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-linear-to-br from-indigo-500/15 via-purple-500/10 to-transparent blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
            aria-hidden="true"
          />

          <CardHeader className="relative z-10 border-b border-white/5 pb-0">
            <div className="flex flex-col gap-4 pb-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-linear-to-br from-indigo-500/20 to-purple-500/20 shadow-inner shadow-white/5">
                  <Zap className="h-5 w-5 text-indigo-300" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg font-semibold tracking-tight text-white">
                      Overview
                    </CardTitle>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[10px] font-semibold capitalize",
                        statusStyle.bg,
                        statusStyle.border,
                        statusStyle.text
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          statusStyle.dot
                        )}
                      />
                      {getStatusLabel(teacher.status)}
                    </span>
                  </div>
                  <p className="text-xs text-white/50">
                    Workload, assignments, and profile snapshot
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-xl border-indigo-500/30 bg-indigo-500/10 text-xs text-indigo-300 hover:bg-indigo-500/20"
                  onClick={() => setAssignSubjectOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Assign Subject
                </Button>
          <Button
            variant="outline"
                  size="sm"
                  className="gap-2 rounded-xl border-purple-500/30 bg-purple-500/10 text-xs text-purple-300 hover:bg-purple-500/20"
                  onClick={() => setAssignHomeroomOpen(true)}
          >
                  <Home className="h-3.5 w-3.5" />
                  {homeroom ? "Change Homeroom" : "Assign Homeroom"}
          </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="relative z-10 p-6">
            {/* Stats Grid */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={BookOpen}
                label="Subjects"
                value={subjects.length}
                description={
                  subjects.length > 0
                    ? `Teaching ${subjects.length} subject${
                        subjects.length === 1 ? "" : "s"
                      }`
                    : "No subjects assigned"
                }
                tone="indigo"
              />
              <StatCard
                icon={TrendingUp}
                label="Classes"
                value={workloadClasses ?? "—"}
                description={
                  maxClasses
                    ? `of ${maxClasses} max capacity`
                    : "Active classes"
                }
                tone="emerald"
              />
              <StatCard
                icon={Users}
                label="Students"
                value={workloadStudents ?? "—"}
                description={
                  maxStudents
                    ? `of ${maxStudents} max capacity`
                    : "Total students"
                }
                tone="amber"
              />
              <StatCard
                icon={Home}
                label="Homeroom"
                value={homeroomLabel}
                valueClassName="text-base font-semibold leading-snug line-clamp-2"
                description={
                  homeroom ? "Current homeroom class" : "Not assigned"
                }
                tone="purple"
              />
            </div>
          </CardContent>
        </Card>

        {/* Two Column Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Assignments Card */}
          <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-indigo-500/5 via-transparent to-transparent"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
              aria-hidden="true"
            />

            <CardHeader className="relative z-10 border-b border-white/5 pb-0">
              <div className="flex items-center justify-between pb-4">
                <div className="space-y-0.5">
                  <CardTitle className="text-sm font-semibold tracking-tight text-white">
                    Teaching Assignments
                  </CardTitle>
                  <p className="text-xs text-white/40">
                    Subjects and homeroom ownership
                  </p>
                </div>
              </div>
        </CardHeader>

            <CardContent className="relative z-10 space-y-4 p-6">
          {/* Subjects */}
              <div className="rounded-xl border border-white/10 bg-white/2 p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <p className="flex items-center gap-2 text-xs font-medium text-white/60">
                    <BookOpen className="h-3.5 w-3.5" />
                    Subjects ({subjects.length})
                  </p>
                  {subjects.length === 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 rounded-lg text-xs text-indigo-300 hover:bg-indigo-500/10 hover:text-indigo-200"
                      onClick={() => setAssignSubjectOpen(true)}
                    >
                      <Plus className="h-3 w-3" />
                      Add
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {subjects.length > 0 ? (
                    subjects.map((s) => (
                  <Badge
                    key={s.id}
                    variant="outline"
                        className="group gap-1.5 rounded-lg border-indigo-500/30 bg-indigo-500/10 pr-1.5 text-indigo-200"
                  >
                    {s.name}
                        <button
                          type="button"
                          onClick={() => handleRemoveSubject(s.id, s.name)}
                          disabled={removeSubjectMutation.isPending}
                          className="ml-0.5 rounded-full p-0.5 opacity-0 transition-all hover:bg-white/10 group-hover:opacity-100"
                          title={`Remove ${s.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                  </Badge>
                ))
              ) : (
                    <p className="text-sm text-white/40">
                  No subjects assigned yet.
                </p>
              )}
            </div>
          </div>

              {/* Homeroom */}
              <div className="rounded-xl border border-white/10 bg-white/2 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="flex items-center gap-2 text-xs font-medium text-white/60">
                    <Home className="h-3.5 w-3.5" />
                    Homeroom Class
                  </p>
                  {!homeroom && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 rounded-lg text-xs text-purple-300 hover:bg-purple-500/10 hover:text-purple-200"
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
                      className="gap-1.5 rounded-lg border-purple-500/30 bg-purple-500/10 pr-1.5 text-purple-200"
                    >
                      {homeroom.name}
                      {homeroom.gradeName && ` (${homeroom.gradeName})`}
                      <button
                        type="button"
                        onClick={handleRemoveHomeroom}
                        disabled={removeHomeroomMutation.isPending}
                        className="ml-0.5 rounded-full p-0.5 transition-all hover:bg-white/10"
                        title="Remove homeroom"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  </div>
                ) : (
                  <p className="text-sm text-white/40">No homeroom assigned.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Professional Info Card */}
          <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,var(--tw-gradient-stops))] from-purple-500/5 via-transparent to-transparent"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
              aria-hidden="true"
            />

            <CardHeader className="relative z-10 border-b border-white/5 pb-0">
              <div className="pb-4">
                <CardTitle className="text-sm font-semibold tracking-tight text-white">
                  Professional Info
                </CardTitle>
                <p className="text-xs text-white/40">Employment details</p>
              </div>
            </CardHeader>

            <CardContent className="relative z-10 p-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/2 p-4">
                  <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-white/40">
                    <Briefcase className="h-3 w-3" />
                Employee ID
              </p>
                  <p className="mt-2 text-sm font-medium text-white">
                    {teacher.employeeId ?? "—"}
                  </p>
            </div>

                <div className="rounded-xl border border-white/10 bg-white/2 p-4">
                  <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-white/40">
                    <Users className="h-3 w-3" />
                Department
              </p>
                  <p className="mt-2 text-sm font-medium text-white">
                    {teacher.department ?? "—"}
                  </p>
            </div>

                <div className="rounded-xl border border-white/10 bg-white/2 p-4">
                  <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-white/40">
                    <Calendar className="h-3 w-3" />
                Hire Date
              </p>
                  <p className="mt-2 text-sm font-medium text-white">
                    {formatDate(teacher.hireDate)}
                  </p>
            </div>

                <div className="rounded-xl border border-white/10 bg-white/2 p-4">
                  <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-white/40">
                    <Calendar className="h-3 w-3" />
                    Termination
                  </p>
                  <p className="mt-2 text-sm font-medium text-white">
                {formatDate(teacher.terminationDate)}
              </p>
            </div>
          </div>
            </CardContent>
          </Card>
        </div>

        {/* Workload & History */}
        {workload && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Workload Card */}
            <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,var(--tw-gradient-stops))] from-emerald-500/5 via-transparent to-transparent"
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
                aria-hidden="true"
              />

              <CardHeader className="relative z-10 border-b border-white/5 pb-0">
                <div className="pb-4">
                  <CardTitle className="text-sm font-semibold tracking-tight text-white">
                    Workload Analysis
                  </CardTitle>
                  <p className="text-xs text-white/40">
                    Current load vs capacity
                  </p>
                </div>
              </CardHeader>

              <CardContent className="relative z-10 space-y-4 p-6">
                {/* Warnings */}
                {(workload.warnings.isOverCapacity ||
                  workload.warnings.isAboveAverage) && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-300" />
                      <div className="flex-1 text-xs">
                        {workload.warnings.isOverCapacity && (
                          <p className="font-medium text-amber-200">
                            Over Capacity: This teacher has exceeded their
                            maximum capacity limits.
                          </p>
                        )}
                        {workload.warnings.isAboveAverage &&
                          !workload.warnings.isOverCapacity && (
                            <p className="font-medium text-amber-200">
                              Above Average: Workload is significantly above the
                              school average.
                            </p>
                          )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Progress bars */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-white/10 bg-white/2 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-emerald-400" />
                      <p className="text-xs font-medium text-white/60">
                        Classes
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-white">
                      {workload.current.classes}
                    </p>
                    {workload.capacity.maxClasses && (
                      <div className="mt-3">
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-white/40">
                            of {workload.capacity.maxClasses}
                          </span>
                          <span
                            className={
                              workload.capacity.classUtilization &&
                              workload.capacity.classUtilization > 100
                                ? "text-red-400"
                                : "text-white/60"
                            }
                          >
                            {workload.capacity.classUtilization?.toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/10">
                          <div
                            className={cn(
                              "h-full transition-all",
                              workload.capacity.classUtilization &&
                                workload.capacity.classUtilization > 100
                                ? "bg-red-500"
                                : workload.capacity.classUtilization &&
                                  workload.capacity.classUtilization > 80
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            )}
                            style={{
                              width: `${Math.min(
                                workload.capacity.classUtilization || 0,
                                100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/2 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Users className="h-4 w-4 text-amber-400" />
                      <p className="text-xs font-medium text-white/60">
                        Students
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-white">
                      {workload.current.students}
                    </p>
                    {workload.capacity.maxStudents && (
                      <div className="mt-3">
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-white/40">
                            of {workload.capacity.maxStudents}
                          </span>
                          <span
                            className={
                              workload.capacity.studentUtilization &&
                              workload.capacity.studentUtilization > 100
                                ? "text-red-400"
                                : "text-white/60"
                            }
                          >
                            {workload.capacity.studentUtilization?.toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/10">
                          <div
                            className={cn(
                              "h-full transition-all",
                              workload.capacity.studentUtilization &&
                                workload.capacity.studentUtilization > 100
                                ? "bg-red-500"
                                : workload.capacity.studentUtilization &&
                                  workload.capacity.studentUtilization > 80
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            )}
                            style={{
                              width: `${Math.min(
                                workload.capacity.studentUtilization || 0,
                                100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/10 bg-white/2 p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-white/40" />
                      <p className="text-xs text-white/40">Workload Hours</p>
                    </div>
                    <p className="text-lg font-semibold text-white">
                      {workload.current.workloadHours}h
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/2 p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <TrendingUp className="h-3.5 w-3.5 text-white/40" />
                      <p className="text-xs text-white/40">vs School Avg</p>
                    </div>
                    <p
                      className={cn(
                        "text-lg font-semibold",
                        workload.comparison.differenceFromAverage > 0
                          ? "text-amber-400"
                          : "text-emerald-400"
                      )}
                    >
                      {workload.comparison.differenceFromAverage > 0 ? "+" : ""}
                      {workload.comparison.differenceFromAverage.toFixed(
                        1
                      )}{" "}
                      classes
                    </p>
                    <p className="mt-0.5 text-[10px] text-white/40">
                      Avg: {workload.comparison.schoolAvgClasses.toFixed(1)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Record History Card */}
            <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-violet-500/5 via-transparent to-transparent"
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
                aria-hidden="true"
              />

              <CardHeader className="relative z-10 border-b border-white/5 pb-0">
                <div className="pb-4">
                  <CardTitle className="text-sm font-semibold tracking-tight text-white">
                    Record History
                  </CardTitle>
                  <p className="text-xs text-white/40">Profile timeline</p>
                </div>
              </CardHeader>

              <CardContent className="relative z-10 p-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/10 bg-white/2 p-4">
                    <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-white/40">
                      <Calendar className="h-3 w-3" />
                      Created
                    </p>
                    <p className="mt-2 text-sm font-medium text-white">
                      {formatDate(teacher.createdAt)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/2 p-4">
                    <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-white/40">
                      <Calendar className="h-3 w-3" />
                      Updated
                    </p>
                    <p className="mt-2 text-sm font-medium text-white">
                      {formatDate(teacher.updatedAt)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Record History (when no workload data) */}
        {!workload && (
          <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-violet-500/5 via-transparent to-transparent"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
              aria-hidden="true"
            />

            <CardHeader className="relative z-10 border-b border-white/5 pb-0">
              <div className="pb-4">
                <CardTitle className="text-sm font-semibold tracking-tight text-white">
                  Record History
                </CardTitle>
                <p className="text-xs text-white/40">Profile timeline</p>
              </div>
            </CardHeader>

            <CardContent className="relative z-10 p-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/2 p-4">
                  <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-white/40">
                    <Calendar className="h-3 w-3" />
                Created
              </p>
                  <p className="mt-2 text-sm font-medium text-white">
                    {formatDate(teacher.createdAt)}
                  </p>
            </div>
                <div className="rounded-xl border border-white/10 bg-white/2 p-4">
                  <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-white/40">
                    <Calendar className="h-3 w-3" />
                Updated
              </p>
                  <p className="mt-2 text-sm font-medium text-white">
                {formatDate(teacher.updatedAt)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-6 lg:sticky lg:top-6">
        {/* Quick Actions Card */}
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-indigo-500/5 via-transparent to-transparent"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
            aria-hidden="true"
          />

          <CardHeader className="relative z-10 border-b border-white/5 pb-0">
            <div className="pb-4">
              <CardTitle className="text-sm font-semibold tracking-tight text-white">
                Quick Actions
              </CardTitle>
              <p className="text-xs text-white/40">
                Shortcuts for common tasks
              </p>
            </div>
        </CardHeader>

          <CardContent className="relative z-10 space-y-4 p-6">
            {/* Primary Actions */}
            <div className="space-y-2">
              <QuickAction
                icon={Pencil}
                label="Edit Profile"
                onClick={onEdit}
              />
              <QuickAction
                icon={CalendarCheck}
                label="Manage Assignments"
                onClick={() => onNavigateToTab?.("assignments")}
              />
              <QuickAction
                icon={Clock}
                label="Record Attendance"
                onClick={() => onNavigateToTab?.("attendance")}
              />
              <QuickAction
                icon={FolderOpen}
                label="Upload Documents"
                onClick={() => onNavigateToTab?.("documents")}
              />
              <QuickAction
                icon={StickyNote}
                label="Add Internal Note"
                onClick={() => onNavigateToTab?.("notes")}
              />
            </div>

            {/* Status Management */}
            <div className="rounded-xl border border-white/10 bg-white/2 p-4">
              <p className="mb-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-white/40">
                <FileText className="h-3 w-3" />
                Status Management
              </p>

              <div className="space-y-2">
                {canActivate && (
                  <QuickAction
                    icon={Power}
                    label="Activate Teacher"
                    onClick={onActivate}
                    variant="success"
                    disabled={isChangingStatus}
                  />
                )}

                {canDeactivate && (
                  <QuickAction
                    icon={PowerOff}
                    label="Deactivate Teacher"
                    onClick={onDeactivate}
                    variant="warning"
                    disabled={isChangingStatus}
                  />
                )}

                {canDelete && (
                  <QuickAction
                    icon={Trash2}
                    label="Terminate Teacher"
                    onClick={onDelete}
                    variant="danger"
                    disabled={isChangingStatus}
                  />
                )}
              </div>
            </div>
        </CardContent>
      </Card>
      </div>

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
