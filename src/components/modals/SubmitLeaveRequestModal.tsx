// src/components/modals/SubmitLeaveRequestModal.tsx
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
  useSubmitLeaveRequest,
  type SubmitLeaveRequestInput,
  type LeaveType,
} from "@/hooks/admin/useTeacherAttendance";
import { premiumSelectContent, premiumMenuItem } from "@/components/ui/premium";

const SubmitLeaveRequestSchema = z.object({
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  leaveType: z.enum(["sick", "vacation", "personal", "professional", "other"]),
  reason: z.string().min(1, "Reason is required").max(500),
  notes: z.string().max(1000).optional().nullable(),
}).refine((data) => {
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  return end >= start;
}, {
  message: "End date must be after or equal to start date",
  path: ["endDate"],
});

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherId: string;
  teacherName: string;
};

export function SubmitLeaveRequestModal({
  open,
  onOpenChange,
  teacherId,
  teacherName,
}: Props) {
  const submitLeaveRequestMutation = useSubmitLeaveRequest();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SubmitLeaveRequestInput>({
    resolver: zodResolver(SubmitLeaveRequestSchema),
    defaultValues: {
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date().toISOString().split("T")[0],
      leaveType: "personal",
      reason: "",
      notes: null,
    },
  });

  const startDate = watch("startDate");
  const endDate = watch("endDate");

  // Calculate number of days
  const daysCount = React.useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) return 0;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
    return diffDays;
  }, [startDate, endDate]);

  // Reset form when modal opens
  React.useEffect(() => {
    if (open) {
      reset({
        startDate: new Date().toISOString().split("T")[0],
        endDate: new Date().toISOString().split("T")[0],
        leaveType: "personal",
        reason: "",
        notes: null,
      });
    }
  }, [open, reset]);

  const onSubmit = async (data: SubmitLeaveRequestInput) => {
    try {
      await submitLeaveRequestMutation.mutateAsync({
        teacherId,
        payload: data,
      });

      toast.success(`Leave request submitted for ${daysCount} day(s)`);
      onOpenChange(false);
    } catch (e: unknown) {
      const error = e as { message?: string };
      if (error.message?.includes("already exist")) {
        toast.error("Some dates already have attendance records. Please check and try again.");
      } else {
        toast.error(error.message || "Failed to submit leave request");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] border border-white/10 bg-linear-to-br from-white/10 to-transparent shadow-2xl shadow-black/30 backdrop-blur">
        <DialogHeader>
          <DialogTitle className="text-xl">Submit Leave Request</DialogTitle>
          <DialogDescription className="text-sm">
            Submit a leave request for <span className="font-medium text-white/90">{teacherName}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate" className="text-sm">
                Start Date *
              </Label>
              <Input
                id="startDate"
                type="date"
                {...register("startDate")}
                className="border-white/10 bg-white/5"
              />
              {errors.startDate && (
                <p className="text-xs text-red-300/80">{errors.startDate.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate" className="text-sm">
                End Date *
              </Label>
              <Input
                id="endDate"
                type="date"
                {...register("endDate")}
                className="border-white/10 bg-white/5"
              />
              {errors.endDate && (
                <p className="text-xs text-red-300/80">{errors.endDate.message}</p>
              )}
            </div>
          </div>

          {daysCount > 0 && (
            <div className="rounded-lg border border-sky-400/20 bg-sky-500/10 p-3">
              <p className="text-sm text-sky-100">
                <span className="font-medium">Duration:</span> {daysCount} day{daysCount !== 1 ? "s" : ""}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="leaveType" className="text-sm">
              Leave Type *
            </Label>
            <Select
              value={watch("leaveType")}
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
                  Professional Development
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

          <div className="space-y-2">
            <Label htmlFor="reason" className="text-sm">
              Reason *
            </Label>
            <Textarea
              id="reason"
              {...register("reason")}
              placeholder="Enter reason for leave request..."
              className="min-h-[100px] border-white/10 bg-white/5"
              maxLength={500}
            />
            {errors.reason && (
              <p className="text-xs text-red-300/80">{errors.reason.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm">
              Additional Notes (optional)
            </Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder="Any additional information..."
              className="min-h-[80px] border-white/10 bg-white/5"
              maxLength={1000}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || submitLeaveRequestMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || submitLeaveRequestMutation.isPending}
              className="gap-2"
            >
              {isSubmitting || submitLeaveRequestMutation.isPending
                ? "Submitting…"
                : `Submit Leave Request${daysCount > 0 ? ` (${daysCount} day${daysCount !== 1 ? "s" : ""})` : ""}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
