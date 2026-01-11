// src/components/admin/teachers/detail/TeacherAttendanceTab.tsx
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Calendar, List, Check, X, Clock } from "lucide-react";
import { toast } from "sonner";
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

function getStatusBadgeClass(status: TeacherAttendanceStatus): string {
  switch (status) {
    case "present":
      return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
    case "absent":
      return "border-red-400/30 bg-red-500/10 text-red-200";
    case "late":
      return "border-amber-400/30 bg-amber-500/10 text-amber-200";
    case "on_leave":
      return "border-blue-400/30 bg-blue-500/10 text-blue-200";
    case "sick":
      return "border-purple-400/30 bg-purple-500/10 text-purple-200";
    case "other":
      return "border-neutral-400/30 bg-neutral-500/10 text-neutral-200";
    default:
      return "border-white/10 bg-white/5 text-white/80";
  }
}

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
  const [leaveRequestModalOpen, setLeaveRequestModalOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<string | undefined>();

  // Get current month for filtering
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const { data: attendanceData, isLoading: attendanceLoading } = useTeacherAttendance(
    teacher.id,
    {
      startDate: startOfMonth.toISOString().split("T")[0],
      endDate: endOfMonth.toISOString().split("T")[0],
      limit: 100,
    }
  );

  const { data: leaveRequestsData, isLoading: leaveRequestsLoading } = useLeaveRequests(
    teacher.id,
    "pending"
  );

  const attendanceRecords = attendanceData?.data ?? [];
  const leaveRequests = leaveRequestsData?.data ?? [];

  const approveLeaveMutation = useApproveLeave();
  const rejectLeaveMutation = useRejectLeave();
  const busy = useBusyToast();

  const handleApproveLeave = async (leaveRequestId: string) => {
    try {
      await busy.promise(
        approveLeaveMutation.mutateAsync(leaveRequestId),
        {
          loading: "Approving leave request...",
          success: "Leave request approved successfully",
          error: (e: Error) => e.message || "Failed to approve leave request",
        }
      );
    } catch {
      // Error already handled by busy.promise
    }
  };

  const handleRejectLeave = async (leaveRequestId: string) => {
    if (!confirm("Are you sure you want to reject this leave request?")) return;
    try {
      await busy.promise(
        rejectLeaveMutation.mutateAsync({ leaveRequestId }),
        {
          loading: "Rejecting leave request...",
          success: "Leave request rejected successfully",
          error: (e: Error) => e.message || "Failed to reject leave request",
        }
      );
    } catch {
      // Error already handled by busy.promise
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Attendance</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedDate(undefined);
                setRecordModalOpen(true);
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Record Attendance
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLeaveRequestModalOpen(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Submit Leave Request
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* View mode toggle */}
      <div className="flex items-center gap-2">
        <Button
          variant={viewMode === "list" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("list")}
          className="gap-2"
        >
          <List className="h-4 w-4" />
          List View
        </Button>
        <Button
          variant={viewMode === "calendar" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("calendar")}
          className="gap-2"
        >
          <Calendar className="h-4 w-4" />
          Calendar View
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Main content */}
        <Card className="lg:col-span-2 border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle>
              {viewMode === "list" ? "Attendance Records" : "Attendance Calendar"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {attendanceLoading ? (
              <div className="flex items-center gap-3 py-10">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
                <p className="text-sm text-muted-foreground">Loading attendance...</p>
              </div>
            ) : attendanceRecords.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No attendance records found for this month.
                </p>
                <Button
                  variant="outline"
                  className="mt-4 gap-2"
                  onClick={() => setRecordModalOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Record First Attendance
                </Button>
              </div>
            ) : viewMode === "list" ? (
              <div className="space-y-2">
                {attendanceRecords.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-sm font-semibold">{formatDate(record.date)}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={getStatusBadgeClass(record.status)}
                          >
                            {getStatusLabel(record.status)}
                          </Badge>
                          {record.minutesLate && (
                            <span className="text-xs text-muted-foreground">
                              {record.minutesLate} min late
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {record.checkInTime && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(record.checkInTime)}
                        </div>
                      )}
                      {record.checkOutTime && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(record.checkOutTime)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-muted-foreground text-center py-8">
                  Calendar view coming soon. Use list view for now.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leave requests sidebar */}
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle>Pending Leave Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {leaveRequestsLoading ? (
              <div className="flex items-center gap-3 py-4">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
                <p className="text-xs text-muted-foreground">Loading...</p>
              </div>
            ) : leaveRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No pending leave requests
              </p>
            ) : (
              <div className="space-y-3">
                {leaveRequests.map((request) => (
                  <div
                    key={request.id}
                    className="rounded-lg border border-white/10 bg-white/5 p-3"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{formatDate(request.date)}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {request.leaveType}
                        </p>
                        {request.reason && (
                          <p className="text-xs text-white/70 mt-1">{request.reason}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1 border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                        onClick={() => handleApproveLeave(request.id)}
                        disabled={approveLeaveMutation.isPending || rejectLeaveMutation.isPending}
                      >
                        <Check className="h-3 w-3" />
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1 border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                        onClick={() => handleRejectLeave(request.id)}
                        disabled={approveLeaveMutation.isPending || rejectLeaveMutation.isPending}
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
