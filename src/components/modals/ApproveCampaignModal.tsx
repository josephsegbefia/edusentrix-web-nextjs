// src/components/modals/ApproveCampaignModal.tsx
"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, X, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApproveCampaign, CampaignDetailDTO } from "@/hooks/admin/useFundraisingCampaigns";
import { useBusyToast } from "@/hooks/useBusyToast";
import { toast } from "sonner";
import { formatMoney } from "@/lib/fees/money";

interface ApproveCampaignModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly campaign: CampaignDetailDTO;
  readonly onSuccess?: () => void;
}

export default function ApproveCampaignModal({
  open,
  onOpenChange,
  campaign,
  onSuccess,
}: ApproveCampaignModalProps) {
  const approveMutation = useApproveCampaign();
  const busyToast = useBusyToast();

  const handleApprove = async () => {
    busyToast.show("Approving campaign...");

    try {
      await approveMutation.mutateAsync(campaign.id);
      toast.success("Campaign approved successfully");
      onOpenChange(false);
      onSuccess?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to approve campaign");
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
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10">
                <CheckCircle className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Approve Campaign</h2>
                <p className="text-sm text-white/50">Confirm approval</p>
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
            <div className="mt-3 flex items-center gap-4 text-sm text-white/50">
              <span className="flex items-center gap-1">
                <Target className="h-4 w-4" />
                Goal: {formatMoney(campaign.goalAmountMinor, campaign.currency)}
              </span>
              <span className="capitalize">{campaign.category.replaceAll("_", " ")}</span>
            </div>
          </div>

          {/* Info */}
          <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="text-sm text-emerald-200/80">
              Once approved, this campaign can be published and will be visible to the target audience for donations.
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
              onClick={handleApprove}
              disabled={approveMutation.isPending}
              className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <CheckCircle className="h-4 w-4" />
              Approve Campaign
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
