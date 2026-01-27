// src/components/modals/CloseCampaignModal.tsx
"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lock, X, Target, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCloseCampaign, CampaignDetailDTO } from "@/hooks/admin/useFundraisingCampaigns";
import { useBusyToast } from "@/hooks/useBusyToast";
import { toast } from "sonner";
import { formatMoney } from "@/lib/fees/money";

interface CloseCampaignModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly campaign: CampaignDetailDTO;
  readonly onSuccess?: () => void;
}

export default function CloseCampaignModal({
  open,
  onOpenChange,
  campaign,
  onSuccess,
}: CloseCampaignModalProps) {
  const closeMutation = useCloseCampaign();
  const busyToast = useBusyToast();

  const progressPercent = campaign.goalAmountMinor > 0
    ? Math.round((campaign.raisedAmountMinor / campaign.goalAmountMinor) * 100)
    : 0;

  const handleClose = async () => {
    busyToast.show("Closing campaign...");

    try {
      await closeMutation.mutateAsync(campaign.id);
      toast.success("Campaign closed successfully");
      onOpenChange(false);
      onSuccess?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to close campaign");
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
                <h2 className="text-lg font-bold text-white">Close Campaign</h2>
                <p className="text-sm text-white/50">Stop donations</p>
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

          {/* Campaign Info */}
          <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="font-medium text-white">&ldquo;{campaign.title}&rdquo;</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-sm text-white/50">
                <Target className="h-4 w-4" />
                <span>{formatMoney(campaign.raisedAmountMinor, campaign.currency)} raised</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-white/50">
                <Users className="h-4 w-4" />
                <span>{campaign.donorCount} donor{campaign.donorCount !== 1 ? "s" : ""}</span>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-white/50">
                <span>Progress</span>
                <span className="font-medium text-emerald-400">{progressPercent}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.min(progressPercent, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <p className="text-sm text-amber-200/80">
              Closing this campaign will permanently stop all donations. This action cannot be undone.
            </p>
            {progressPercent < 100 && (
              <p className="mt-2 text-xs text-white/50">
                Note: The goal has not been fully reached yet.
              </p>
            )}
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
              Close Campaign
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
