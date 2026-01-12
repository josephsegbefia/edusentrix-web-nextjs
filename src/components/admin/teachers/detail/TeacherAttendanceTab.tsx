// src/components/admin/teachers/detail/TeacherAttendanceTab.tsx
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Calendar,
  List,
  Check,
  X,
  Clock,
  CalendarCheck,
  CalendarX,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useTeacherAttendance,
  useLeaveRequests,
  useApproveLeave,
  useRejectLeave,
  type TeacherAttendanceStatus,
} from "@/hooks/admin/useTeacherAttendance";
import { useBusyToast } from "@/hooks/useBusyToast";
import { RecordAttendanceModal } from "@/components/modals/RecordAttendanceModal";
import { SubmitLeaveRequestModal } from "@/components/modals/SubmitLeaveRequestModal";

type Props = {
  teacher: {
    id: string;
    fullName: string;
  };
};

const statusConfig: Record<
  TeacherAttendanceStatus,
  { bg: string; border: string; text: string; icon: React.ElementType }
> = {
  present: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-200",
    icon: Check,
  },
  absent: {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-200",
    icon: X,
  },
  late: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-200",
    icon: Clock,
  },
  on_leave: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-200",
    icon: CalendarX,
  },
  sick: {
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    text: "text-purple-200",
    icon: AlertCircle,
  },
  other: {
    bg: "bg-slate-500/10",
    border: "border-slate-500/30",
    text: "text-slate-200",
    icon: Calendar,
  },
};

function getStatusLabel(status: TeacherAttendanceStatus): string {
  switch (status) {
    case "present":
      return "Present";
    case "absent":
      return "Absent";
    case "late":
      return "Late";
    case "on_leave":
      return "On Leave";
    case "sick":
      return "Sick";
    case "other":
      return "Other";
    default:
      return status;
  }
}

function formatDate(date: string | Date): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTime(time: string | null): string {
  if (!time) return "—";
  const d = new Date(time);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TeacherAttendanceTab({ teacher }: Props) {
  const [viewMode, setViewMode] = React.useState<"calendar" | "list">("list");
  const [recordModalOpen, setRecordModalOpen] = React.useState(false);
  const [leaveRequestModalOpen, setLeaveRequestModalOpen] =
    React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<string | undefined>();

  // Get current month for filtering
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const { data: attendanceData, isLoading: attendanceLoading } =
    useTeacherAttendance(teacher.id, {
      startDate: startOfMonth.toISOString().split("T")[0],
      endDate: endOfMonth.toISOString().split("T")[0],
      limit: 100,
    });

  const { data: leaveRequestsData, isLoading: leaveRequestsLoading } =
    useLeaveRequests(teacher.id, "pending");

  const attendanceRecords = attendanceData?.data ?? [];
  const leaveRequests = leaveRequestsData?.data ?? [];

  const approveLeaveMutation = useApproveLeave();
  const rejectLeaveMutation = useRejectLeave();
  const busy = useBusyToast();

  const handleApproveLeave = async (leaveRequestId: string) => {
    try {
      await busy.promise(approveLeaveMutation.mutateAsync(leaveRequestId), {
        loading: "Approving leave request...",
        success: "Leave request approved successfully",
        error: "Failed to approve leave request",
      });
    } catch {
      // Error already handled by busy.promise
    }
  };

  const handleRejectLeave = async (leaveRequestId: string) => {
    if (!confirm("Are you sure you want to reject this leave request?")) return;
    try {
      await busy.promise(rejectLeaveMutation.mutateAsync({ leaveRequestId }), {
        loading: "Rejecting leave request...",
        success: "Leave request rejected successfully",
        error: "Failed to reject leave request",
      });
    } catch {
      // Error already handled by busy.promise
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-linear-to-br from-cyan-500/15 via-blue-500/10 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
          aria-hidden="true"
        />

        <CardHeader className="relative z-10 flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-linear-to-br from-cyan-500/20 to-blue-500/20 shadow-inner shadow-white/5">
              <CalendarCheck className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="space-y-0.5">
              <CardTitle className="text-lg font-semibold tracking-tight text-white">
                Attendance
              </CardTitle>
              <p className="text-xs text-white/50">
                Track daily attendance and leave requests
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedDate(undefined);
                setRecordModalOpen(true);
              }}
              className="gap-2 rounded-xl border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
            >
              <Plus className="h-4 w-4" />
              Record Attendance
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLeaveRequestModalOpen(true)}
              className="gap-2 rounded-xl border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20"
            >
              <Plus className="h-4 w-4" />
              Submit Leave Request
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* View mode toggle */}
      <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 p-1 text-xs">
        <button
          type="button"
          onClick={() => setViewMode("list")}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-medium transition",
            viewMode === "list"
              ? "bg-white/10 text-white shadow-sm shadow-black/30"
              : "text-white/60 hover:text-white"
          )}
        >
          <List className="h-3.5 w-3.5" />
          List View
        </button>
        <button
          type="button"
          onClick={() => setViewMode("calendar")}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-medium transition",
            viewMode === "calendar"
              ? "bg-white/10 text-white shadow-sm shadow-black/30"
              : "text-white/60 hover:text-white"
          )}
        >
          <Calendar className="h-3.5 w-3.5" />
          Calendar View
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content */}
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl lg:col-span-2">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-cyan-500/5 via-transparent to-transparent"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
            aria-hidden="true"
          />

          <CardHeader className="relative z-10 border-b border-white/5 pb-0">
            <div className="flex items-center gap-3 pb-4">
              {viewMode === "list" ? (
                <List className="h-5 w-5 text-cyan-300" />
              ) : (
                <Calendar className="h-5 w-5 text-cyan-300" />
              )}
              <CardTitle className="text-base font-semibold text-white">
                {viewMode === "list"
                  ? "Attendance Records"
                  : "Attendance Calendar"}
              </CardTitle>
            </div>
          </CardHeader>

          <CardContent className="relative z-10 p-6">
            {attendanceLoading ? (
              <div className="flex items-center justify-center gap-3 py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-cyan-400" />
                <p className="text-sm text-white/60">Loading attendance...</p>
              </div>
            ) : attendanceRecords.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/2 p-8">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-linear-to-br from-cyan-500/20 to-blue-500/20">
                    <CalendarCheck className="h-7 w-7 text-cyan-300" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-white">
                      No attendance records
                    </p>
                    <p className="text-sm text-white/50">
                      No attendance records found for this month.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="mt-2 gap-2 rounded-xl border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
                    onClick={() => setRecordModalOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Record First Attendance
                  </Button>
                </div>
              </div>
            ) : viewMode === "list" ? (
              <div className="space-y-3">
                {attendanceRecords.map((record) => {
                  const config = statusConfig[record.status];
                  const StatusIcon = config.icon;

                  return (
                    <div
                      key={record.id}
                      className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/2 p-4 transition-all duration-200 hover:border-cyan-500/30 hover:bg-white/5"
                    >
                      <div
                        className={cn(
                          "absolute inset-y-0 left-0 w-1",
                          record.status === "present"
                            ? "bg-emerald-500"
                            : record.status === "absent"
                            ? "bg-red-500"
                            : record.status === "late"
                            ? "bg-amber-500"
                            : "bg-blue-500"
                        )}
                        aria-hidden="true"
                      />

                      <div className="flex items-center justify-between gap-4 pl-3">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {formatDate(record.date)}
                            </p>
                            <div className="mt-1 flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "gap-1 rounded-lg",
                                  config.bg,
                                  config.border,
                                  config.text
                                )}
                              >
                                <StatusIcon className="h-3 w-3" />
                                {getStatusLabel(record.status)}
                              </Badge>
                              {record.minutesLate && (
                                <span className="text-xs text-white/50">
                                  {record.minutesLate} min late
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-white/50">
                          {record.checkInTime && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              In: {formatTime(record.checkInTime)}
                            </div>
                          )}
                          {record.checkOutTime && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Out: {formatTime(record.checkOutTime)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/2 p-8">
                <div className="flex flex-col items-center gap-4 text-center">
                  <Calendar className="h-12 w-12 text-white/30" />
                  <p className="text-sm text-white/50">
                    Calendar view coming soon. Use list view for now.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leave requests sidebar */}
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-blue-500/5 via-transparent to-transparent"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
            aria-hidden="true"
          />

          <CardHeader className="relative z-10 border-b border-white/5 pb-0">
            <div className="flex items-center gap-3 pb-4">
              <CalendarX className="h-5 w-5 text-blue-300" />
              <CardTitle className="text-base font-semibold text-white">
                Pending Leave Requests
              </CardTitle>
            </div>
          </CardHeader>

          <CardContent className="relative z-10 p-6">
            {leaveRequestsLoading ? (
              <div className="flex items-center justify-center gap-3 py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-blue-400" />
                <p className="text-xs text-white/60">Loading...</p>
              </div>
            ) : leaveRequests.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/2 p-6 text-center">
                <CalendarCheck className="mx-auto h-8 w-8 text-white/30" />
                <p className="mt-2 text-sm text-white/50">
                  No pending leave requests
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {leaveRequests.map((request) => (
                  <div
                    key={request.id}
                    className="rounded-xl border border-white/10 bg-white/2 p-4"
                  >
                    <div className="mb-3 space-y-1">
                      <p className="text-sm font-semibold text-white">
                        {formatDate(request.date)}
                      </p>
                      <Badge
                        variant="outline"
                        className="rounded-lg border-blue-500/30 bg-blue-500/10 text-xs text-blue-200"
                      >
                        {request.leaveType}
                      </Badge>
                      {request.reason && (
                        <p className="text-xs text-white/60">
                          {request.reason}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1 rounded-lg border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                        onClick={() => handleApproveLeave(request.id)}
                        disabled={
                          approveLeaveMutation.isPending ||
                          rejectLeaveMutation.isPending
                        }
                      >
                        <Check className="h-3 w-3" />
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1 rounded-lg border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                        onClick={() => handleRejectLeave(request.id)}
                        disabled={
                          approveLeaveMutation.isPending ||
                          rejectLeaveMutation.isPending
                        }
                      >
                        <X className="h-3 w-3" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <RecordAttendanceModal
        open={recordModalOpen}
        onOpenChange={setRecordModalOpen}
        teacherId={teacher.id}
        teacherName={teacher.fullName}
        defaultDate={selectedDate}
      />

      <SubmitLeaveRequestModal
        open={leaveRequestModalOpen}
        onOpenChange={setLeaveRequestModalOpen}
        teacherId={teacher.id}
        teacherName={teacher.fullName}
      />
    </div>
  );
}
