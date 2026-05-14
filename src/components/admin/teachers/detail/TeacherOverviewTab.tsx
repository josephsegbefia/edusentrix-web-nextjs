"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  BookOpen,
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
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { LeoTeacherAssignmentsPanel } from "@/components/admin/teachers/LeoTeacherAssignmentsPanel";
import { TeacherProfessionalInfoCard } from "@/components/admin/teachers/detail/TeacherProfessionalInfoCard";

type TeacherOverviewTabProps = {
  teacher: {
    id: string;
    fullName: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    status: TeacherStatus;
    homeroom?: { id: string; name: string; gradeName?: string | null; label?: string | null } | null;
    subjects?: Array<{ id: string; name: string }>;
    assignedSubjects?: Array<{ id: string; name: string; classGroups: string[] }>;
    employeeId?: string | null;
    department?: string | null;
    hireDate?: string | Date | null;
    terminationDate?: string | Date | null;
    leaveStartDate?: string | Date | null;
    leaveEndDate?: string | Date | null;
    leaveReason?: string | null;
    createdAt: string | Date;
    updatedAt?: string | Date | null;
  };
  onEdit?: () => void;
  onActivate?: () => void;
  onDeactivate?: () => void;
  onDelete?: () => void;
  onUpdateLeave?: () => void;
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

// Stat card component
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
  { iconBg: string; iconColor: string }
> = {
  indigo: {
    iconBg: "bg-indigo-500/15 border-indigo-500/25",
    iconColor: "text-indigo-300",
  },
  purple: {
    iconBg: "bg-purple-500/15 border-purple-500/25",
    iconColor: "text-purple-300",
  },
  emerald: {
    iconBg: "bg-emerald-500/15 border-emerald-500/25",
    iconColor: "text-emerald-300",
  },
  amber: {
    iconBg: "bg-amber-500/15 border-amber-500/25",
    iconColor: "text-amber-300",
  },
  cyan: {
    iconBg: "bg-cyan-500/15 border-cyan-500/25",
    iconColor: "text-cyan-300",
  },
  rose: {
    iconBg: "bg-rose-500/15 border-rose-500/25",
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
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.04]">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
            style.iconBg
          )}
        >
          <Icon className={cn("h-5 w-5", style.iconColor)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-white/45">
            {label}
          </p>
          <div
            className={cn(
              "mt-1 text-xl font-semibold text-white",
              valueClassName
            )}
          >
            {value}
          </div>
          {description && (
            <p className="mt-0.5 text-xs text-white/40">{description}</p>
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
        "group w-full justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium",
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
      <ArrowRight className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100" />
    </Button>
  );
}

export function TeacherOverviewTab({
  teacher,
  onEdit,
  onActivate,
  onDeactivate,
  onDelete,
  onUpdateLeave,
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
  const subjectsFromApi = subjectsData?.data ?? [];
  const homeroom = homeroomData?.data ?? null;
  const subjects = (teacher.assignedSubjects?.length ? teacher.assignedSubjects : subjectsFromApi).map((s) =>
    "classGroups" in s ? { id: s.id, name: s.name } : s
  );
  const workload = workloadData?.data;
  const homeroomLabel = homeroom
    ? homeroom.label ||
      (homeroom.gradeName ? `${homeroom.gradeName} ${homeroom.name}`.trim() : homeroom.name)
    : "Not assigned";
  const workloadClasses = workload?.current.classes;
  const workloadStudents = workload?.current.students;
  const maxClasses = workload?.capacity.maxClasses;
  const maxStudents = workload?.capacity.maxStudents;

  const removeSubjectMutation = useRemoveSubject();
  const removeHomeroomMutation = useRemoveHomeroom();
  const busy = useBusyToast();
  const { confirm, confirmationDialog } = useConfirmationDialog();

  const handleRemoveSubject = async (
    subjectId: string,
    subjectName: string
  ) => {
    const decision = await confirm({
      title: "Remove Subject?",
      description: `Remove "${subjectName}" from ${teacher.fullName}?`,
      confirmLabel: "Remove Subject",
      cancelLabel: "Keep Subject",
      intent: "destructive",
    });
    if (decision !== "confirm") return;

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
    const decision = await confirm({
      title: "Remove Homeroom Assignment?",
      description: `Remove ${teacher.fullName} as homeroom teacher for "${homeroom.name}"?`,
      confirmLabel: "Remove Assignment",
      cancelLabel: "Keep Assignment",
      intent: "destructive",
    });
    if (decision !== "confirm") return;

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
        {/* Overview Section */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">Overview</h3>
              <p className="mt-0.5 text-sm text-white/50">
                Workload, assignments, and profile snapshot
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 rounded-lg border-indigo-500/25 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/15"
                onClick={() => setAssignSubjectOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Assign Subject
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 rounded-lg border-purple-500/25 bg-purple-500/10 text-purple-300 hover:bg-purple-500/15"
                onClick={() => setAssignHomeroomOpen(true)}
              >
                <Home className="h-3.5 w-3.5" />
                {homeroom ? "Change Homeroom" : "Assign Homeroom"}
              </Button>
            </div>
          </div>

          <div>
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

            {/* Leave info card */}
            {teacher.status === "on_leave" && teacher.leaveStartDate && teacher.leaveEndDate && (
              <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/20">
                      <span className="text-xl font-bold text-amber-200">
                        {(() => {
                          const end = new Date(teacher.leaveEndDate);
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          end.setHours(0, 0, 0, 0);
                          return Math.max(0, Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
                        })()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-amber-200">
                        {(() => {
                          const end = new Date(teacher.leaveEndDate);
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          end.setHours(0, 0, 0, 0);
                          const daysLeft = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
                          return daysLeft === 0 ? "Leave ends today" : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`;
                        })()}
                      </p>
                      <p className="text-xs text-amber-200/70">
                        {formatDate(teacher.leaveStartDate)} → {formatDate(teacher.leaveEndDate)}
                      </p>
                      {teacher.leaveReason && (
                        <p className="mt-1 text-[11px] text-white/50 line-clamp-2">{teacher.leaveReason}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {onUpdateLeave && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 rounded-lg border-amber-500/30 bg-amber-500/10 text-xs text-amber-200 hover:bg-amber-500/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateLeave();
                        }}
                      >
                        <CalendarCheck className="h-3.5 w-3.5" />
                        Update dates
                      </Button>
                    )}
                    <Clock className="h-4 w-4 text-amber-200/50" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Two Column Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Assignments Card */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-white">
                Teaching Assignments
              </h3>
              <p className="mt-0.5 text-xs text-white/45">
                Leo suggestions, homeroom, and subject load for this term
              </p>
            </div>

            <div className="space-y-4">
              <LeoTeacherAssignmentsPanel
                teacherId={teacher.id}
                teacherName={teacher.fullName}
              />

              {/* Homeroom — directly under Leo so it’s easy to set alongside teaching assignments */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <p className="flex items-center gap-2 text-xs font-medium text-white/60">
                    <Home className="h-3.5 w-3.5" />
                    Homeroom Class
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 rounded-lg text-xs text-purple-300 hover:bg-purple-500/10 hover:text-purple-200"
                    onClick={() => setAssignHomeroomOpen(true)}
                  >
                    {homeroom ? (
                      <>
                        <Pencil className="h-3 w-3" />
                        Change
                      </>
                    ) : (
                      <>
                        <Plus className="h-3 w-3" />
                        Assign
                      </>
                    )}
                  </Button>
                </div>
                {homeroom ? (
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="gap-1.5 rounded-lg border-purple-500/30 bg-purple-500/10 pr-1.5 text-purple-200"
                    >
                      {homeroomLabel}
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
                  <p className="text-sm text-white/40">
                    No homeroom yet. Assign the class this teacher leads as a form teacher.
                  </p>
                )}
              </div>

          {/* Subjects */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
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
                <div className="space-y-2">
                  {subjects.length > 0 ? (
                    subjects.map((s) => {
                      const classGroups = teacher.assignedSubjects?.find((a) => a.id === s.id)?.classGroups;
                      return (
                        <div
                          key={s.id}
                          className="group flex w-full items-start justify-between gap-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2.5 text-indigo-200"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="break-words text-sm font-medium leading-snug text-indigo-100">
                              {s.name}
                            </p>
                            {classGroups?.length ? (
                              <p className="mt-1 break-words text-xs leading-relaxed text-indigo-100/75">
                                {classGroups.join(", ")}
                              </p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveSubject(s.id, s.name)}
                            disabled={removeSubjectMutation.isPending}
                            className="mt-0.5 shrink-0 rounded-full p-0.5 opacity-0 transition-all hover:bg-white/10 group-hover:opacity-100"
                            title={`Remove ${s.name}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-white/40">
                      No subjects assigned yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Leave Info Card — only shown when teacher is on leave */}
          {teacher.status === "on_leave" && teacher.leaveEndDate && (
            <LeaveInfoCard teacher={teacher} />
          )}

          <TeacherProfessionalInfoCard
            teacherId={teacher.id}
            employeeId={teacher.employeeId}
            department={teacher.department}
            hireDate={teacher.hireDate}
            terminationDate={teacher.terminationDate}
          />
        </div>

        {/* Workload & History */}
        {workload && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Workload Card */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-white">
                  Workload Analysis
                </h3>
                <p className="mt-0.5 text-xs text-white/45">
                  Current load vs capacity
                </p>
              </div>

              <div className="space-y-4">
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
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
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

                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
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
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-white/40" />
                      <p className="text-xs text-white/40">Workload per Week</p>
                    </div>
                    <p className="text-lg font-semibold text-white">
                      {workload.current.workloadHours} hrs/week
                    </p>
                    <p className="mt-0.5 text-[10px] text-white/40">
                      From linked timetable slots for this week
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
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
              </div>
            </div>

            {/* Record History Card */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-white">
                  Record History
                </h3>
                <p className="mt-0.5 text-xs text-white/45">Profile timeline</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-white/40">
                      <Calendar className="h-3 w-3" />
                      Created
                    </p>
                    <p className="mt-2 text-sm font-medium text-white">
                      {formatDate(teacher.createdAt)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-white/40">
                      <Calendar className="h-3 w-3" />
                      Updated
                    </p>
                    <p className="mt-2 text-sm font-medium text-white">
                      {formatDate(teacher.updatedAt)}
                    </p>
                  </div>
                </div>
            </div>
          </div>
        )}

        {/* Record History (when no workload data) */}
        {!workload && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-white">
                Record History
              </h3>
              <p className="mt-0.5 text-xs text-white/45">Profile timeline</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-white/40">
                  <Calendar className="h-3 w-3" />
                  Created
                </p>
                <p className="mt-2 text-sm font-medium text-white">
                  {formatDate(teacher.createdAt)}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-white/40">
                  <Calendar className="h-3 w-3" />
                  Updated
                </p>
                <p className="mt-2 text-sm font-medium text-white">
                  {formatDate(teacher.updatedAt)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-6 lg:sticky lg:top-6">
        {/* Quick Actions Card */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-white">
              Quick Actions
            </h3>
            <p className="mt-0.5 text-xs text-white/45">
              Shortcuts for common tasks
            </p>
          </div>

          <div className="space-y-4">
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
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
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
          </div>
        </div>
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
      {confirmationDialog}
    </div>
  );
}

// ============================================================================
// Leave Info Card
// ============================================================================

function LeaveInfoCard({
  teacher,
}: {
  teacher: {
    leaveStartDate?: string | Date | null;
    leaveEndDate?: string | Date | null;
    leaveReason?: string | null;
  };
}) {
  const startDate = teacher.leaveStartDate
    ? new Date(teacher.leaveStartDate)
    : null;
  const endDate = teacher.leaveEndDate
    ? new Date(teacher.leaveEndDate)
    : null;

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const endNorm = endDate ? new Date(endDate) : null;
  if (endNorm) endNorm.setHours(0, 0, 0, 0);

  const daysLeft = endNorm
    ? Math.max(0, Math.ceil((endNorm.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const totalDays =
    startDate && endDate
      ? Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1
      : 0;

  const elapsed = totalDays - daysLeft;
  const progressPct = totalDays > 0 ? Math.min(100, (elapsed / totalDays) * 100) : 0;

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/15">
            <Clock className="h-5 w-5 text-amber-300" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Leave Status</h3>
            <p className="text-xs text-amber-200/70">Currently on leave</p>
          </div>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/15">
          <span className="text-xl font-bold text-amber-200">{daysLeft}</span>
        </div>
      </div>

      <div className="space-y-4">
        {/* Days remaining header */}
        <div className="text-center">
          <p className="text-sm font-medium text-amber-200">
            {daysLeft === 0
              ? "Leave ends today"
              : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining`}
          </p>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-linear-to-r from-amber-400 to-amber-500 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-white/40">
            <span>{elapsed} of {totalDays} days elapsed</span>
            <span>{Math.round(progressPct)}%</span>
          </div>
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-amber-200/50">
              Start
            </p>
            <p className="mt-1 text-sm font-medium text-white">
              {startDate
                ? startDate.toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })
                : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-amber-200/50">
              End
            </p>
            <p className="mt-1 text-sm font-medium text-white">
              {endDate
                ? endDate.toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "—"}
            </p>
          </div>
        </div>

        {/* Reason */}
        {teacher.leaveReason && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-white/40 mb-1">
              Reason
            </p>
            <p className="text-sm text-white/80">{teacher.leaveReason}</p>
          </div>
        )}
      </div>
    </div>
  );
}
