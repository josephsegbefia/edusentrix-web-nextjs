// src/components/modals/PublishPollModal.tsx
"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Send, X, Calendar, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { usePublishPoll, useUpdatePoll, PollDetailDTO } from "@/hooks/admin/useCommunityPolls";
import { useBusyToast } from "@/hooks/useBusyToast";
import { toast } from "sonner";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";

interface PublishPollModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly poll: PollDetailDTO;
  readonly onSuccess?: () => void;
}

export default function PublishPollModal({
  open,
  onOpenChange,
  poll,
  onSuccess,
}: PublishPollModalProps) {
  const publishMutation = usePublishPoll();
  const updateMutation = useUpdatePoll();
  const busyToast = useBusyToast();

  const [scheduleNow, setScheduleNow] = React.useState(true);
  const [startDate, setStartDate] = React.useState<Date | undefined>(
    poll.schedule.startDate ? new Date(poll.schedule.startDate) : undefined
  );
  const [endDate, setEndDate] = React.useState<Date | undefined>(
    poll.schedule.endDate ? new Date(poll.schedule.endDate) : undefined
  );

  const handlePublish = async () => {
    busyToast.show("Publishing poll...");

    try {
      // If scheduling, update the poll first
      if (!scheduleNow && (startDate || endDate)) {
        await updateMutation.mutateAsync({
          pollId: poll.id,
          data: {
            schedule: {
              startDate: startDate?.toISOString() ?? null,
              endDate: endDate?.toISOString() ?? null,
            },
          },
        });
      }

      await publishMutation.mutateAsync(poll.id);
      toast.success("Poll published successfully");
      onOpenChange(false);
      onSuccess?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to publish poll");
    } finally {
      busyToast.hide();
    }
  };

  // Reset form when modal opens
  React.useEffect(() => {
    if (open) {
      setScheduleNow(true);
      setStartDate(poll.schedule.startDate ? new Date(poll.schedule.startDate) : undefined);
      setEndDate(poll.schedule.endDate ? new Date(poll.schedule.endDate) : undefined);
    }
  }, [open, poll.schedule.startDate, poll.schedule.endDate]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        onClick={() => onOpenChange(false)}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0f0f14] p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="mb-6 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10">
                <Send className="h-6 w-6 text-violet-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Publish Poll</h2>
                <p className="text-sm text-white/50">Go live</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="text-white/60 hover:text-white"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Poll Info */}
          <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="font-medium text-white">&ldquo;{poll.title}&rdquo;</p>
            <div className="mt-2 flex items-center gap-4 text-sm text-white/50">
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {poll.audience.scope}
              </span>
              <span>{poll.questions.length} question{poll.questions.length !== 1 ? "s" : ""}</span>
            </div>
          </div>

          {/* Schedule Options */}
          <div className="mb-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-white/50" />
                <Label className="text-white/70">Publish immediately</Label>
              </div>
              <Switch checked={scheduleNow} onCheckedChange={setScheduleNow} />
            </div>

            {!scheduleNow && (
              <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
                <div>
                  <Label className="text-sm text-white/70">Start Date (Optional)</Label>
                  <CustomDatePicker
                    value={startDate}
                    onChange={(date) => setStartDate(date ?? undefined)}
                    placeholder="Select start date"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm text-white/70">End Date (Optional)</Label>
                  <CustomDatePicker
                    value={endDate}
                    onChange={(date) => setEndDate(date ?? undefined)}
                    placeholder="Select end date"
                    minDate={startDate}
                    className="mt-1"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Warning */}
          <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <p className="text-sm text-amber-200/80">
              Once published, the poll will be visible to the target audience and they can start voting.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-white/10 text-white/60"
            >
              Cancel
            </Button>
            <Button
              onClick={handlePublish}
              disabled={publishMutation.isPending || updateMutation.isPending}
              className="gap-2 bg-violet-600 text-white hover:bg-violet-700"
            >
              <Send className="h-4 w-4" />
              Publish Poll
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
