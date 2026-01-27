// src/components/modals/ClosePollModal.tsx
"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lock, X, Users, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClosePoll, PollDetailDTO } from "@/hooks/admin/useCommunityPolls";
import { useBusyToast } from "@/hooks/useBusyToast";
import { toast } from "sonner";

interface ClosePollModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly poll: PollDetailDTO;
  readonly onSuccess?: () => void;
}

export default function ClosePollModal({
  open,
  onOpenChange,
  poll,
  onSuccess,
}: ClosePollModalProps) {
  const closeMutation = useClosePoll();
  const busyToast = useBusyToast();

  const handleClose = async () => {
    busyToast.show("Closing poll...");

    try {
      await closeMutation.mutateAsync(poll.id);
      toast.success("Poll closed successfully");
      onOpenChange(false);
      onSuccess?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to close poll");
    } finally {
      busyToast.hide();
    }
  };

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
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10">
                <Lock className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Close Poll</h2>
                <p className="text-sm text-white/50">Stop voting</p>
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
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-sm text-white/50">
                <Users className="h-4 w-4" />
                <span>{poll.totalVotes} votes</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-white/50">
                <BarChart3 className="h-4 w-4" />
                <span>{poll.participationRate}% participation</span>
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <p className="text-sm text-amber-200/80">
              Closing this poll will permanently stop all voting. This action cannot be undone.
              {poll.revealResults === "after_close" && (
                <span className="mt-2 block text-white/60">
                  Results will become visible to participants after closing.
                </span>
              )}
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
              onClick={handleClose}
              disabled={closeMutation.isPending}
              className="gap-2 bg-amber-600 text-white hover:bg-amber-700"
            >
              <Lock className="h-4 w-4" />
              Close Poll
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
