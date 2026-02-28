"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { CalendarDays, Clock, Loader2, MapPin, Plus, Trash2, User } from "lucide-react";
import { useAcademicPeriods } from "@/hooks/admin/useAcademicPeriods";
import { useTeachersForFilter } from "@/hooks/admin/useClasses";
import { useSubjects } from "@/hooks/admin/useSubjects";
import { useSchoolSettings } from "@/hooks/admin/useSchoolSettings";
import { getResolvedScheduleSettings } from "@/lib/timetable/scheduleSettings";
import {
  useClassTimetableSlots,
  useCreateClassSlot,
  useUpdateClassSlot,
  useDeleteClassSlot,
  type ClassTimetableSlotDTO,
} from "@/hooks/admin/useClassTimetableSlots";
import { DAY_NAMES } from "@/components/admin/timetable/types";
import { formatTimeLabel } from "@/components/admin/timetable/types";
import type { TimetableValidationIssue } from "@/hooks/admin/useTimetablePlanner";

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTime(m: number): string {
  const total = Math.max(0, Math.floor(m));
  const h = Math.floor(total / 60) % 24;
  const min = total % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

type ClassTimetableEditorProps = {
  classId: string;
  className: string;
  gradeId?: string | null;
};

function getPeriodOptionsFromResolved(resolved: {
  periodSlots: Array<{
    periodNumber: number;
    startTime: string;
    endTime: string;
    label?: string;
  }>;
}): Array<{ periodNumber: number; startTime: string; endTime: string; label: string }> {
  const slots = resolved.periodSlots;
  if (!slots?.length) return [];
  return slots.map((s) => ({
    periodNumber: s.periodNumber,
    startTime: s.startTime,
    endTime: s.endTime,
    label: s.label || `Period ${s.periodNumber}`,
  }));
}

function getIssuesFromError(error: unknown): TimetableValidationIssue[] {
  const candidate = error as Error & { issues?: TimetableValidationIssue[] };
  return Array.isArray(candidate.issues) ? candidate.issues : [];
}

export function ClassTimetableEditor({
  classId,
  className,
  gradeId,
}: ClassTimetableEditorProps) {
  const [selectedPeriodId, setSelectedPeriodId] = React.useState<string>("");
  const [slotModalOpen, setSlotModalOpen] = React.useState(false);
  const [editingSlot, setEditingSlot] = React.useState<ClassTimetableSlotDTO | null>(null);
  const [addDayOfWeek, setAddDayOfWeek] = React.useState<number>(1);

  const periodsQuery = useAcademicPeriods();
  const periods = periodsQuery.data?.periods || [];

  const settingsQuery = useSchoolSettings();
  const settings = settingsQuery.data?.data || null;

  const getPeriodOptionsForDay = React.useCallback(
    (dayOfWeek: number) => {
      if (!settings) return [];
      const resolved = getResolvedScheduleSettings(
        {
          schoolStartTime: settings.schoolStartTime,
          schoolEndTime: settings.schoolEndTime,
          periodDuration: settings.periodDuration,
          periodsPerDay: settings.periodsPerDay,
          periodSlots: settings.periodSlots,
          breaks: settings.breaks,
          breakDailyOverrides: settings.breakDailyOverrides || [],
          breakGradeOverrides: settings.breakGradeOverrides || [],
          assembly: settings.assembly
            ? {
                days: settings.assembly.days,
                startTime: settings.assembly.startTime,
                duration: settings.assembly.duration,
              }
            : undefined,
          assemblyDailyOverrides: settings.assemblyDailyOverrides || [],
          assemblyGradeOverrides: settings.assemblyGradeOverrides || [],
          dailyScheduleOverrides: settings.dailyScheduleOverrides,
          gradeScheduleOverrides: settings.gradeScheduleOverrides,
        },
        gradeId ?? undefined,
        dayOfWeek
      );
      return getPeriodOptionsFromResolved(resolved);
    },
    [settings, gradeId]
  );

  const workingDays = settings?.workingDays?.length
    ? settings.workingDays
    : [1, 2, 3, 4, 5];

  const slotsQuery = useClassTimetableSlots(classId, selectedPeriodId);
  const slots = slotsQuery.data?.data || [];

  const subjectsQuery = useSubjects(undefined, true);
  const subjects = subjectsQuery.data?.data || [];

  const teachersQuery = useTeachersForFilter();
  const teachers = teachersQuery.data?.data || [];

  React.useEffect(() => {
    if (selectedPeriodId || periods.length === 0) return;
    const current = periods.find((p) => p.isCurrent) || periods[0];
    if (current?._id) setSelectedPeriodId(current._id);
  }, [periods, selectedPeriodId]);

  const slotsByDay = React.useMemo(() => {
    const map = new Map<number, ClassTimetableSlotDTO[]>();
    for (const slot of slots) {
      const list = map.get(slot.dayOfWeek) || [];
      list.push(slot);
      map.set(slot.dayOfWeek, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [slots]);

  const subjectMap = React.useMemo(
    () => new Map(subjects.map((s) => [s.id, s])),
    [subjects]
  );
  const teacherMap = React.useMemo(
    () => new Map(teachers.map((t) => [t.id, t.fullName])),
    [teachers]
  );

  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg text-white">
            <CalendarDays className="h-5 w-5 text-cyan-300" />
            Class Timetable
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <PremiumSelect
              value={selectedPeriodId}
              onValueChange={setSelectedPeriodId}
            >
              <PremiumSelectTrigger className="w-[220px] border-white/20 bg-white/5 text-white">
                <PremiumSelectValue placeholder="Select academic period" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {periods.map((p) => (
                  <PremiumSelectItem key={p._id} value={p._id}>
                    {p.yearLabel} {p.term}
                    {p.isCurrent ? " (Current)" : ""}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>
        </div>
        <p className="text-sm text-white/60">
          Build the timetable for {className}. Pick a day, add a period with subject and teacher.
          This becomes the source of truth for the master timetable.
        </p>
        {getPeriodOptionsForDay(workingDays[0] ?? 1).length === 0 &&
        !settingsQuery.isLoading ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            Set up school hours in{" "}
            <Link href="/admin/settings" className="underline hover:text-amber-100">
              Settings
            </Link>{" "}
            before creating class timetables.
          </p>
        ) : null}
      </CardHeader>
      <CardContent>
        {!selectedPeriodId ? (
          <div className="rounded-xl border border-dashed border-white/20 bg-white/5 p-6 text-center text-sm text-white/60">
            Select an academic period to edit the timetable.
          </div>
        ) : slotsQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-white/70">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading slots...
          </div>
        ) : (
          <div className="space-y-4">
            {workingDays.map((day) => {
              const daySlots = slotsByDay.get(day) || [];
              return (
                <DaySlotSection
                  key={day}
                  dayOfWeek={day}
                  slots={daySlots}
                  subjectMap={subjectMap}
                  teacherMap={teacherMap}
                  onAddSlot={() => {
                    setAddDayOfWeek(day);
                    setEditingSlot(null);
                    setSlotModalOpen(true);
                  }}
                  onEditSlot={(slot) => {
                    setEditingSlot(slot);
                    setSlotModalOpen(true);
                  }}
                  classId={classId}
                  academicPeriodId={selectedPeriodId}
                  periodOptions={getPeriodOptionsForDay(day)}
                />
              );
            })}
          </div>
        )}
      </CardContent>

      <ClassSlotEditorModal
        open={slotModalOpen}
        onOpenChange={setSlotModalOpen}
        classId={classId}
        academicPeriodId={selectedPeriodId}
        dayOfWeek={addDayOfWeek}
        slot={editingSlot}
        periodOptions={getPeriodOptionsForDay(
          editingSlot?.dayOfWeek ?? addDayOfWeek
        )}
        subjects={subjects}
        teachers={teachers}
        onSaved={() => {
          setSlotModalOpen(false);
          setEditingSlot(null);
          slotsQuery.refetch();
        }}
      />
    </Card>
  );
}

type DaySlotSectionProps = {
  dayOfWeek: number;
  slots: ClassTimetableSlotDTO[];
  subjectMap: Map<string, { id: string; name: string; code: string | null }>;
  teacherMap: Map<string, string>;
  onAddSlot: () => void;
  onEditSlot: (slot: ClassTimetableSlotDTO) => void;
  classId: string;
  academicPeriodId: string;
  periodOptions: Array<{ periodNumber: number; startTime: string; endTime: string; label: string }>;
};

function DaySlotSection({
  dayOfWeek,
  slots,
  subjectMap,
  teacherMap,
  onAddSlot,
  onEditSlot,
  classId,
  academicPeriodId,
  periodOptions,
}: DaySlotSectionProps) {
  const deleteMutation = useDeleteClassSlot(classId);

  const handleDelete = async (slot: ClassTimetableSlotDTO) => {
    if (!window.confirm("Delete this slot?")) return;
    try {
      await deleteMutation.mutateAsync(slot.id);
      toast.success("Slot deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete slot");
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-black/15 p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-medium text-white">{DAY_NAMES[dayOfWeek]}</p>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-white/20 text-xs text-white/65">
            {slots.length} slot{slots.length === 1 ? "" : "s"}
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddSlot}
            className="border-cyan-500/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Slot
          </Button>
        </div>
      </div>

      {slots.length === 0 ? (
        <div
          className="cursor-pointer rounded-lg border border-dashed border-white/15 bg-white/5 p-3 text-xs text-white/50 transition-colors hover:border-cyan-400/30 hover:bg-cyan-500/10 hover:text-white/70"
          onClick={onAddSlot}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onAddSlot()}
        >
          No slots. Click to add.
        </div>
      ) : (
        <div className="space-y-2">
          {slots.map((slot) => {
            const subject = subjectMap.get(slot.subjectId);
            const teacherName = teacherMap.get(slot.teacherId) || "—";
            return (
              <div
                key={slot.id}
                className="group flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3 transition-colors hover:border-cyan-400/40 hover:bg-cyan-500/10"
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div>
                    <p className="font-medium text-white">
                      {subject?.name || "Subject"}
                      {subject?.code ? (
                        <Badge variant="outline" className="ml-2 border-white/20 text-xs">
                          {subject.code}
                        </Badge>
                      ) : null}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-white/65">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatTimeLabel(slot.startTime)} - {formatTimeLabel(slot.endTime)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {slot.classroomLabel}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {teacherName}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditSlot(slot)}
                    className="h-8 text-white/70 hover:bg-white/10 hover:text-white"
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(slot)}
                    disabled={deleteMutation.isPending}
                    className="h-8 text-rose-300 hover:bg-rose-500/20 hover:text-rose-200"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type ClassSlotEditorModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  academicPeriodId: string;
  dayOfWeek: number;
  slot: ClassTimetableSlotDTO | null;
  periodOptions: Array<{ periodNumber: number; startTime: string; endTime: string; label: string }>;
  subjects: Array<{ id: string; name: string; code: string | null }>;
  teachers: Array<{ id: string; fullName: string }>;
  onSaved: () => void;
};

function ClassSlotEditorModal({
  open,
  onOpenChange,
  classId,
  academicPeriodId,
  dayOfWeek,
  slot,
  periodOptions,
  subjects,
  teachers,
  onSaved,
}: ClassSlotEditorModalProps) {
  const createMutation = useCreateClassSlot(classId);
  const updateMutation = useUpdateClassSlot(classId);

  const isEdit = Boolean(slot?.id);

  const [formDayOfWeek, setFormDayOfWeek] = React.useState(dayOfWeek);
  const [formPeriodKey, setFormPeriodKey] = React.useState<string>("");
  const [formDuration, setFormDuration] = React.useState<"1" | "1.5" | "2">("1");
  const [formStartTime, setFormStartTime] = React.useState("08:00");
  const [formEndTime, setFormEndTime] = React.useState("08:40");
  const [formSubjectId, setFormSubjectId] = React.useState("");
  const [formTeacherId, setFormTeacherId] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [issues, setIssues] = React.useState<TimetableValidationIssue[]>([]);

  React.useEffect(() => {
    if (!open) return;
    if (slot) {
      setFormDayOfWeek(slot.dayOfWeek);
      setFormStartTime(slot.startTime);
      setFormEndTime(slot.endTime);
      setFormSubjectId(slot.subjectId);
      setFormTeacherId(slot.teacherId);
      const match = periodOptions.find((p) => p.startTime === slot.startTime && p.endTime === slot.endTime);
      if (match) {
        setFormPeriodKey(`p-${match.periodNumber}`);
        setFormDuration("1");
      } else {
        const matchDouble = periodOptions.find(
          (p, i) =>
            i < periodOptions.length - 1 &&
            p.startTime === slot.startTime &&
            periodOptions[i + 1]?.endTime === slot.endTime
        );
        if (matchDouble) {
          setFormPeriodKey(`p-${matchDouble.periodNumber}`);
          setFormDuration("2");
        } else {
          const matchHalf = periodOptions.find(
            (p, i) =>
              i < periodOptions.length - 1 &&
              p.startTime === slot.startTime &&
              (() => {
                const p2 = periodOptions[i + 1];
                if (!p2) return false;
                const p1EndM = timeToMinutes(p.endTime);
                const p2Dur = timeToMinutes(p2.endTime) - timeToMinutes(p2.startTime);
                const expectedEndM = p1EndM + p2Dur / 2;
                const actualEndM = timeToMinutes(slot.endTime);
                return Math.abs(expectedEndM - actualEndM) < 2;
              })()
          );
          if (matchHalf) {
            setFormPeriodKey(`p-${matchHalf.periodNumber}`);
            setFormDuration("1.5");
          } else {
            setFormPeriodKey("custom");
            setFormDuration("1");
          }
        }
      }
    } else {
      setFormDayOfWeek(dayOfWeek);
      const first = periodOptions[0];
      if (first) {
        setFormPeriodKey(`p-${first.periodNumber}`);
        setFormDuration("1");
        setFormStartTime(first.startTime);
        setFormEndTime(first.endTime);
      } else {
        setFormPeriodKey("custom");
        setFormDuration("1");
        setFormStartTime("08:00");
        setFormEndTime("08:40");
      }
      setFormSubjectId("");
      setFormTeacherId("");
    }
    setFormError(null);
    setIssues([]);
  }, [open, slot, dayOfWeek, periodOptions]);

  React.useEffect(() => {
    if (formPeriodKey && formPeriodKey !== "custom") {
      const num = parseInt(formPeriodKey.replace("p-", ""), 10);
      const idx = periodOptions.findIndex((x) => x.periodNumber === num);
      const p = periodOptions[idx];
      const p2 = idx >= 0 && idx < periodOptions.length - 1 ? periodOptions[idx + 1] : null;
      if (p) {
        setFormStartTime(p.startTime);
        if (formDuration === "1") {
          setFormEndTime(p.endTime);
        } else if (formDuration === "2" && p2) {
          setFormEndTime(p2.endTime);
        } else if (formDuration === "1.5" && p2) {
          const p1EndM = timeToMinutes(p.endTime);
          const p2Dur = timeToMinutes(p2.endTime) - timeToMinutes(p2.startTime);
          setFormEndTime(minutesToTime(p1EndM + p2Dur / 2));
        } else {
          setFormEndTime(p.endTime);
        }
      }
    }
  }, [formPeriodKey, formDuration, periodOptions]);

  const isBusy = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async () => {
    if (!formSubjectId || !formTeacherId) {
      setFormError("Subject and teacher are required.");
      return;
    }
    if (!formStartTime || !formEndTime) {
      setFormError("Start and end time are required.");
      return;
    }
    setFormError(null);
    setIssues([]);

    try {
      if (isEdit && slot?.id) {
        await updateMutation.mutateAsync({
          slotId: slot.id,
          payload: {
            subjectId: formSubjectId,
            teacherId: formTeacherId,
            dayOfWeek: formDayOfWeek,
            startTime: formStartTime,
            endTime: formEndTime,
          },
        });
        toast.success("Slot updated");
      } else {
        await createMutation.mutateAsync({
          academicPeriodId,
          dayOfWeek: formDayOfWeek,
          startTime: formStartTime,
          endTime: formEndTime,
          subjectId: formSubjectId,
          teacherId: formTeacherId,
        });
        toast.success("Slot created");
      }
      onOpenChange(false);
      onSaved();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to save slot";
      setFormError(msg);
      setIssues(getIssuesFromError(error));
      toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border-white/20 bg-slate-950 text-white">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Slot" : "Add Slot"}</DialogTitle>
          <DialogDescription className="text-white/60">
            {isEdit
              ? "Update subject, teacher, and time for this slot."
              : "Add a new slot to the class timetable."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-white/80">Day</Label>
            <PremiumSelect
              value={String(formDayOfWeek)}
              onValueChange={(v) => setFormDayOfWeek(Number(v))}
            >
              <PremiumSelectTrigger className="border-white/15 bg-white/5 text-white">
                <PremiumSelectValue />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {DAY_NAMES.map((name, i) => (
                  <PremiumSelectItem key={i} value={String(i)}>
                    {name}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>

          <div className="space-y-1.5">
            <Label className="text-white/80">Period</Label>
            <PremiumSelect value={formPeriodKey} onValueChange={setFormPeriodKey}>
              <PremiumSelectTrigger className="border-white/15 bg-white/5 text-white">
                <PremiumSelectValue />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {periodOptions.map((p) => (
                  <PremiumSelectItem key={p.periodNumber} value={`p-${p.periodNumber}`}>
                    {p.label} ({p.startTime} - {p.endTime})
                  </PremiumSelectItem>
                ))}
                <PremiumSelectItem value="custom">Custom time</PremiumSelectItem>
              </PremiumSelectContent>
            </PremiumSelect>
          </div>

          {formPeriodKey !== "custom" ? (
            <div className="space-y-1.5">
              <Label className="text-white/80">Duration</Label>
              <PremiumSelect
                value={formDuration}
                onValueChange={(v) => setFormDuration(v as "1" | "1.5" | "2")}
              >
                <PremiumSelectTrigger className="border-white/15 bg-white/5 text-white">
                  <PremiumSelectValue />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  <PremiumSelectItem value="1">1 period</PremiumSelectItem>
                  <PremiumSelectItem value="1.5">1.5 periods</PremiumSelectItem>
                  <PremiumSelectItem value="2">2 periods (double)</PremiumSelectItem>
                </PremiumSelectContent>
              </PremiumSelect>
            </div>
          ) : null}

          {formPeriodKey === "custom" ? (
            <>
              <div className="space-y-1.5">
                <Label className="text-white/80">Start Time</Label>
                <Input
                  type="time"
                  value={formStartTime}
                  onChange={(e) => setFormStartTime(e.target.value)}
                  className="border-white/15 bg-white/5 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/80">End Time</Label>
                <Input
                  type="time"
                  value={formEndTime}
                  onChange={(e) => setFormEndTime(e.target.value)}
                  className="border-white/15 bg-white/5 text-white"
                />
              </div>
            </>
          ) : null}

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-white/80">Subject</Label>
            <PremiumSelect value={formSubjectId} onValueChange={setFormSubjectId}>
              <PremiumSelectTrigger className="border-white/15 bg-white/5 text-white">
                <PremiumSelectValue placeholder="Select subject" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {subjects.map((s) => (
                  <PremiumSelectItem key={s.id} value={s.id}>
                    {s.code ? `${s.name} (${s.code})` : s.name}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-white/80">Teacher</Label>
            <PremiumSelect value={formTeacherId} onValueChange={setFormTeacherId}>
              <PremiumSelectTrigger className="border-white/15 bg-white/5 text-white">
                <PremiumSelectValue placeholder="Select teacher" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {teachers.map((t) => (
                  <PremiumSelectItem key={t.id} value={t.id}>
                    {t.fullName}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>
        </div>

        {formError ? (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
            {formError}
            {issues.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {issues.map((issue) => (
                  <Badge
                    key={`${issue.code}-${issue.field || ""}`}
                    variant="outline"
                    className="border-rose-300/40 text-rose-200"
                  >
                    {issue.code}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="border-white/20 bg-transparent text-white/80 hover:bg-white/10"
            onClick={() => onOpenChange(false)}
            disabled={isBusy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isBusy}
            className="bg-emerald-500 text-white hover:bg-emerald-400"
          >
            {isEdit ? "Save Changes" : "Create Slot"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
