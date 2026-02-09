"use client";

import * as React from "react";
import {
  BookOpenCheck,
  CalendarDays,
  ClipboardCheck,
  Megaphone,
  Save,
  Sparkles,
  Users,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import { usePeriodAttendance } from "@/hooks/teacher/usePeriodAttendance";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useBusyToast } from "@/hooks/useBusyToast";
import { fetchWithOfflineFallback } from "@/hooks/useOfflineQueue";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { AttendanceGrid } from "@/components/teacher/attendance/AttendanceGrid";
import { AttendanceSummary } from "@/components/teacher/attendance/AttendanceSummary";
import { BulkActions } from "@/components/teacher/attendance/BulkActions";
import type { AttendanceRowData } from "@/components/teacher/attendance/StudentAttendanceRow";

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateInputValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
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

type AssignmentOption = {
  value: string;
  classGroupId: string;
  subjectId: string;
  label: string;
};

export default function PeriodAttendancePage() {
  const busyToast = useBusyToast();
  const { data: contextData } = useTeacherContext();
  const notificationsEnabled =
    contextData?.data.features?.attendanceNotificationsEnabled ?? true;
  const searchParams = useSearchParams();
  const { data: classesData, isLoading: classesLoading } = useTeacherClasses();
  const assignments = (classesData?.data.classes ?? []).map((item) => ({
    value: `${item._id}__${item.subjectId}`,
    classGroupId: item._id,
    subjectId: item.subjectId,
    label: `${item.name} - ${item.subjectName}`,
  }));

  const [assignmentValue, setAssignmentValue] = React.useState<string>("");
  const assignment = assignments.find((item) => item.value === assignmentValue);
  const classGroupId = assignment?.classGroupId ?? "";
  const subjectId = assignment?.subjectId ?? "";

  const [selectedDate, setSelectedDate] = React.useState<Date | null>(
    () => new Date()
  );
  const [periodNumber, setPeriodNumber] = React.useState(1);

  const dateValue = selectedDate ? toDateInputValue(selectedDate) : "";

  const { data: attendanceData, isLoading: attendanceLoading } =
    usePeriodAttendance({
      classGroupId,
      subjectId,
      date: dateValue,
      periodNumber,
      enabled: Boolean(classGroupId && subjectId && dateValue),
    });

  const [records, setRecords] = React.useState<AttendanceRowData[]>([]);
  const lastLoadedKeyRef = React.useRef<string>("");
  const attendanceKey = `${classGroupId}|${subjectId}|${dateValue}|${periodNumber}`;

  React.useEffect(() => {
    const qpClassGroupId = searchParams.get("classGroupId");
    const qpSubjectId = searchParams.get("subjectId");
    const qpDate = searchParams.get("date");
    const qpPeriod = searchParams.get("period");

    if (qpDate) {
      const parsed = fromDateInputValue(qpDate);
      if (parsed) {
        setSelectedDate(parsed);
      }
    }

    if (qpPeriod) {
      const nextPeriod = Number(qpPeriod);
      if (!Number.isNaN(nextPeriod)) {
        setPeriodNumber(Math.max(1, Math.min(20, nextPeriod)));
      }
    }

    if (!qpClassGroupId || !qpSubjectId) return;
    if (assignments.length === 0) return;
    if (assignmentValue) return;

    const match = assignments.find(
      (item) =>
        item.classGroupId === qpClassGroupId && item.subjectId === qpSubjectId
    );
    if (match) {
      setAssignmentValue(match.value);
    }
  }, [assignments, assignmentValue, searchParams]);

  React.useEffect(() => {
    if (!attendanceKey || attendanceKey === lastLoadedKeyRef.current) return;
    setRecords([]);
  }, [attendanceKey]);

  React.useEffect(() => {
    if (!attendanceData?.data?.records) return;
    if (!attendanceKey || attendanceKey === lastLoadedKeyRef.current) return;
    lastLoadedKeyRef.current = attendanceKey;
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
  }, [attendanceData, attendanceKey]);

  const summary = computeSummary(records);

  const handleSave = async () => {
    if (!classGroupId || !subjectId) {
      busyToast.warning("Select a class and subject first.");
      return;
    }
    if (!dateValue) {
      busyToast.warning("Select a date first.");
      return;
    }
    const result = await busyToast.promise(
      fetchWithOfflineFallback("/api/teacher/attendance/period", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classGroupId,
          subjectId,
          periodNumber,
          date: dateValue,
          records: records.map((record) => ({
            studentId: record.studentId,
            status: record.status,
            lateMinutes: record.lateMinutes,
            reason: record.reason,
          })),
        }),
        queueDescription: "Period attendance",
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || "Failed to record attendance");
          return data;
        })
        .catch((err: unknown) => {
          if ((err as { isOfflineQueued?: boolean })?.isOfflineQueued) {
            return { queued: true } as { queued: true };
          }
          throw err;
        }),
      {
        loading: "Recording period attendance...",
        success: "Period attendance recorded",
        error: "Failed to record attendance",
      }
    );
    if ((result as { queued?: boolean })?.queued) {
      busyToast.info("Saved offline", {
        description: "Period attendance will sync when you're back online.",
      });
    }
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

  const handleCopyPrevious = () => {
    busyToast.info("Previous period copy will be available soon.");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Period Attendance</h1>
          <p className="text-sm text-white/60">
            Mark attendance for a specific period and subject.
          </p>
        </div>
        <Button
          type="button"
          onClick={handleSave}
          disabled={!classGroupId || !subjectId || records.length === 0}
          className="h-11 rounded-xl border border-emerald-300/20 bg-linear-to-r from-emerald-500/30 via-cyan-500/25 to-indigo-500/25 px-5 font-medium text-emerald-50 shadow-lg shadow-emerald-950/35 transition-all hover:from-emerald-500/40 hover:via-cyan-500/35 hover:to-indigo-500/35 disabled:border-white/10 disabled:bg-white/5 disabled:text-white/40 disabled:shadow-none"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-md border border-white/20 bg-black/20">
            <Save className="h-3.5 w-3.5" />
          </span>
          Save Attendance
        </Button>
      </div>

      {!notificationsEnabled && (
        <Card className="border border-amber-500/30 bg-amber-500/10">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-amber-100">
            <Megaphone className="h-4 w-4" />
            Guardian notifications are disabled in School Settings. Attendance will be recorded
            without alerts.
          </CardContent>
        </Card>
      )}

      <Card className="relative overflow-hidden border border-white/15 bg-linear-to-br from-slate-900/80 via-slate-900/60 to-slate-950/35 shadow-xl shadow-black/35 backdrop-blur">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-linear-to-r from-indigo-500/15 via-sky-500/10 to-emerald-500/10" />
        <CardHeader className="relative pb-2">
          <CardTitle className="flex items-center gap-3 text-lg text-white">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-indigo-500/20 text-indigo-100">
              <BookOpenCheck className="h-4 w-4" />
            </span>
            Session Details
          </CardTitle>
          <p className="text-sm text-white/55">
            Choose the class, date, and period before marking attendance.
          </p>
        </CardHeader>
        <CardContent className="relative grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-3">
            <label className="text-xs uppercase tracking-[0.2em] text-white/40">
              Class + Subject
            </label>
            <PremiumSelect value={assignmentValue} onValueChange={setAssignmentValue}>
              <PremiumSelectTrigger icon={<ClipboardCheck className="h-4 w-4" />}>
                <PremiumSelectValue placeholder="Select assignment" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {classesLoading && (
                  <PremiumSelectItem value="loading" disabled>
                    Loading...
                  </PremiumSelectItem>
                )}
                {assignments.map((option: AssignmentOption) => (
                  <PremiumSelectItem key={option.value} value={option.value}>
                    {option.label}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>

          <div className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-3">
            <label className="text-xs uppercase tracking-[0.2em] text-white/40">
              Date
            </label>
            <div className="relative">
              <CustomDatePicker
                value={selectedDate}
                onChange={setSelectedDate}
                placeholder="Select date"
                className="w-full"
              />
            </div>
          </div>

          <div className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-3">
            <label className="text-xs uppercase tracking-[0.2em] text-white/40">
              Period
            </label>
            <Input
              type="number"
              min={1}
              max={20}
              value={periodNumber}
              onChange={(event) =>
                setPeriodNumber(Math.max(1, Math.min(20, Number(event.target.value))))
              }
              className="border-white/10 bg-white/5 text-white/80 focus-visible:ring-indigo-400/40"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <BulkActions
            onMarkAllPresent={() => handleMarkAll("present")}
            onMarkAllAbsent={() => handleMarkAll("absent")}
            onCopyYesterday={handleCopyPrevious}
            loading={attendanceLoading}
          />
          <AttendanceSummary summary={summary} />
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden border border-white/15 bg-linear-to-br from-slate-900/80 via-slate-900/60 to-slate-950/35 shadow-xl shadow-black/35 backdrop-blur">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-linear-to-r from-cyan-500/12 via-indigo-500/10 to-transparent" />
        <CardHeader className="relative gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-3 text-lg text-white">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-cyan-500/20 text-cyan-100">
                <Users className="h-4 w-4" />
              </span>
              Student List
            </CardTitle>
            <p className="mt-2 text-sm text-white/55">
              Review and update each student&apos;s attendance status for this session.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
            <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
            {records.length} student{records.length === 1 ? "" : "s"}
          </div>
        </CardHeader>
        <CardContent className="relative">
          {attendanceLoading ? (
            <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-3 sm:p-4">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-20 w-full animate-pulse rounded-2xl border border-white/10 bg-white/5"
                />
              ))}
            </div>
          ) : records.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-8 text-center">
              <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/55">
                <CalendarDays className="h-5 w-5" />
              </span>
              <p className="text-white/70">
                {classGroupId && subjectId
                  ? "No students found for this class."
                  : "Select a class assignment to load students."}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3 sm:p-4">
              <AttendanceGrid records={records} onChange={setRecords} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
