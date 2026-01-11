// src/components/modals/RecordAttendanceModal.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  useRecordAttendance,
  type RecordAttendanceInput,
  type TeacherAttendanceStatus,
  type LeaveType,
} from "@/hooks/admin/useTeacherAttendance";
import { premiumSelectContent, premiumMenuItem } from "@/components/ui/premium";

const RecordAttendanceSchema = z.object({
  date: z.string().min(1, "Date is required"),
  status: z.enum(["present", "absent", "late", "on_leave", "sick", "other"]),
  checkInTime: z.string().optional().nullable(),
  checkOutTime: z.string().optional().nullable(),
  minutesLate: z.coerce.number().min(0).optional().nullable(),
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
  } = useForm<RecordAttendanceInput & { date: string; minutesLate?: string }>({
    resolver: zodResolver(RecordAttendanceSchema),
    defaultValues: {
      date: defaultDate || new Date().toISOString().split("T")[0],
      status: "present",
      checkInTime: null,
      checkOutTime: null,
      minutesLate: null,
      leaveType: null,
      reason: null,
      notes: null,
    },
  });

  const status = watch("status");
  const isLeaveOrSick = status === "on_leave" || status === "sick";
  const isLate = status === "late";

  // Reset form when modal opens
  React.useEffect(() => {
    if (open) {
      reset({
        date: defaultDate || new Date().toISOString().split("T")[0],
        status: "present",
        checkInTime: null,
        checkOutTime: null,
        minutesLate: null,
        leaveType: null,
        reason: null,
        notes: null,
      });
    }
  }, [open, defaultDate, reset]);

  const onSubmit = async (data: RecordAttendanceInput & { date: string; minutesLate?: string }) => {
    try {
      const payload: RecordAttendanceInput = {
        date: data.date,
        status: data.status,
        checkInTime: data.checkInTime || null,
        checkOutTime: data.checkOutTime || null,
        minutesLate: data.minutesLate ? parseInt(data.minutesLate, 10) : null,
        leaveType: isLeaveOrSick ? (data.leaveType || null) : null,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] border border-white/10 bg-linear-to-br from-white/10 to-transparent shadow-2xl shadow-black/30 backdrop-blur">
        <DialogHeader>
          <DialogTitle className="text-xl">Record Attendance</DialogTitle>
          <DialogDescription className="text-sm">
            Record attendance for <span className="font-medium text-white/90">{teacherName}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date" className="text-sm">
                Date *
              </Label>
              <Input
                id="date"
                type="date"
                {...register("date")}
                className="border-white/10 bg-white/5"
              />
              {errors.date && (
                <p className="text-xs text-red-300/80">{errors.date.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="status" className="text-sm">
                Status *
              </Label>
              <Select
                value={status}
                onValueChange={(value) => setValue("status", value as TeacherAttendanceStatus)}
              >
                <SelectTrigger className="border-white/10 bg-white/5">
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
                <p className="text-xs text-red-300/80">{errors.status.message}</p>
              )}
            </div>
          </div>

          {isLate && (
            <div className="space-y-2">
              <Label htmlFor="minutesLate" className="text-sm">
                Minutes Late
              </Label>
              <Input
                id="minutesLate"
                type="number"
                min={0}
                {...register("minutesLate")}
                placeholder="e.g., 15"
                className="border-white/10 bg-white/5"
              />
              {errors.minutesLate && (
                <p className="text-xs text-red-300/80">{errors.minutesLate.message}</p>
              )}
            </div>
          )}

          {isLeaveOrSick && (
            <div className="space-y-2">
              <Label htmlFor="leaveType" className="text-sm">
                Leave Type *
              </Label>
              <Select
                value={watch("leaveType") || ""}
                onValueChange={(value) => setValue("leaveType", value as LeaveType)}
              >
                <SelectTrigger className="border-white/10 bg-white/5">
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
                  <SelectItem value="professional" className={premiumMenuItem}>
                    Professional
                  </SelectItem>
                  <SelectItem value="other" className={premiumMenuItem}>
                    Other
                  </SelectItem>
                </SelectContent>
              </Select>
              {errors.leaveType && (
                <p className="text-xs text-red-300/80">{errors.leaveType.message}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="checkInTime" className="text-sm">
                Check In Time
              </Label>
              <Input
                id="checkInTime"
                type="time"
                {...register("checkInTime")}
                className="border-white/10 bg-white/5"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="checkOutTime" className="text-sm">
                Check Out Time
              </Label>
              <Input
                id="checkOutTime"
                type="time"
                {...register("checkOutTime")}
                className="border-white/10 bg-white/5"
              />
            </div>
          </div>

          {(isLeaveOrSick || status === "absent") && (
            <div className="space-y-2">
              <Label htmlFor="reason" className="text-sm">
                Reason
              </Label>
              <Textarea
                id="reason"
                {...register("reason")}
                placeholder="Enter reason for leave/absence..."
                className="min-h-[80px] border-white/10 bg-white/5"
                maxLength={500}
              />
              {errors.reason && (
                <p className="text-xs text-red-300/80">{errors.reason.message}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm">
              Notes (optional)
            </Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder="Additional notes..."
              className="min-h-[80px] border-white/10 bg-white/5"
              maxLength={1000}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || recordAttendanceMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || recordAttendanceMutation.isPending}
              className="gap-2"
            >
              {isSubmitting || recordAttendanceMutation.isPending
                ? "Recording…"
                : "Record Attendance"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
