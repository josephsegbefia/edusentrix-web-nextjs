// src/components/modals/SubmitLeaveRequestModal.tsx
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

  const isPending = submitLeaveRequestMutation.isPending || isSubmitting;

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
                  <h1 className="text-lg font-semibold">Submit Leave Request</h1>
                  <p className="text-sm text-white/60">
                    Submit a leave request for{" "}
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
                      <Label
                        htmlFor="startDate"
                        className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                      >
                        Start Date *
                      </Label>
                      <Input
                        id="startDate"
                        type="date"
                        {...register("startDate")}
                        className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                      />
                      {errors.startDate && (
                        <p className="text-xs text-red-300/80">
                          {errors.startDate.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="endDate"
                        className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                      >
                        End Date *
                      </Label>
                      <Input
                        id="endDate"
                        type="date"
                        {...register("endDate")}
                        className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                      />
                      {errors.endDate && (
                        <p className="text-xs text-red-300/80">
                          {errors.endDate.message}
                        </p>
                      )}
                    </div>
                  </div>

                  {daysCount > 0 && (
                    <div className="rounded-lg border border-sky-400/20 bg-sky-500/10 p-3">
                      <p className="text-sm text-sky-100">
                        <span className="font-medium">Duration:</span>{" "}
                        {daysCount} day{daysCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label
                      htmlFor="leaveType"
                      className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                    >
                      Leave Type *
                    </Label>
                    <Select
                      value={watch("leaveType")}
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
                          Professional Development
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

                  <div className="space-y-2">
                    <Label
                      htmlFor="reason"
                      className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                    >
                      Reason *
                    </Label>
                    <Textarea
                      id="reason"
                      {...register("reason")}
                      placeholder="Enter reason for leave request..."
                      className="min-h-[100px] border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                      maxLength={500}
                    />
                    {errors.reason && (
                      <p className="text-xs text-red-300/80">
                        {errors.reason.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="notes"
                      className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                    >
                      Additional Notes (optional)
                    </Label>
                    <Textarea
                      id="notes"
                      {...register("notes")}
                      placeholder="Any additional information..."
                      className="min-h-[80px] border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
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
                      {isPending
                        ? "Submitting…"
                        : `Submit Leave Request${
                            daysCount > 0
                              ? ` (${daysCount} day${
                                  daysCount !== 1 ? "s" : ""
                                })`
                              : ""
                          }`}
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
