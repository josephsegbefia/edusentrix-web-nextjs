// src/components/modals/AssignSubjectScheduleModal.tsx
"use client";

import * as React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Clock,
  Plus,
  Trash2,
  Calendar,
  MapPin,
  Loader2,
  Check,
  AlertCircle,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBusyToast } from "@/hooks/useBusyToast";
import { motion, AnimatePresence } from "framer-motion";

const ScheduleItemSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
  endTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
  location: z.string().optional(),
  roomId: z.string().nullable().optional(),
}).refine(
  (data) => {
    const [startHour, startMin] = data.startTime.split(":").map(Number);
    const [endHour, endMin] = data.endTime.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return endMinutes > startMinutes;
  },
  { message: "End time must be after start time", path: ["endTime"] }
);

const ScheduleFormSchema = z.object({
  contactHoursPerWeek: z.number().min(0).max(40),
  schedules: z.array(ScheduleItemSchema),
});

type ScheduleFormInput = z.infer<typeof ScheduleFormSchema>;
type ScheduleItem = z.infer<typeof ScheduleItemSchema>;

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
  initialSchedules?: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    location?: string;
    roomId?: string | null;
  }>;
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

function calculateHours(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  return (endMinutes - startMinutes) / 60;
}

export function AssignSubjectScheduleModal({
  open,
  onOpenChange,
  assignmentId,
  subjectName,
  teacherName,
  className,
  initialContactHours = 0,
  initialSchedules = [],
}: AssignSubjectScheduleModalProps) {
  const queryClient = useQueryClient();
  const busy = useBusyToast();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ScheduleFormInput>({
    resolver: zodResolver(ScheduleFormSchema),
    defaultValues: {
      contactHoursPerWeek: initialContactHours,
      schedules: initialSchedules.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        location: s.location || "",
        roomId: s.roomId || null,
      })),
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "schedules",
  });

  const schedules = watch("schedules");
  const contactHours = watch("contactHoursPerWeek");

  // Calculate total hours from schedules
  const calculatedHours = React.useMemo(() => {
    return schedules.reduce((sum, s) => {
      return sum + calculateHours(s.startTime, s.endTime);
    }, 0);
  }, [schedules]);

  // Store initial values in refs to avoid dependency issues
  const initialValuesRef = React.useRef({
    contactHoursPerWeek: initialContactHours,
    schedules: initialSchedules,
  });

  // Track previous assignmentId and open state to reset only when needed
  const prevAssignmentIdRef = React.useRef(assignmentId);
  const prevOpenRef = React.useRef(open);

  // Update refs when values change
  React.useEffect(() => {
    initialValuesRef.current = {
      contactHoursPerWeek: initialContactHours,
      schedules: initialSchedules,
    };
  }, [initialContactHours, initialSchedules]);

  // Reset form when modal opens or assignment changes (only once per open/change)
  React.useEffect(() => {
    const assignmentChanged = prevAssignmentIdRef.current !== assignmentId;
    const modalJustOpened = open && !prevOpenRef.current;

    // Only reset when modal transitions from closed to open, or when assignment changes
    if (open && (assignmentChanged || modalJustOpened)) {
      const currentValues = initialValuesRef.current;
      reset({
        contactHoursPerWeek: currentValues.contactHoursPerWeek,
        schedules: currentValues.schedules.map((s) => ({
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          location: s.location || "",
          roomId: s.roomId || null,
        })),
      });
    }

    // Update refs
    if (open) {
      prevAssignmentIdRef.current = assignmentId;
    }
    prevOpenRef.current = open;
  }, [open, assignmentId, reset]); // Only depend on open, assignmentId, and reset

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: ScheduleFormInput) => {
      const res = await fetch(`/api/admin/teacher-assignments/${assignmentId}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactHoursPerWeek: data.contactHoursPerWeek,
          schedules: data.schedules.map((s) => ({
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            location: s.location || undefined,
            roomId: s.roomId || undefined,
          })),
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update schedule");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["class-subject-teachers"] });
      busy.success("Schedule updated successfully");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      busy.error(error.message || "Failed to update schedule");
    },
  });

  const onSubmit = handleSubmit(async (data: ScheduleFormInput) => {
    await busy.promise(updateMutation.mutateAsync(data), {
      loading: "Updating schedule...",
      success: "Schedule updated successfully",
      error: (e: Error) => e.message || "Failed to update schedule",
    });
  });

  const handleAddSchedule = () => {
    append({
      dayOfWeek: 1, // Monday
      startTime: "08:00",
      endTime: "09:00",
      location: "",
      roomId: null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-emerald-200 via-green-200 to-teal-300 bg-clip-text text-transparent">
            Edit Schedule
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

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Contact Hours */}
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
                step="0.5"
                {...register("contactHoursPerWeek", { valueAsNumber: true })}
                className="w-32 bg-white/5 border-white/10 text-white"
              />
              <span className="text-sm text-white/60">hours</span>
              {calculatedHours > 0 && (
                <Badge variant="outline" className="text-xs">
                  Calculated: {calculatedHours.toFixed(1)}h from schedules
                </Badge>
              )}
            </div>
            {errors.contactHoursPerWeek && (
              <p className="text-xs text-rose-400">{errors.contactHoursPerWeek.message}</p>
            )}
          </div>

          {/* Schedule Slots */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-white">
                Weekly Schedule Slots
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddSchedule}
                className="gap-2 border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
              >
                <Plus className="h-4 w-4" />
                Add Slot
              </Button>
            </div>

            {fields.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/20 bg-white/5 p-8 text-center">
                <Calendar className="mx-auto h-12 w-12 text-white/20" />
                <p className="mt-4 text-sm text-white/60">No schedule slots added</p>
                <p className="mt-1 text-xs text-white/40">
                  Click "Add Slot" to add a weekly schedule slot
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {fields.map((field, index) => {
                    const scheduleErrors = errors.schedules?.[index];
                    const schedule = schedules[index];
                    const hours = schedule
                      ? calculateHours(schedule.startTime, schedule.endTime)
                      : 0;

                    return (
                      <motion.div
                        key={field.id}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="rounded-lg border border-white/10 bg-white/5 p-4"
                      >
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                          {/* Day of Week */}
                          <div className="space-y-1">
                            <Label className="text-xs text-white/60">Day</Label>
                            <select
                              {...register(`schedules.${index}.dayOfWeek`, {
                                valueAsNumber: true,
                              })}
                              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            >
                              {DAY_NAMES.map((day, dayIdx) => (
                                <option key={dayIdx} value={dayIdx}>
                                  {day}
                                </option>
                              ))}
                            </select>
                            {scheduleErrors?.dayOfWeek && (
                              <p className="text-xs text-rose-400">
                                {scheduleErrors.dayOfWeek.message}
                              </p>
                            )}
                          </div>

                          {/* Start Time */}
                          <div className="space-y-1">
                            <Label className="text-xs text-white/60">Start Time</Label>
                            <Input
                              type="time"
                              {...register(`schedules.${index}.startTime`)}
                              className="bg-white/5 border-white/10 text-white"
                            />
                            {scheduleErrors?.startTime && (
                              <p className="text-xs text-rose-400">
                                {scheduleErrors.startTime.message}
                              </p>
                            )}
                          </div>

                          {/* End Time */}
                          <div className="space-y-1">
                            <Label className="text-xs text-white/60">End Time</Label>
                            <Input
                              type="time"
                              {...register(`schedules.${index}.endTime`)}
                              className="bg-white/5 border-white/10 text-white"
                            />
                            {scheduleErrors?.endTime && (
                              <p className="text-xs text-rose-400">
                                {scheduleErrors.endTime.message}
                              </p>
                            )}
                          </div>

                          {/* Location */}
                          <div className="space-y-1">
                            <Label className="text-xs text-white/60">Location</Label>
                            <Input
                              type="text"
                              placeholder="Room/Location"
                              {...register(`schedules.${index}.location`)}
                              className="bg-white/5 border-white/10 text-white"
                            />
                          </div>

                          {/* Actions */}
                          <div className="flex items-end gap-2">
                            <div className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center">
                              <div className="text-xs text-white/60">Duration</div>
                              <div className="text-sm font-semibold text-emerald-400">
                                {hours.toFixed(1)}h
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => remove(index)}
                              className="h-9 w-9 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}

            {errors.schedules && typeof errors.schedules.message === "string" && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                <AlertCircle className="h-4 w-4" />
                {errors.schedules.message}
              </div>
            )}
          </div>

          {/* Weekly Timetable Preview */}
          {schedules.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-white">
                Weekly Timetable Preview
              </Label>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5].map((dayIndex) => {
                  const daySchedules = schedules.filter((s) => s.dayOfWeek === dayIndex);
                  if (daySchedules.length === 0) return null;

                  return (
                    <div
                      key={dayIndex}
                      className="rounded-lg border border-white/10 bg-white/5 p-3"
                    >
                      <div className="mb-2 font-semibold text-white text-sm">
                        {DAY_NAMES[dayIndex]}
                      </div>
                      <div className="space-y-1">
                        {daySchedules.map((s, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs"
                          >
                            <span className="text-white/80">
                              {formatTime(s.startTime)} - {formatTime(s.endTime)}
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              {calculateHours(s.startTime, s.endTime).toFixed(1)}h
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-emerald-500 to-green-500 text-white hover:from-emerald-600 hover:to-green-600"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Save Schedule
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
