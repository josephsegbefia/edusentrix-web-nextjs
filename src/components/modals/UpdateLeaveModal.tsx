"use client";

import * as React from "react";
import { Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { cn } from "@/lib/utils";

type UpdateLeaveModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherName: string;
  initialStartDate: string | null;
  initialEndDate: string | null;
  initialReason: string | null;
  onSubmit: (payload: { startDate: string; endDate: string; reason?: string }) => Promise<void>;
  isPending?: boolean;
  /** When true, allows start date to be in the past (for updating existing leave) */
  allowPastStart?: boolean;
};

function toDateInputValue(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function UpdateLeaveModal({
  open,
  onOpenChange,
  teacherName,
  initialStartDate,
  initialEndDate,
  initialReason,
  onSubmit,
  isPending,
  allowPastStart = true,
}: UpdateLeaveModalProps) {
  const [startDate, setStartDate] = React.useState<Date | null>(() =>
    initialStartDate ? new Date(initialStartDate) : new Date()
  );
  const [endDate, setEndDate] = React.useState<Date | null>(() =>
    initialEndDate ? new Date(initialEndDate) : null
  );
  const [reason, setReason] = React.useState(initialReason || "");

  React.useEffect(() => {
    if (open) {
      setStartDate(initialStartDate ? new Date(initialStartDate) : new Date());
      setEndDate(initialEndDate ? new Date(initialEndDate) : null);
      setReason(initialReason || "");
    }
  }, [open, initialStartDate, initialEndDate, initialReason]);

  const isValid =
    startDate != null &&
    endDate != null &&
    endDate >= startDate;

  const durationDays = React.useMemo(() => {
    if (!startDate || !endDate || endDate < startDate) return 0;
    const diff = endDate.getTime() - startDate.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  }, [startDate, endDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !startDate || !endDate) return;
    try {
      await onSubmit({
        startDate: toDateInputValue(startDate),
        endDate: toDateInputValue(endDate),
        reason: reason.trim() || undefined,
      });
      onOpenChange(false);
    } catch {
      // Error handled by caller
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-leave-title"
        className="relative z-50 w-full max-w-md rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-black p-6 shadow-2xl"
      >
        <div className="space-y-5">
          <div>
            <h2 id="update-leave-title" className="text-lg font-semibold text-white">
              Update Leave Dates
            </h2>
            <p className="mt-1 text-sm text-white/60">
              Configure leave period for {teacherName}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent p-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-amber-200/80">
                  Leave Period
                </p>
                {isValid && durationDays > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-200">
                    {durationDays} day{durationDays !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-xs font-medium text-white/60">
                    <Calendar className="h-3.5 w-3.5" />
                    Start date
                  </label>
                  <CustomDatePicker
                    value={startDate}
                    onChange={(date) => {
                      setStartDate(date);
                      if (date && endDate && endDate < date) setEndDate(null);
                    }}
                    minDate={allowPastStart ? undefined : new Date()}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-xs font-medium text-white/60">
                    <Calendar className="h-3.5 w-3.5" />
                    End date
                  </label>
                  <CustomDatePicker
                    value={endDate}
                    onChange={(date) => setEndDate(date)}
                    minDate={startDate || new Date()}
                  />
                </div>
              </div>

              {isValid && durationDays > 0 && (
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-500/10 bg-amber-500/5 px-3 py-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20">
                    <span className="text-sm font-bold text-amber-200">{durationDays}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/70">
                      {startDate!.toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                      {" → "}
                      {endDate!.toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <Clock className="h-4 w-4 shrink-0 text-amber-200/40" />
                </div>
              )}

              <div className="mt-4 space-y-1.5">
                <label className="text-xs font-medium text-white/60">
                  Reason <span className="text-white/30">(optional)</span>
                </label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Medical leave, Personal leave..."
                  className="min-h-[72px] rounded-xl border-white/15 bg-white/5 text-white placeholder:text-white/40"
                  maxLength={500}
                />
                {reason.length > 0 && (
                  <p className="text-right text-[10px] text-white/30">{reason.length}/500</p>
                )}
              </div>

              {!isValid && startDate && endDate && (
                <p className="mt-3 text-xs text-red-300/80">
                  End date must be on or after the start date.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!isValid || isPending}
                className={cn(
                  "bg-amber-500/20 text-amber-200 hover:bg-amber-500/30",
                  !isValid && "opacity-50"
                )}
              >
                {isPending ? "Updating..." : "Update Leave"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
