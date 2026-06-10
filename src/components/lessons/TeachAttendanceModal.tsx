"use client";

import * as React from "react";
import {
  CalendarDays,
  Check,
  CheckSquare2,
  Clock,
  Loader2,
  SquareMinus,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { useBusyToast } from "@/hooks/useBusyToast";
import {
  useLessonAttendanceRoster,
  useSavePostLessonAttendance,
  useSavePreLessonAttendance,
  type AttendanceStudentStatus,
  type RosterEntry,
} from "@/hooks/teacher/useLessonAttendance";
import { cn } from "@/lib/utils";

type Phase = "pre" | "post";

type Props = {
  sessionId: string;
  classGroupId?: string | null;
  phase: Phase;
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
};

const POST_STATUS_LABELS: Record<AttendanceStudentStatus, string> = {
  present: "Present",
  absent: "Absent",
  left_early: "Left early",
  arrived_late: "Arrived late",
  not_recorded: "Not recorded",
};

function StudentRow({
  student,
  phase,
  onChange,
}: {
  student: RosterEntry & { localStatus: AttendanceStudentStatus };
  phase: Phase;
  onChange: (id: string, status: AttendanceStudentStatus) => void;
}) {
  const status = student.localStatus;
  const isPresent = status === "present";
  const isAbsent = status === "absent";

  if (phase === "pre") {
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors",
          isPresent ? "bg-emerald-500/10" : "bg-rose-500/10",
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{student.name}</p>
          {student.admissionNo ? (
            <p className="text-xs text-white/45">{student.admissionNo}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onChange(student.studentId, "present")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              isPresent
                ? "bg-emerald-500/30 text-emerald-200"
                : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80",
            )}
          >
            Present
          </button>
          <button
            type="button"
            onClick={() => onChange(student.studentId, "absent")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              isAbsent
                ? "bg-rose-500/30 text-rose-200"
                : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80",
            )}
          >
            Absent
          </button>
        </div>
      </div>
    );
  }

  const postStatuses: AttendanceStudentStatus[] = ["present", "absent", "left_early", "arrived_late"];
  const color =
    status === "present"
      ? "emerald"
      : status === "absent"
        ? "rose"
        : status === "left_early" || status === "arrived_late"
          ? "amber"
          : "slate";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors",
        color === "emerald" && "bg-emerald-500/10",
        color === "rose" && "bg-rose-500/10",
        color === "amber" && "bg-amber-500/10",
        color === "slate" && "bg-white/5",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{student.name}</p>
        <p className="text-xs text-white/40">Pre-lesson: {POST_STATUS_LABELS[student.preLesson]}</p>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {postStatuses.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(student.studentId, s)}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium transition-colors",
              status === s
                ? s === "present"
                  ? "bg-emerald-500/30 text-emerald-200"
                  : s === "absent"
                    ? "bg-rose-500/30 text-rose-200"
                    : "bg-amber-500/30 text-amber-200"
                : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80",
            )}
          >
            {POST_STATUS_LABELS[s]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TeachAttendanceModal({
  sessionId,
  classGroupId,
  phase,
  open,
  onClose,
  onSubmitted,
}: Props) {
  const busyToast = useBusyToast();
  const { data, isLoading } = useLessonAttendanceRoster(open ? sessionId : null, classGroupId);
  const savePreLesson = useSavePreLessonAttendance(sessionId, classGroupId);
  const savePostLesson = useSavePostLessonAttendance(sessionId, classGroupId);

  const roster = data?.data?.roster ?? [];
  const [marks, setMarks] = React.useState<Map<string, AttendanceStudentStatus>>(new Map());
  const [initialized, setInitialized] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setInitialized(false);
      return;
    }
    if (roster.length > 0 && !initialized) {
      const initial = new Map<string, AttendanceStudentStatus>();
      for (const s of roster) {
        if (phase === "pre") {
          // If pre-lesson was already recorded, use existing; otherwise default present
          initial.set(s.studentId, s.preLesson !== "not_recorded" ? s.preLesson : "present");
        } else {
          // Post-lesson: default to the pre-lesson status or present
          const def: AttendanceStudentStatus =
            s.preLesson === "absent" ? "absent" : "present";
          initial.set(s.studentId, s.postLesson !== "not_recorded" ? s.postLesson : def);
        }
      }
      setMarks(initial);
      setInitialized(true);
    }
  }, [roster, initialized, open, phase]);

  const handleChange = (studentId: string, status: AttendanceStudentStatus) => {
    setMarks((prev) => new Map(prev).set(studentId, status));
  };

  const markAll = (status: AttendanceStudentStatus) => {
    setMarks(new Map(roster.map((s) => [s.studentId, status])));
  };

  const presentCount = Array.from(marks.values()).filter((s) => s === "present").length;
  const absentCount = Array.from(marks.values()).filter((s) => s === "absent").length;
  const otherCount = roster.length - presentCount - absentCount;

  const handleSubmit = async () => {
    if (phase === "pre") {
      const marksArr = roster.map((s) => ({
        studentId: s.studentId,
        preLesson: (marks.get(s.studentId) ?? "present") as AttendanceStudentStatus,
      }));
      await busyToast.promise(savePreLesson.mutateAsync(marksArr), {
        loading: "Saving attendance…",
        success: "Pre-lesson attendance saved",
        error: (e) => (e instanceof Error ? e.message : "Failed to save attendance"),
      });
    } else {
      const marksArr = roster.map((s) => ({
        studentId: s.studentId,
        postLesson: (marks.get(s.studentId) ?? "present") as AttendanceStudentStatus,
      }));
      await busyToast.promise(savePostLesson.mutateAsync(marksArr), {
        loading: "Saving post-lesson attendance…",
        success: "Post-lesson attendance saved",
        error: (e) => (e instanceof Error ? e.message : "Failed to save attendance"),
      });
    }
    onSubmitted();
  };

  const isBusy = savePreLesson.isPending || savePostLesson.isPending;

  const enrichedRoster = roster.map((s) => ({
    ...s,
    localStatus: marks.get(s.studentId) ?? (phase === "pre" ? "present" : "not_recorded") as AttendanceStudentStatus,
  }));

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(v) => { if (!v) onClose(); }}
      title={phase === "pre" ? "Pre-lesson attendance" : "Post-lesson attendance"}
      showCloseButton={false}
    >
      <div className="flex max-h-[90vh] flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 p-5">
          <div>
            <h2 className="text-base font-semibold text-white">
              {phase === "pre" ? "Pre-lesson attendance" : "Post-lesson attendance"}
            </h2>
            {data?.data ? (
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-white/50">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {data.data.scheduledDate}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {data.data.startTime}–{data.data.endTime}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {roster.length} students
                </span>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/50 transition-colors hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Summary bar */}
        {roster.length > 0 ? (
          <div className="flex items-center gap-3 border-b border-white/10 px-5 py-3">
            <Badge className="border-0 bg-emerald-500/20 text-emerald-300">
              <Check className="mr-1 h-3 w-3" />
              {presentCount} present
            </Badge>
            <Badge className="border-0 bg-rose-500/20 text-rose-300">
              <SquareMinus className="mr-1 h-3 w-3" />
              {absentCount} absent
            </Badge>
            {otherCount > 0 ? (
              <Badge className="border-0 bg-amber-500/20 text-amber-300">
                {otherCount} other
              </Badge>
            ) : null}
            {phase === "pre" ? (
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => markAll("present")}
                  className="text-xs text-teal-300 hover:underline"
                >
                  All present
                </button>
                <span className="text-white/20">·</span>
                <button
                  type="button"
                  onClick={() => markAll("absent")}
                  className="text-xs text-rose-300 hover:underline"
                >
                  All absent
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Roster list */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-teal-300" />
            </div>
          ) : roster.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Users className="h-8 w-8 text-white/20" />
              <p className="text-sm text-white/50">No active students found in this class.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {enrichedRoster.map((s) => (
                <StudentRow
                  key={s.studentId}
                  student={s}
                  phase={phase}
                  onChange={handleChange}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-white/10 p-5">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-white/60 hover:bg-white/5 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isBusy || roster.length === 0}
            onClick={() => void handleSubmit()}
            className="bg-teal-500/25 text-teal-100 hover:bg-teal-500/35"
          >
            {isBusy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckSquare2 className="mr-2 h-4 w-4" />
            )}
            {phase === "pre" ? "Save & start lesson" : "Save & end lesson"}
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}
