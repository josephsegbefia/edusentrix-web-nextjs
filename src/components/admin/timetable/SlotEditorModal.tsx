"use client";

import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateTimetableSlot,
  useDeleteTimetableSlot,
  useUpdateTimetableSlot,
  type TimetableSlotSource,
  type TimetableValidationIssue,
} from "@/hooks/admin/useTimetablePlanner";
import {
  DAY_NAMES,
  type TimetableClassOption,
  type TimetableEnrichedSlot,
  type TimetableGradeOption,
  type TimetableSubjectOption,
  type TimetableTeacherOption,
} from "./types";

type SlotEditorModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versionId?: string;
  slot?: TimetableEnrichedSlot | null;
  isDraft: boolean;
  grades: TimetableGradeOption[];
  classes: TimetableClassOption[];
  subjects: TimetableSubjectOption[];
  teachers: TimetableTeacherOption[];
  onSaved?: () => void;
};

type SlotFormState = {
  classGroupId: string;
  gradeId: string;
  subjectId: string;
  teacherId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  classroomLabel: string;
  source: TimetableSlotSource;
};

const DEFAULT_FORM: SlotFormState = {
  classGroupId: "",
  gradeId: "",
  subjectId: "",
  teacherId: "",
  dayOfWeek: "1",
  startTime: "08:00",
  endTime: "09:00",
  classroomLabel: "",
  source: "manual",
};

function getIssuesFromError(error: unknown): TimetableValidationIssue[] {
  const candidate = error as Error & { issues?: TimetableValidationIssue[] };
  return Array.isArray(candidate.issues) ? candidate.issues : [];
}

export function SlotEditorModal({
  open,
  onOpenChange,
  versionId,
  slot,
  isDraft,
  grades,
  classes,
  subjects,
  teachers,
  onSaved,
}: SlotEditorModalProps) {
  const createMutation = useCreateTimetableSlot();
  const updateMutation = useUpdateTimetableSlot();
  const deleteMutation = useDeleteTimetableSlot();

  const [form, setForm] = React.useState<SlotFormState>(DEFAULT_FORM);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [issues, setIssues] = React.useState<TimetableValidationIssue[]>([]);

  const isEdit = Boolean(slot?.id);
  const isBusy =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  React.useEffect(() => {
    if (!open) return;

    if (slot) {
      setForm({
        classGroupId: slot.classGroupId,
        gradeId: slot.gradeId,
        subjectId: slot.subjectId,
        teacherId: slot.teacherId,
        dayOfWeek: String(slot.dayOfWeek),
        startTime: slot.startTime,
        endTime: slot.endTime,
        classroomLabel: slot.classroomLabel,
        source: slot.source,
      });
    } else {
      setForm(DEFAULT_FORM);
    }

    setFormError(null);
    setIssues([]);
  }, [open, slot]);

  const visibleClasses = React.useMemo(() => {
    if (!form.gradeId) return classes;
    return classes.filter((classOption) => classOption.gradeId === form.gradeId);
  }, [classes, form.gradeId]);

  const handleClassChange = (nextClassId: string) => {
    const classOption = classes.find((item) => item.id === nextClassId);
    setForm((prev) => ({
      ...prev,
      classGroupId: nextClassId,
      gradeId: classOption?.gradeId || prev.gradeId,
    }));
  };

  const handleSubmit = async () => {
    if (!versionId) {
      setFormError("No timetable version selected.");
      return;
    }

    if (!isDraft) {
      setFormError("Only draft timetable versions can be edited.");
      return;
    }

    if (!form.classGroupId || !form.gradeId || !form.subjectId || !form.teacherId) {
      setFormError("Class, grade, subject, and teacher are required.");
      return;
    }

    if (!form.startTime || !form.endTime) {
      setFormError("Start and end time are required.");
      return;
    }

    const dayOfWeek = Number(form.dayOfWeek);
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      setFormError("Day of week must be between 0 and 6.");
      return;
    }

    setFormError(null);
    setIssues([]);

    const payload = {
      classGroupId: form.classGroupId,
      gradeId: form.gradeId,
      subjectId: form.subjectId,
      teacherId: form.teacherId,
      dayOfWeek,
      startTime: form.startTime,
      endTime: form.endTime,
      classroomLabel: form.classroomLabel.trim() || null,
      source: form.source,
    };

    try {
      if (isEdit && slot?.id) {
        await updateMutation.mutateAsync({
          versionId,
          slotId: slot.id,
          payload,
        });
        toast.success("Timetable slot updated");
      } else {
        await createMutation.mutateAsync({
          versionId,
          payload,
        });
        toast.success("Timetable slot created");
      }

      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      const fallback = error instanceof Error ? error.message : "Failed to save slot";
      setFormError(fallback);
      const validationIssues = getIssuesFromError(error);
      setIssues(validationIssues);
      toast.error(fallback);
    }
  };

  const handleDelete = async () => {
    if (!versionId || !slot?.id) return;
    if (!isDraft) {
      setFormError("Only draft timetable versions can be edited.");
      return;
    }

    const shouldDelete = window.confirm("Delete this slot from the draft timetable?");
    if (!shouldDelete) return;

    try {
      await deleteMutation.mutateAsync({ versionId, slotId: slot.id });
      toast.success("Timetable slot deleted");
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete slot";
      setFormError(message);
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border-white/20 bg-slate-950 text-white">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Draft Slot" : "Add Draft Slot"}</DialogTitle>
          <DialogDescription className="text-white/60">
            {isEdit
              ? "Update time, class, subject, and teacher assignment for this slot."
              : "Create a new slot in the selected draft timetable version."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-white/80">Grade</Label>
            <Select value={form.gradeId} onValueChange={(value) => setForm((prev) => ({ ...prev, gradeId: value }))}>
              <SelectTrigger className="border-white/15 bg-white/5 text-white">
                <SelectValue placeholder="Select grade" />
              </SelectTrigger>
              <SelectContent>
                {grades.map((grade) => (
                  <SelectItem key={grade.id} value={grade.id}>
                    {grade.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-white/80">Class</Label>
            <Select value={form.classGroupId} onValueChange={handleClassChange}>
              <SelectTrigger className="border-white/15 bg-white/5 text-white">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {visibleClasses.map((classOption) => (
                  <SelectItem key={classOption.id} value={classOption.id}>
                    {classOption.fullLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-white/80">Subject</Label>
            <Select
              value={form.subjectId}
              onValueChange={(value) => setForm((prev) => ({ ...prev, subjectId: value }))}
            >
              <SelectTrigger className="border-white/15 bg-white/5 text-white">
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.code ? `${subject.name} (${subject.code})` : subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-white/80">Teacher</Label>
            <Select
              value={form.teacherId}
              onValueChange={(value) => setForm((prev) => ({ ...prev, teacherId: value }))}
            >
              <SelectTrigger className="border-white/15 bg-white/5 text-white">
                <SelectValue placeholder="Select teacher" />
              </SelectTrigger>
              <SelectContent>
                {teachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-white/80">Day</Label>
            <Select
              value={form.dayOfWeek}
              onValueChange={(value) => setForm((prev) => ({ ...prev, dayOfWeek: value }))}
            >
              <SelectTrigger className="border-white/15 bg-white/5 text-white">
                <SelectValue placeholder="Select day" />
              </SelectTrigger>
              <SelectContent>
                {DAY_NAMES.map((day, index) => (
                  <SelectItem key={day} value={String(index)}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-white/80">Source</Label>
            <Select
              value={form.source}
              onValueChange={(value) => setForm((prev) => ({ ...prev, source: value as TimetableSlotSource }))}
            >
              <SelectTrigger className="border-white/15 bg-white/5 text-white">
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="imported">Imported</SelectItem>
                <SelectItem value="assignment_sync">Assignment Sync</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-white/80">Start Time</Label>
            <Input
              type="time"
              value={form.startTime}
              onChange={(event) => setForm((prev) => ({ ...prev, startTime: event.target.value }))}
              className="border-white/15 bg-white/5 text-white"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-white/80">End Time</Label>
            <Input
              type="time"
              value={form.endTime}
              onChange={(event) => setForm((prev) => ({ ...prev, endTime: event.target.value }))}
              className="border-white/15 bg-white/5 text-white"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-white/80">Classroom Label (optional override)</Label>
          <Input
            value={form.classroomLabel}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, classroomLabel: event.target.value }))
            }
            className="border-white/15 bg-white/5 text-white"
            placeholder="e.g. Primary 4A Classroom"
          />
        </div>

        {formError ? (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
            {formError}
            {issues.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {issues.map((issue) => (
                  <Badge key={`${issue.code}-${issue.field || ""}`} variant="outline" className="border-rose-300/40 text-rose-200">
                    {issue.code}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          {isEdit ? (
            <Button
              type="button"
              variant="outline"
              className="mr-auto border-rose-500/40 bg-transparent text-rose-200 hover:bg-rose-500/10"
              onClick={handleDelete}
              disabled={isBusy || !isDraft}
            >
              Delete Slot
            </Button>
          ) : null}

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
            disabled={isBusy || !isDraft}
            className="bg-emerald-500 text-white hover:bg-emerald-400"
          >
            {isEdit ? "Save Changes" : "Create Slot"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
