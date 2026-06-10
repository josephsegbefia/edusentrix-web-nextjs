// src/components/modals/AssignSubjectScheduleModal.tsx
"use client";

import * as React from "react";
import { Clock, Loader2, Save } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBusyToast } from "@/hooks/useBusyToast";
import {
  formatHoursMinutes,
  hoursMinutesToDecimal,
  splitDecimalHours,
} from "@/lib/time/format-duration";

type AssignSubjectScheduleModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignmentId: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  classId: string;
  className: string;
  initialContactHours?: number;
};

export function AssignSubjectScheduleModal({
  open,
  onOpenChange,
  assignmentId,
  subjectName,
  teacherName,
  className,
  initialContactHours = 0,
}: AssignSubjectScheduleModalProps) {
  const queryClient = useQueryClient();
  const busy = useBusyToast();
  const [hours, setHours] = React.useState(0);
  const [minutes, setMinutes] = React.useState(0);
  const [inputError, setInputError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const split = splitDecimalHours(initialContactHours);
    setHours(split.hours);
    setMinutes(split.minutes);
    setInputError(null);
  }, [initialContactHours, open]);

  const updateMutation = useMutation({
    mutationFn: async (contactHoursPerWeek: number) => {
      const res = await fetch(`/api/admin/teacher-assignments/${assignmentId}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactHoursPerWeek }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || "Failed to update contact hours");
      }
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["class-subject-teachers"] });
      busy.success("Contact hours updated");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      busy.error(error.message || "Failed to update contact hours");
    },
  });

  const isSubmitting = updateMutation.isPending;

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextHours = Number.isFinite(hours) ? Math.max(0, Math.floor(hours)) : 0;
    const nextMinutes = Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : 0;

    if (nextMinutes > 59) {
      setInputError("Minutes must be between 0 and 59.");
      return;
    }
    if (nextHours > 40 || (nextHours === 40 && nextMinutes > 0)) {
      setInputError("Contact hours cannot be more than 40 hours per week.");
      return;
    }

    setInputError(null);
    await busy.promise(updateMutation.mutateAsync(hoursMinutesToDecimal(nextHours, nextMinutes)), {
      loading: "Updating contact hours...",
      success: "Contact hours updated",
      error: (e: Error) => e.message || "Failed to update contact hours",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-white">
            <Clock className="h-5 w-5 text-cyan-300" />
            Set Contact Hours
          </DialogTitle>
          <div className="mt-2 space-y-1 text-sm text-white/60">
            <p>
              <span className="font-medium text-white/80">Subject:</span> {subjectName}
            </p>
            <p>
              <span className="font-medium text-white/80">Teacher:</span> {teacherName}
            </p>
            <p>
              <span className="font-medium text-white/80">Class:</span> {className}
            </p>
          </div>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-50/85">
            The class timetable is the only source of truth for teaching times. Contact hours are
            used as planning targets and warnings while building the timetable.
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactHoursHours" className="text-sm font-semibold text-white">
              Contact Hours Per Week
            </Label>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Input
                  id="contactHoursHours"
                  type="number"
                  min="0"
                  max="40"
                  step="1"
                  value={hours}
                  onChange={(event) => setHours(Number(event.target.value))}
                  className="w-24 border-white/10 bg-white/5 text-white"
                />
                <span className="text-sm text-white/60">hours</span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="contactHoursMinutes"
                  type="number"
                  min="0"
                  max="59"
                  step="5"
                  value={minutes}
                  onChange={(event) => setMinutes(Number(event.target.value))}
                  className="w-24 border-white/10 bg-white/5 text-white"
                />
                <span className="text-sm text-white/60">minutes</span>
              </div>
            </div>
            <p className="text-xs text-white/45">
              This will save as {formatHoursMinutes(hoursMinutesToDecimal(hours, minutes))} per week.
            </p>
            {inputError ? (
              <p className="text-xs text-rose-300">{inputError}</p>
            ) : (
              <p className="text-xs text-white/45">
                Example: 3 hours 20 minutes means five 40-minute lessons per week.
              </p>
            )}
            <div className="hidden">
              <Input
                id="contactHours"
                type="number"
                value={hoursMinutesToDecimal(hours, minutes)}
                readOnly
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-cyan-500 text-black hover:bg-cyan-400">
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save contact hours
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
