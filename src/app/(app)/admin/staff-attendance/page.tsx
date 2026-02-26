// src/app/(app)/admin/staff-attendance/page.tsx
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Date utilities
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function subDays(d: Date, days: number): Date {
  return addDays(d, -days);
}

function isToday(d: Date): boolean {
  const today = startOfDay(new Date());
  const check = startOfDay(d);
  return today.getTime() === check.getTime();
}

function formatDateStr(d: Date): string {
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

function formatRelativeTime(isoDate: string | null): string {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

function formatDisplayDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
import {
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  Users,
  UserCheck,
  UserX,
  Clock,
  Palmtree,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock4,
  CalendarOff,
  RefreshCw,
  FileText,
  Check,
  X,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useDailyAttendance,
  useAllLeaveRequests,
  useBulkRecordAttendance,
  useQuickMarkAttendance,
  type TeacherWithAttendance,
  type TeacherAttendanceStatus,
} from "@/hooks/admin/useTeacherAttendanceManagement";
import { useApproveLeave, useRejectLeave } from "@/hooks/admin/useTeacherAttendance";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  useStaffAttendanceAIInsightsQuery,
  useStaffAttendanceAIInsights,
  type StaffAttendanceAIInsights,
} from "@/hooks/admin/useStaffAttendanceAIInsights";
import { LeoIcon } from "@/components/icons/LeoIcon";

// ─────────────────────────────────────────────────────────────────────────────
// Stats Card Component
// ─────────────────────────────────────────────────────────────────────────────

type StatTone = "indigo" | "emerald" | "rose" | "amber" | "cyan" | "slate";

const toneConfig: Record<
  StatTone,
  {
    border: string;
    bg: string;
    iconBg: string;
    iconColor: string;
    valueColor: string;
    glow: string;
  }
> = {
  indigo: {
    border: "border-indigo-500/30",
    bg: "from-indigo-500/10 via-indigo-500/5 to-transparent",
    iconBg: "from-indigo-500/20 to-indigo-600/20",
    iconColor: "text-indigo-300",
    valueColor: "text-indigo-100",
    glow: "bg-indigo-500/20",
  },
  emerald: {
    border: "border-emerald-500/30",
    bg: "from-emerald-500/10 via-emerald-500/5 to-transparent",
    iconBg: "from-emerald-500/20 to-emerald-600/20",
    iconColor: "text-emerald-300",
    valueColor: "text-emerald-100",
    glow: "bg-emerald-500/20",
  },
  rose: {
    border: "border-rose-500/30",
    bg: "from-rose-500/10 via-rose-500/5 to-transparent",
    iconBg: "from-rose-500/20 to-rose-600/20",
    iconColor: "text-rose-300",
    valueColor: "text-rose-100",
    glow: "bg-rose-500/20",
  },
  amber: {
    border: "border-amber-500/30",
    bg: "from-amber-500/10 via-amber-500/5 to-transparent",
    iconBg: "from-amber-500/20 to-amber-600/20",
    iconColor: "text-amber-300",
    valueColor: "text-amber-100",
    glow: "bg-amber-500/20",
  },
  cyan: {
    border: "border-cyan-500/30",
    bg: "from-cyan-500/10 via-cyan-500/5 to-transparent",
    iconBg: "from-cyan-500/20 to-cyan-600/20",
    iconColor: "text-cyan-300",
    valueColor: "text-cyan-100",
    glow: "bg-cyan-500/20",
  },
  slate: {
    border: "border-slate-500/30",
    bg: "from-slate-500/10 via-slate-500/5 to-transparent",
    iconBg: "from-slate-500/20 to-slate-600/20",
    iconColor: "text-slate-300",
    valueColor: "text-slate-100",
    glow: "bg-slate-500/20",
  },
};

function StatCard({
  label,
  value,
  icon,
  tone,
  loading,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: StatTone;
  loading?: boolean;
}) {
  const config = toneConfig[tone];

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-linear-to-br p-4 shadow-lg shadow-black/20 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl",
        config.border,
        config.bg
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl opacity-40",
          config.glow
        )}
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent" />

      <div className="relative z-10 flex items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/50">
            {label}
          </p>
          <p
            className={cn(
              "text-2xl font-bold tracking-tight tabular-nums",
              config.valueColor
            )}
          >
            {loading ? (
              <span className="inline-block h-7 w-10 animate-pulse rounded bg-white/10" />
            ) : (
              value.toLocaleString()
            )}
          </p>
        </div>
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-linear-to-br shadow-inner shadow-white/5",
            config.iconBg
          )}
        >
          <span className={config.iconColor}>{icon}</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Status Badge Component
// ─────────────────────────────────────────────────────────────────────────────

const statusConfig: Record<
  TeacherAttendanceStatus | "not_recorded",
  { label: string; color: string; icon: React.ReactNode }
> = {
  present: {
    label: "Present",
    color: "border-emerald-400/50 bg-emerald-500/20 text-emerald-200",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  absent: {
    label: "Absent",
    color: "border-rose-400/50 bg-rose-500/20 text-rose-200",
    icon: <XCircle className="h-3 w-3" />,
  },
  late: {
    label: "Late",
    color: "border-amber-400/50 bg-amber-500/20 text-amber-200",
    icon: <Clock4 className="h-3 w-3" />,
  },
  on_leave: {
    label: "On Leave",
    color: "border-cyan-400/50 bg-cyan-500/20 text-cyan-200",
    icon: <Palmtree className="h-3 w-3" />,
  },
  sick: {
    label: "Sick",
    color: "border-purple-400/50 bg-purple-500/20 text-purple-200",
    icon: <AlertCircle className="h-3 w-3" />,
  },
  other: {
    label: "Other",
    color: "border-slate-400/50 bg-slate-500/20 text-slate-200",
    icon: <FileText className="h-3 w-3" />,
  },
  not_recorded: {
    label: "Not Recorded",
    color: "border-slate-400/30 bg-slate-500/10 text-slate-400",
    icon: <CalendarOff className="h-3 w-3" />,
  },
};

function AttendanceStatusBadge({
  status,
}: {
  status: TeacherAttendanceStatus | "not_recorded";
}) {
  const config = statusConfig[status];
  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium",
        config.color
      )}
    >
      {config.icon}
      {config.label}
    </Badge>
  );
}

// Quick action button for marking attendance
function QuickActionButton({
  status,
  isActive,
  isMarking,
  onClick,
}: {
  status: TeacherAttendanceStatus;
  isActive: boolean;
  isMarking: boolean;
  onClick: () => void;
}) {
  const config = statusConfig[status];
  return (
    <button
      type="button"
      disabled={isMarking}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg border transition-all",
        isActive
          ? config.color
          : "border-white/10 bg-white/5 text-white/40 hover:border-white/20 hover:bg-white/10 hover:text-white/70"
      )}
      title={config.label}
    >
      {isMarking ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : status === "present" ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : status === "absent" ? (
        <XCircle className="h-3.5 w-3.5" />
      ) : status === "late" ? (
        <Clock4 className="h-3.5 w-3.5" />
      ) : (
        <Palmtree className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Teacher Attendance Row Component
// ─────────────────────────────────────────────────────────────────────────────

function TeacherAttendanceRow({
  teacher,
  date,
  onQuickMark,
  isMarking,
}: {
  teacher: TeacherWithAttendance;
  date: string;
  onQuickMark: (
    teacherId: string,
    status: TeacherAttendanceStatus
  ) => void;
  isMarking: boolean;
}) {
  // Generate initials from firstName and lastName
  const initials = React.useMemo(() => {
    const first = teacher.firstName?.charAt(0)?.toUpperCase() ?? "";
    const last = teacher.lastName?.charAt(0)?.toUpperCase() ?? "";
    if (first || last) return first + last;
    // Fallback to email initial if no name
    if (teacher.email) return teacher.email.charAt(0).toUpperCase();
    return "T";
  }, [teacher.firstName, teacher.lastName, teacher.email]);

  // Generate display name with fallbacks
  const displayName = React.useMemo(() => {
    if (teacher.fullName && teacher.fullName.trim()) {
      return teacher.fullName;
    }
    if (teacher.firstName || teacher.lastName) {
      return `${teacher.firstName || ""} ${teacher.lastName || ""}`.trim();
    }
    if (teacher.email) {
      return teacher.email.split("@")[0];
    }
    return "Unknown Teacher";
  }, [teacher.fullName, teacher.firstName, teacher.lastName, teacher.email]);

  const currentStatus = teacher.attendance?.status ?? "not_recorded";

  return (
    <div className="group flex items-center gap-4 rounded-xl border border-white/5 bg-white/2 p-3 transition-all hover:border-white/10 hover:bg-white/5">
      {/* Avatar */}
      <div className="relative shrink-0">
        <Avatar className="h-10 w-10 border border-white/20 shadow-md shadow-black/30">
          {teacher.photoUrl ? (
            <AvatarImage src={teacher.photoUrl} alt={displayName} />
          ) : (
            <AvatarFallback className="bg-linear-to-br from-indigo-600 to-purple-700 text-xs font-semibold text-white">
              {initials}
            </AvatarFallback>
          )}
        </Avatar>
        {teacher.teacherStatus === "active" && (
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-neutral-900 bg-emerald-500" />
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">
          {displayName}
        </p>
        <p className="truncate text-xs text-white/50">
          {teacher.department || teacher.email || "No department"}
        </p>
      </div>

      {/* Current Status */}
      <div className="hidden sm:block">
        <AttendanceStatusBadge status={currentStatus} />
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-1.5">
        <QuickActionButton
          status="present"
          isActive={currentStatus === "present"}
          isMarking={isMarking}
          onClick={() => onQuickMark(teacher.teacherId, "present")}
        />
        <QuickActionButton
          status="absent"
          isActive={currentStatus === "absent"}
          isMarking={isMarking}
          onClick={() => onQuickMark(teacher.teacherId, "absent")}
        />
        <QuickActionButton
          status="late"
          isActive={currentStatus === "late"}
          isMarking={isMarking}
          onClick={() => onQuickMark(teacher.teacherId, "late")}
        />
        <QuickActionButton
          status="on_leave"
          isActive={currentStatus === "on_leave"}
          isMarking={isMarking}
          onClick={() => onQuickMark(teacher.teacherId, "on_leave")}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Leave Request Card Component
// ─────────────────────────────────────────────────────────────────────────────

function LeaveRequestCard({
  request,
  onApprove,
  onReject,
  isProcessing,
}: {
  request: {
    id: string;
    teacher: {
      fullName: string;
      department: string | null;
      photoUrl: string | null;
    } | null;
    date: string;
    leaveType: string;
    reason: string;
    approvalStatus: "pending" | "approved" | "rejected";
    createdAt: string;
  };
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isProcessing: boolean;
}) {
  const initials = request.teacher?.fullName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() ?? "T";

  const leaveTypeLabels: Record<string, string> = {
    sick: "Sick Leave",
    vacation: "Vacation",
    personal: "Personal",
    professional: "Professional",
    other: "Other",
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:border-white/15 hover:bg-white/8">
      <div className="flex items-start gap-3">
        <Avatar className="h-9 w-9 border border-white/20 shadow-sm shadow-black/30">
          {request.teacher?.photoUrl ? (
            <AvatarImage
              src={request.teacher.photoUrl}
              alt={request.teacher.fullName}
            />
          ) : (
            <AvatarFallback className="bg-linear-to-br from-cyan-600 to-teal-700 text-xs font-semibold text-white">
              {initials}
            </AvatarFallback>
          )}
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium text-white">
              {request.teacher?.fullName || "Unknown Teacher"}
            </p>
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 rounded-full text-[10px]",
                request.approvalStatus === "pending"
                  ? "border-amber-400/50 bg-amber-500/20 text-amber-200"
                  : request.approvalStatus === "approved"
                    ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200"
                    : "border-rose-400/50 bg-rose-500/20 text-rose-200"
              )}
            >
              {request.approvalStatus}
            </Badge>
          </div>

          <p className="mt-0.5 text-xs text-white/50">
            {leaveTypeLabels[request.leaveType] || request.leaveType} •{" "}
            {new Date(request.date).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>

          <p className="mt-2 line-clamp-2 text-xs text-white/70">
            {request.reason}
          </p>

          {request.approvalStatus === "pending" && (
            <div className="mt-3 flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={isProcessing}
                onClick={() => onApprove(request.id)}
                className="h-7 gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
              >
                <Check className="h-3 w-3" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isProcessing}
                onClick={() => onReject(request.id)}
                className="h-7 gap-1.5 border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
              >
                <X className="h-3 w-3" />
                Reject
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────────────────────

export default function StaffAttendancePage() {
  const busy = useBusyToast();

  // Date state
  const [selectedDate, setSelectedDate] = React.useState<Date>(
    startOfDay(new Date())
  );
  const dateStr = formatDateStr(selectedDate);

  // Search and filter state
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [bulkScope, setBulkScope] = React.useState<"not_recorded" | "filtered">(
    "not_recorded"
  );
  const [bulkStatus, setBulkStatus] =
    React.useState<TeacherAttendanceStatus>("present");

  // Tab state
  const [activeTab, setActiveTab] = React.useState<"attendance" | "leave">(
    "attendance"
  );

  // Leave requests filter
  const [leaveFilter, setLeaveFilter] = React.useState<
    "pending" | "approved" | "rejected" | undefined
  >("pending");

  // Queries
  const {
    data: attendanceData,
    isLoading: isLoadingAttendance,
    refetch: refetchAttendance,
  } = useDailyAttendance(dateStr);

  const {
    data: leaveData,
    isLoading: isLoadingLeave,
    refetch: refetchLeave,
  } = useAllLeaveRequests(leaveFilter);

  const { data: cachedLeo, isLoading: cachedLeoLoading } =
    useStaffAttendanceAIInsightsQuery(dateStr);
  const leoAI = useStaffAttendanceAIInsights(dateStr);

  const leoInsights: StaffAttendanceAIInsights | null =
    leoAI.data?.data ?? cachedLeo?.data ?? null;
  const leoGeneratedAt: string | null =
    leoAI.data?.generatedAt ?? cachedLeo?.generatedAt ?? null;
  const leoIsStale = cachedLeo?.isStale ?? false;

  // Mutations
  const quickMark = useQuickMarkAttendance();
  const bulkRecord = useBulkRecordAttendance();
  const approveLeave = useApproveLeave();
  const rejectLeave = useRejectLeave();

  // Handlers
  const handleQuickMark = React.useCallback(
    (teacherId: string, status: TeacherAttendanceStatus) => {
      busy.promise(
        quickMark.mutateAsync({ teacherId, date: dateStr, status }),
        {
          loading: "Recording attendance...",
          success: "Attendance recorded",
          error: "Failed to record attendance",
        }
      );
    },
    [busy, quickMark, dateStr]
  );

  const handleApproveLeave = React.useCallback(
    (id: string) => {
      busy.promise(approveLeave.mutateAsync(id), {
        loading: "Approving leave...",
        success: "Leave approved",
        error: "Failed to approve leave",
      });
    },
    [busy, approveLeave]
  );

  const handleRejectLeave = React.useCallback(
    (id: string) => {
      busy.promise(
        rejectLeave.mutateAsync({ leaveRequestId: id, rejectionReason: "" }),
        {
          loading: "Rejecting leave...",
          success: "Leave rejected",
          error: "Failed to reject leave",
        }
      );
    },
    [busy, rejectLeave]
  );

  // Filter teachers with debounced search
  const filteredTeachers = React.useMemo(() => {
    if (!attendanceData?.data) return [];
    let teachers = attendanceData.data;

    // Search filter (using debounced value)
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      teachers = teachers.filter(
        (t) =>
          t.fullName.toLowerCase().includes(q) ||
          t.firstName?.toLowerCase().includes(q) ||
          t.lastName?.toLowerCase().includes(q) ||
          t.email?.toLowerCase().includes(q) ||
          t.department?.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      if (statusFilter === "not_recorded") {
        teachers = teachers.filter((t) => !t.attendance);
      } else {
        teachers = teachers.filter(
          (t) => t.attendance?.status === statusFilter
        );
      }
    }

    return teachers;
  }, [attendanceData?.data, debouncedSearch, statusFilter]);

  const bulkCandidates = React.useMemo(() => {
    if (bulkScope === "not_recorded") {
      return filteredTeachers.filter((teacher) => !teacher.attendance);
    }
    return filteredTeachers.filter(
      (teacher) => teacher.attendance?.status !== bulkStatus
    );
  }, [filteredTeachers, bulkScope, bulkStatus]);

  const handleBulkMark = React.useCallback(() => {
    const records = bulkCandidates.map((teacher) => ({
      teacherId: teacher.teacherId,
      status: bulkStatus,
    }));

    if (records.length === 0) {
      busy.info("No teachers match the current bulk criteria.");
      return;
    }

    const statusLabel = bulkStatus.replace("_", " ");
    busy.promise(bulkRecord.mutateAsync({ date: dateStr, records }), {
      loading: `Applying ${statusLabel} to ${records.length} teacher${records.length === 1 ? "" : "s"}...`,
      success: `Bulk attendance updated for ${records.length} teacher${records.length === 1 ? "" : "s"}`,
      error: (e: Error) => e.message || "Failed to update attendance in bulk",
    });
  }, [bulkCandidates, bulkRecord, bulkStatus, busy, dateStr]);

  const summary = attendanceData?.summary;

  return (
    <div className="min-h-screen bg-background">
      <main className="w-full px-4 py-8 sm:px-6 lg:px-8">
        <section className="relative mb-6 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 via-slate-950/95 to-black p-6 shadow-2xl shadow-black/40">
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-transparent blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-gradient-to-tr from-cyan-500/10 via-indigo-500/5 to-transparent blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
            aria-hidden="true"
          />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 shadow-lg shadow-indigo-500/10">
                  <ClipboardCheck className="h-5 w-5 text-indigo-300" />
                </div>
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                    Staff Attendance
                  </h1>
                  <p className="mt-1 text-sm text-white/70">
                    Record and manage daily teacher attendance
                  </p>
                </div>
              </div>
              <p className="mt-4 text-xs uppercase tracking-[0.18em] text-indigo-200/80">
                {formatDisplayDate(selectedDate)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSelectedDate((d) => subDays(d, 1))}
                className="h-9 w-9 border-white/15 bg-white/5 text-white hover:bg-white/10"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <CustomDatePicker
                value={selectedDate}
                onChange={(nextDate) => {
                  if (!nextDate) return;
                  setSelectedDate(startOfDay(nextDate));
                }}
                placeholder="Select attendance date"
                className="w-[220px]"
              />

              <Button
                variant="outline"
                size="icon"
                onClick={() => setSelectedDate((d) => addDays(d, 1))}
                className="h-9 w-9 border-white/15 bg-white/5 text-white hover:bg-white/10"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>

              {!isToday(selectedDate) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDate(startOfDay(new Date()))}
                  className="gap-1.5 border-white/15 bg-white/5 text-xs text-white hover:bg-white/10"
                >
                  <Sparkles className="h-3 w-3" />
                  Today
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard
            label="Total Staff"
            value={summary?.total ?? 0}
            icon={<Users className="h-4 w-4" />}
            tone="indigo"
            loading={isLoadingAttendance}
          />
          <StatCard
            label="Present"
            value={summary?.present ?? 0}
            icon={<UserCheck className="h-4 w-4" />}
            tone="emerald"
            loading={isLoadingAttendance}
          />
          <StatCard
            label="Absent"
            value={summary?.absent ?? 0}
            icon={<UserX className="h-4 w-4" />}
            tone="rose"
            loading={isLoadingAttendance}
          />
          <StatCard
            label="Late"
            value={summary?.late ?? 0}
            icon={<Clock className="h-4 w-4" />}
            tone="amber"
            loading={isLoadingAttendance}
          />
          <StatCard
            label="On Leave"
            value={summary?.onLeave ?? 0}
            icon={<Palmtree className="h-4 w-4" />}
            tone="cyan"
            loading={isLoadingAttendance}
          />
          <StatCard
            label="Not Recorded"
            value={summary?.notRecorded ?? 0}
            icon={<CalendarOff className="h-4 w-4" />}
            tone="slate"
            loading={isLoadingAttendance}
          />
        </section>

        {/* Leo AI Insights */}
        <section className="mb-6 overflow-hidden rounded-2xl border border-purple-500/20 bg-linear-to-r from-purple-500/10 via-indigo-500/5 to-transparent p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="rounded-lg border border-purple-400/30 bg-purple-500/20 p-1.5">
                <LeoIcon className="h-4 w-4 text-purple-200" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">
                  Leo Insights & Recommendations
                </p>
                <p className="text-xs text-white/60">
                  AI-powered analysis for {formatDisplayDate(selectedDate)} — load saved or generate on demand
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            {cachedLeoLoading && !leoInsights ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-purple-400/30 bg-purple-500/5 px-6 py-8">
                <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
                <span className="text-sm text-white/60">Loading saved insights...</span>
              </div>
            ) : leoAI.isError && !leoInsights ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-6 text-center">
                <p className="text-sm text-red-200 mb-2">
                  Leo couldn&apos;t generate insights
                </p>
                <p className="text-xs text-red-200/70 mb-4">{leoAI.error?.message}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => leoAI.mutate()}
                  disabled={leoAI.isPending}
                  className="gap-2 border-red-500/30 text-red-200 hover:bg-red-500/20"
                >
                  {leoAI.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Retry
                </Button>
              </div>
            ) : !leoInsights ? (
              <div className="rounded-xl border border-dashed border-purple-400/30 bg-purple-500/5 px-6 py-8 text-center">
                <div className="flex justify-center mb-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-500/30 bg-purple-500/20">
                    <LeoIcon className="h-6 w-6 text-purple-300" />
                  </div>
                </div>
                <p className="text-sm text-white/70 mb-4">
                  Get AI-powered insights and recommendations for today&apos;s attendance.
                </p>
                <Button
                  onClick={() => leoAI.mutate()}
                  disabled={leoAI.isPending}
                  className="gap-2 rounded-xl bg-purple-600 hover:bg-purple-700"
                >
                  {leoAI.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LeoIcon className="h-4 w-4" />
                  )}
                  Generate with Leo
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {(leoGeneratedAt || leoIsStale) && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-purple-400/20 bg-purple-500/10 px-3 py-2">
                    <span className="flex items-center gap-1.5 text-xs text-white/60">
                      <Clock className="h-3.5 w-3.5" />
                      Generated {formatRelativeTime(leoGeneratedAt)}
                    </span>
                    {leoIsStale && (
                      <span className="text-[10px] text-amber-400">
                        Data may have changed
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => leoAI.mutate()}
                      disabled={leoAI.isPending}
                      className="h-7 gap-1 text-xs text-purple-200 hover:bg-purple-500/20"
                    >
                      {leoAI.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      Regenerate
                    </Button>
                  </div>
                )}
                <p className="text-sm text-white/90 leading-relaxed">{leoInsights.summary}</p>
                {leoInsights.insights.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-white/80 uppercase tracking-wide mb-2">
                      Insights
                    </h4>
                    <ul className="space-y-1.5">
                      {leoInsights.insights.map((insight, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                          <span className="text-purple-400 mt-0.5">•</span>
                          <span>{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {leoInsights.recommendedActions.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-white/80 uppercase tracking-wide mb-2">
                      Recommended Actions
                    </h4>
                    <ul className="space-y-1.5">
                      {leoInsights.recommendedActions.map((action, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                          <ArrowRight className="h-3.5 w-3.5 text-purple-400 shrink-0 mt-0.5" />
                          <span>{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Tabs */}
        <div className="mb-6 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("attendance")}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all",
              activeTab === "attendance"
                ? "border-indigo-500/40 bg-indigo-500/15 text-indigo-200 shadow-lg shadow-indigo-500/10"
                : "border-white/10 bg-white/5 text-white/60 hover:border-white/15 hover:bg-white/8 hover:text-white"
            )}
          >
            <ClipboardCheck className="h-4 w-4" />
            Daily Attendance
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("leave")}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all",
              activeTab === "leave"
                ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-200 shadow-lg shadow-cyan-500/10"
                : "border-white/10 bg-white/5 text-white/60 hover:border-white/15 hover:bg-white/8 hover:text-white"
            )}
          >
            <Palmtree className="h-4 w-4" />
            Leave Requests
            {leaveData?.summary?.pending ? (
              <Badge
                variant="outline"
                className="ml-1 border-amber-400/50 bg-amber-500/20 text-[10px] text-amber-200"
              >
                {leaveData.summary.pending}
              </Badge>
            ) : null}
          </button>
        </div>

        {/* Content */}
        {activeTab === "attendance" ? (
          <Card className="overflow-hidden border border-white/10 bg-neutral-950/60 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-indigo-500/50 to-transparent" />

            <CardHeader className="border-b border-white/10 pb-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/10">
                    <Users className="h-4 w-4 text-indigo-300" />
                  </span>
                  Teacher Roster
                </CardTitle>

                <div className="flex items-center gap-3">
                  {/* Search with clear button */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                    <Input
                      placeholder="Search by name, email..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-9 w-[220px] border-white/15 bg-black/40 pl-9 pr-8 text-sm text-white placeholder:text-white/40 focus:border-indigo-500/50"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Status Filter */}
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-9 w-[140px] border-white/15 bg-black/40 text-sm text-white">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-neutral-950">
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="present">Present</SelectItem>
                      <SelectItem value="absent">Absent</SelectItem>
                      <SelectItem value="late">Late</SelectItem>
                      <SelectItem value="on_leave">On Leave</SelectItem>
                      <SelectItem value="not_recorded">Not Recorded</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Refresh */}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => refetchAttendance()}
                    disabled={isLoadingAttendance}
                    className="h-9 w-9 border-white/15 bg-white/5 text-white hover:bg-white/10"
                  >
                    <RefreshCw
                      className={cn(
                        "h-4 w-4",
                        isLoadingAttendance && "animate-spin"
                      )}
                    />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4">
              {/* Results count */}
              {!isLoadingAttendance && attendanceData?.data && (
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs text-white/50">
                    {debouncedSearch || statusFilter !== "all" ? (
                      <>
                        Showing{" "}
                        <span className="font-medium text-white/70">
                          {filteredTeachers.length}
                        </span>{" "}
                        of{" "}
                        <span className="font-medium text-white/70">
                          {attendanceData.data.length}
                        </span>{" "}
                        teachers
                      </>
                    ) : (
                      <>
                        <span className="font-medium text-white/70">
                          {attendanceData.data.length}
                        </span>{" "}
                        teachers
                      </>
                    )}
                  </p>
                  {debouncedSearch && (
                    <p className="text-xs text-indigo-300/70">
                      Searching for &quot;{debouncedSearch}&quot;
                    </p>
                  )}
                </div>
              )}

              {!isLoadingAttendance && attendanceData?.data && (
                <div className="mb-4 rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-3">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="space-y-1">
                      <p className="flex items-center gap-1.5 text-xs font-medium text-indigo-100">
                        <Sparkles className="h-3.5 w-3.5" />
                        Smart Bulk Actions
                      </p>
                      <p className="text-xs text-indigo-200/75">
                        {bulkCandidates.length} teacher
                        {bulkCandidates.length === 1 ? "" : "s"} ready for bulk
                        update.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={bulkScope}
                        onValueChange={(value) =>
                          setBulkScope(value as "not_recorded" | "filtered")
                        }
                      >
                        <SelectTrigger className="h-8 w-[170px] border-white/15 bg-black/30 text-xs text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-white/10 bg-neutral-950">
                          <SelectItem value="not_recorded">Not Recorded Only</SelectItem>
                          <SelectItem value="filtered">All Filtered Teachers</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select
                        value={bulkStatus}
                        onValueChange={(value) =>
                          setBulkStatus(value as TeacherAttendanceStatus)
                        }
                      >
                        <SelectTrigger className="h-8 w-[140px] border-white/15 bg-black/30 text-xs text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-white/10 bg-neutral-950">
                          <SelectItem value="present">Mark Present</SelectItem>
                          <SelectItem value="absent">Mark Absent</SelectItem>
                          <SelectItem value="late">Mark Late</SelectItem>
                          <SelectItem value="on_leave">Mark On Leave</SelectItem>
                          <SelectItem value="sick">Mark Sick</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        size="sm"
                        onClick={handleBulkMark}
                        disabled={bulkRecord.isPending || bulkCandidates.length === 0}
                        className="h-8 gap-1.5 bg-indigo-500 text-xs font-medium text-white hover:bg-indigo-500/90 disabled:opacity-50"
                      >
                        {bulkRecord.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        Apply in Bulk
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {isLoadingAttendance ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
                  <p className="mt-3 text-sm text-white/50">
                    Loading attendance data...
                  </p>
                </div>
              ) : filteredTeachers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                    <Users className="h-8 w-8 text-white/30" />
                  </div>
                  <p className="mt-4 text-sm font-medium text-white/70">
                    No teachers found
                  </p>
                  <p className="mt-1 text-xs text-white/50">
                    {search || statusFilter !== "all"
                      ? "Try adjusting your filters"
                      : "No active teachers in the system"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTeachers.map((teacher) => (
                    <TeacherAttendanceRow
                      key={teacher.teacherId}
                      teacher={teacher}
                      date={dateStr}
                      onQuickMark={handleQuickMark}
                      isMarking={quickMark.isPending}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden border border-white/10 bg-neutral-950/60 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-cyan-500/50 to-transparent" />

            <CardHeader className="border-b border-white/10 pb-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10">
                    <Palmtree className="h-4 w-4 text-cyan-300" />
                  </span>
                  Leave Requests
                </CardTitle>

                <div className="flex items-center gap-2">
                  {(["pending", "approved", "rejected"] as const).map(
                    (status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setLeaveFilter(status)}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-all",
                          leaveFilter === status
                            ? status === "pending"
                              ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
                              : status === "approved"
                                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                                : "border-rose-500/40 bg-rose-500/15 text-rose-200"
                            : "border-white/10 bg-white/5 text-white/60 hover:border-white/15 hover:bg-white/8"
                        )}
                      >
                        {status}
                        {status === "pending" && leaveData?.summary?.pending ? (
                          <span className="ml-1.5 text-[10px]">
                            ({leaveData.summary.pending})
                          </span>
                        ) : null}
                      </button>
                    )
                  )}

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => refetchLeave()}
                    disabled={isLoadingLeave}
                    className="ml-2 h-8 w-8 border-white/15 bg-white/5 text-white hover:bg-white/10"
                  >
                    <RefreshCw
                      className={cn(
                        "h-3.5 w-3.5",
                        isLoadingLeave && "animate-spin"
                      )}
                    />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4">
              {isLoadingLeave ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                  <p className="mt-3 text-sm text-white/50">
                    Loading leave requests...
                  </p>
                </div>
              ) : !leaveData?.data?.length ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                    <Palmtree className="h-8 w-8 text-white/30" />
                  </div>
                  <p className="mt-4 text-sm font-medium text-white/70">
                    No {leaveFilter} leave requests
                  </p>
                  <p className="mt-1 text-xs text-white/50">
                    Leave requests will appear here when submitted
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {leaveData.data.map((request) => (
                    <LeaveRequestCard
                      key={request.id}
                      request={request}
                      onApprove={handleApproveLeave}
                      onReject={handleRejectLeave}
                      isProcessing={
                        approveLeave.isPending || rejectLeave.isPending
                      }
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
