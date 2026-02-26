// src/components/modals/RecordAttendanceModal.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import {
  useRecordAttendance,
  type RecordAttendanceInput,
  type TeacherAttendanceStatus,
  type LeaveType,
} from "@/hooks/admin/useTeacherAttendance";
import { premiumSelectContent, premiumMenuItem } from "@/components/ui/premium";

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInput(value?: string | null): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const RecordAttendanceSchema = z.object({
  date: z.string().min(1, "Date is required"),
  status: z.enum(["present", "absent", "late", "on_leave", "sick", "other"]),
  checkInTime: z.string().optional().nullable(),
  checkOutTime: z.string().optional().nullable(),
  minutesLate: z.number().min(0).optional().nullable(),
  leaveType: z.enum(["sick", "vacation", "personal", "professional", "other"]).optional().nullable(),
  reason: z.string().max(500).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
}).refine((data) => {
  // If status is on_leave or sick, leaveType should be provided
  if ((data.status === "on_leave" || data.status === "sick") && !data.leaveType) {
    return false;
  }
  return true;
}, {
  message: "Leave type is required for leave or sick status",
  path: ["leaveType"],
});

type AttendanceFormValues = z.infer<typeof RecordAttendanceSchema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherId: string;
  teacherName: string;
  defaultDate?: string; // YYYY-MM-DD format
};

export function RecordAttendanceModal({
  open,
  onOpenChange,
  teacherId,
  teacherName,
  defaultDate,
}: Props) {
  const recordAttendanceMutation = useRecordAttendance();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AttendanceFormValues>({
    resolver: zodResolver(RecordAttendanceSchema),
    defaultValues: {
      date: defaultDate || formatDateInput(new Date()),
      status: "present",
      checkInTime: undefined,
      checkOutTime: undefined,
      minutesLate: undefined,
      leaveType: undefined,
      reason: undefined,
      notes: undefined,
    },
  });

  const status = watch("status");
  const isLeaveOrSick = status === "on_leave" || status === "sick";
  const isLate = status === "late";
  const selectedDate = parseDateInput(watch("date"));

  // Reset form when modal opens
  React.useEffect(() => {
    if (open) {
      reset({
        date: defaultDate || formatDateInput(new Date()),
        status: "present",
        checkInTime: undefined,
        checkOutTime: undefined,
        minutesLate: undefined,
        leaveType: undefined,
        reason: undefined,
        notes: undefined,
      });
    }
  }, [open, defaultDate, reset]);

  const onSubmit = async (data: AttendanceFormValues) => {
    try {
      const payload: RecordAttendanceInput = {
        date: data.date,
        status: data.status as TeacherAttendanceStatus,
        checkInTime: data.checkInTime || null,
        checkOutTime: data.checkOutTime || null,
        minutesLate: data.minutesLate ?? null,
        leaveType: isLeaveOrSick ? (data.leaveType as LeaveType || null) : null,
        reason: data.reason || null,
        notes: data.notes || null,
      };

      await recordAttendanceMutation.mutateAsync({
        teacherId,
        payload,
      });

      toast.success("Attendance recorded successfully");
      onOpenChange(false);
    } catch (e: unknown) {
      const error = e as { message?: string };
      toast.error(error.message || "Failed to record attendance");
    }
  };

  const isPending = recordAttendanceMutation.isPending || isSubmitting;

  React.useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onOpenChange(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, isPending, onOpenChange]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        aria-modal="true"
        role="dialog"
      >
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !isPending) onOpenChange(false);
          }}
        />

        <div className="relative z-10 flex min-h-full items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-[860px] overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 text-white shadow-2xl shadow-black/40"
          >
            <div className="px-6 pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h1 className="text-lg font-semibold">Record Attendance</h1>
                  <p className="text-sm text-white/60">
                    Record attendance for{" "}
                    <span className="font-medium text-white/85">
                      {teacherName}
                    </span>
                    .
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={isPending}
                  className="h-9 w-9 rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-5 h-px bg-white/10" />
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
              <div className="space-y-6">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <CustomDatePicker
                        value={selectedDate}
                        onChange={(date) =>
                          setValue("date", date ? formatDateInput(date) : "", {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
                        label="Date *"
                        placeholder="Select attendance date"
                        error={errors.date?.message}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="status"
                        className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                      >
                        Status *
                      </Label>
                      <Select
                        value={status}
                        onValueChange={(value) =>
                          setValue("status", value as TeacherAttendanceStatus)
                        }
                      >
                        <SelectTrigger className="border border-white/10 bg-white/5 text-white hover:bg-white/10 focus:ring-1 focus:ring-brand">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent className={premiumSelectContent}>
                          <SelectItem value="present" className={premiumMenuItem}>
                            Present
                          </SelectItem>
                          <SelectItem value="absent" className={premiumMenuItem}>
                            Absent
                          </SelectItem>
                          <SelectItem value="late" className={premiumMenuItem}>
                            Late
                          </SelectItem>
                          <SelectItem value="on_leave" className={premiumMenuItem}>
                            On Leave
                          </SelectItem>
                          <SelectItem value="sick" className={premiumMenuItem}>
                            Sick
                          </SelectItem>
                          <SelectItem value="other" className={premiumMenuItem}>
                            Other
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.status && (
                        <p className="text-xs text-red-300/80">
                          {errors.status.message}
                        </p>
                      )}
                    </div>
                  </div>

                  {isLate && (
                    <div className="space-y-2">
                      <Label
                        htmlFor="minutesLate"
                        className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                      >
                        Minutes Late
                      </Label>
                      <Input
                        id="minutesLate"
                        type="number"
                        min={0}
                        {...register("minutesLate")}
                        placeholder="e.g., 15"
                        className="border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                      />
                      {errors.minutesLate && (
                        <p className="text-xs text-red-300/80">
                          {errors.minutesLate.message}
                        </p>
                      )}
                    </div>
                  )}

                  {isLeaveOrSick && (
                    <div className="space-y-2">
                      <Label
                        htmlFor="leaveType"
                        className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                      >
                        Leave Type *
                      </Label>
                      <Select
                        value={watch("leaveType") || ""}
                        onValueChange={(value) =>
                          setValue("leaveType", value as LeaveType)
                        }
                      >
                        <SelectTrigger className="border border-white/10 bg-white/5 text-white hover:bg-white/10 focus:ring-1 focus:ring-brand">
                          <SelectValue placeholder="Select leave type" />
                        </SelectTrigger>
                        <SelectContent className={premiumSelectContent}>
                          <SelectItem value="sick" className={premiumMenuItem}>
                            Sick Leave
                          </SelectItem>
                          <SelectItem value="vacation" className={premiumMenuItem}>
                            Vacation
                          </SelectItem>
                          <SelectItem value="personal" className={premiumMenuItem}>
                            Personal
                          </SelectItem>
                          <SelectItem
                            value="professional"
                            className={premiumMenuItem}
                          >
                            Professional
                          </SelectItem>
                          <SelectItem value="other" className={premiumMenuItem}>
                            Other
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.leaveType && (
                        <p className="text-xs text-red-300/80">
                          {errors.leaveType.message}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label
                        htmlFor="checkInTime"
                        className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                      >
                        Check In Time
                      </Label>
                      <Input
                        id="checkInTime"
                        type="time"
                        {...register("checkInTime")}
                        className="border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="checkOutTime"
                        className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                      >
                        Check Out Time
                      </Label>
                      <Input
                        id="checkOutTime"
                        type="time"
                        {...register("checkOutTime")}
                        className="border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                      />
                    </div>
                  </div>

                  {(isLeaveOrSick || status === "absent") && (
                    <div className="space-y-2">
                      <Label
                        htmlFor="reason"
                        className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                      >
                        Reason
                      </Label>
                      <Textarea
                        id="reason"
                        {...register("reason")}
                        placeholder="Enter reason for leave/absence..."
                        className="min-h-[80px] border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                        maxLength={500}
                      />
                      {errors.reason && (
                        <p className="text-xs text-red-300/80">
                          {errors.reason.message}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label
                      htmlFor="notes"
                      className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                    >
                      Notes (optional)
                    </Label>
                    <Textarea
                      id="notes"
                      {...register("notes")}
                      placeholder="Additional notes..."
                      className="min-h-[80px] border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                      maxLength={1000}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                      disabled={isPending}
                      className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isPending}
                      className="gap-2 bg-brand text-black hover:opacity-90"
                    >
                      {isPending ? "Recording…" : "Record Attendance"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
