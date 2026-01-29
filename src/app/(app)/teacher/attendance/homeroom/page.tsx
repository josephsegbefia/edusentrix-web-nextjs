"use client";

import * as React from "react";
import { CalendarDays, Save } from "lucide-react";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useHomeroomAttendance } from "@/hooks/teacher/useHomeroomAttendance";
import { useRecordHomeroomAttendance } from "@/hooks/teacher/useRecordHomeroomAttendance";
import { useBusyToast } from "@/hooks/useBusyToast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AttendanceGrid } from "@/components/teacher/attendance/AttendanceGrid";
import { AttendanceSummary } from "@/components/teacher/attendance/AttendanceSummary";
import { BulkActions } from "@/components/teacher/attendance/BulkActions";
import type { AttendanceRowData } from "@/components/teacher/attendance/StudentAttendanceRow";

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function computeSummary(records: AttendanceRowData[]) {
  const summary = {
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    total: records.length,
  };
  for (const record of records) {
    switch (record.status) {
      case "present":
        summary.present += 1;
        break;
      case "absent":
        summary.absent += 1;
        break;
      case "late":
        summary.late += 1;
        break;
      case "excused":
        summary.excused += 1;
        break;
    }
  }
  return summary;
}

export default function HomeroomAttendancePage() {
  const busyToast = useBusyToast();
  const { data: contextData, isLoading: contextLoading } = useTeacherContext();
  const homeroomClassGroupId = contextData?.data.teacher.homeroomClassGroupId;
  const homeroomClassName = contextData?.data.teacher.homeroomClassName;

  const [date, setDate] = React.useState(() => toDateInputValue(new Date()));
  const { data: attendanceData, isLoading, refetch } = useHomeroomAttendance(date);
  const recordMutation = useRecordHomeroomAttendance();

  const [records, setRecords] = React.useState<AttendanceRowData[]>([]);

  React.useEffect(() => {
    if (attendanceData?.data.records) {
      setRecords(
        attendanceData.data.records.map((record) => ({
          studentId: record.studentId,
          name: record.name,
          admissionNo: record.admissionNo,
          photoUrl: record.photoUrl,
          status: record.status,
          lateMinutes: record.lateMinutes,
          reason: record.reason,
        }))
      );
    }
  }, [attendanceData?.data.records]);

  const summary = computeSummary(records);

  const handleSave = async () => {
    if (!homeroomClassGroupId) return;

    await busyToast.promise(
      recordMutation.mutateAsync({
        classGroupId: homeroomClassGroupId,
        date,
        records: records.map((record) => ({
          studentId: record.studentId,
          status: record.status,
          lateMinutes: record.lateMinutes,
          reason: record.reason,
        })),
      }),
      {
        loading: "Recording attendance...",
        success: "Attendance recorded",
        error: "Failed to record attendance",
      }
    );
  };

  const handleMarkAll = (status: AttendanceRowData["status"]) => {
    setRecords((prev) =>
      prev.map((record) => ({
        ...record,
        status,
        lateMinutes: status === "late" ? record.lateMinutes : null,
        reason: status === "present" ? null : record.reason,
      }))
    );
  };

  const handleCopyYesterday = async () => {
    const current = new Date(date);
    if (Number.isNaN(current.getTime())) return;

    const yesterday = new Date(current);
    yesterday.setDate(current.getDate() - 1);
    const yesterdayStr = toDateInputValue(yesterday);

    await busyToast.promise(
      fetch(`/api/teacher/attendance/homeroom/${yesterdayStr}`, {
        cache: "no-store",
      })
        .then(async (res) => {
          if (!res.ok) {
            const data = await res.json().catch(() => null);
            throw new Error(data?.error || "Failed to load yesterday's attendance");
          }
          return res.json();
        })
        .then((payload) => {
          const yesterdayRecords = payload?.data?.records || [];
          const yesterdayMap = new Map(
            yesterdayRecords.map((record: AttendanceRowData) => [record.studentId, record])
          );
          setRecords((prev) =>
            prev.map((record) => {
              const match = yesterdayMap.get(record.studentId);
              return match
                ? {
                    ...record,
                    status: match.status,
                    lateMinutes: match.lateMinutes ?? null,
                    reason: match.reason ?? null,
                  }
                : record;
            })
          );
        }),
      {
        loading: "Applying yesterday's attendance...",
        success: "Applied yesterday's attendance",
        error: "Could not apply yesterday's attendance",
      }
    );
  };

  if (!homeroomClassGroupId && !contextLoading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/60">
        No homeroom class assigned. Contact your admin to enable homeroom attendance.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Homeroom Attendance</h1>
          <p className="text-sm text-white/60">
            {homeroomClassName ? `Class ${homeroomClassName}` : "Record daily attendance"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-white/40" />
            <Input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="pl-9 border-white/10 bg-white/5 text-white/80"
            />
          </div>
          <Button
            type="button"
            onClick={() => refetch()}
            variant="outline"
            className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
          >
            Load
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={recordMutation.isPending || records.length === 0}
            className="bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
          >
            <Save className="h-4 w-4" />
            Save
          </Button>
        </div>
      </div>

      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <BulkActions
            onMarkAllPresent={() => handleMarkAll("present")}
            onMarkAllAbsent={() => handleMarkAll("absent")}
            onCopyYesterday={handleCopyYesterday}
            loading={isLoading}
          />
          <AttendanceSummary summary={summary} />
        </CardContent>
      </Card>

      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg">Student List</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-20 w-full animate-pulse rounded-2xl border border-white/10 bg-white/5"
                />
              ))}
            </div>
          ) : (
            <AttendanceGrid records={records} onChange={setRecords} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
