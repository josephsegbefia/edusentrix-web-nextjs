// src/components/modals/AssignSubjectScheduleModal.tsx
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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

const ContactHoursSchema = z.object({
  contactHoursPerWeek: z.number().min(0).max(40),
});

type ContactHoursFormInput = z.infer<typeof ContactHoursSchema>;

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

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactHoursFormInput>({
    resolver: zodResolver(ContactHoursSchema),
    defaultValues: { contactHoursPerWeek: initialContactHours },
  });

  React.useEffect(() => {
    if (open) reset({ contactHoursPerWeek: initialContactHours });
  }, [initialContactHours, open, reset]);

  const updateMutation = useMutation({
    mutationFn: async (data: ContactHoursFormInput) => {
      const res = await fetch(`/api/admin/teacher-assignments/${assignmentId}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactHoursPerWeek: data.contactHoursPerWeek }),
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

  const onSubmit = handleSubmit(async (data) => {
    await busy.promise(updateMutation.mutateAsync(data), {
      loading: "Updating contact hours...",
      success: "Contact hours updated",
      error: (e: Error) => e.message || "Failed to update contact hours",
    });
  });

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
            <Label htmlFor="contactHours" className="text-sm font-semibold text-white">
              Contact Hours Per Week
            </Label>
            <div className="flex items-center gap-3">
              <Input
                id="contactHours"
                type="number"
                min="0"
                max="40"
                step="0.25"
                {...register("contactHoursPerWeek", { valueAsNumber: true })}
                className="w-36 border-white/10 bg-white/5 text-white"
              />
              <span className="text-sm text-white/60">hours</span>
            </div>
            {errors.contactHoursPerWeek ? (
              <p className="text-xs text-rose-300">{errors.contactHoursPerWeek.message}</p>
            ) : (
              <p className="text-xs text-white/45">
                Example: 4.5 means four and a half hours of scheduled teaching in this class per week.
              </p>
            )}
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

