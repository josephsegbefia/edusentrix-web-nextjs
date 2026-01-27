// src/components/modals/RejectCampaignModal.tsx
"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { XCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRejectCampaign } from "@/hooks/admin/useFundraisingCampaigns";
import { useBusyToast } from "@/hooks/useBusyToast";
import { toast } from "sonner";

interface RejectCampaignModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly campaignId: string;
  readonly campaignTitle: string;
  readonly onSuccess?: () => void;
}

export default function RejectCampaignModal({
  open,
  onOpenChange,
  campaignId,
  campaignTitle,
  onSuccess,
}: RejectCampaignModalProps) {
  const rejectMutation = useRejectCampaign();
  const busyToast = useBusyToast();
  const [reason, setReason] = React.useState("");

  const handleReject = async () => {
    if (!reason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    busyToast.show("Rejecting campaign...");

    try {
      await rejectMutation.mutateAsync({ campaignId, reason: reason.trim() });
      toast.success("Campaign rejected");
      setReason("");
      onOpenChange(false);
      onSuccess?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reject campaign");
    } finally {
      busyToast.hide();
    }
  };

  // Reset form when modal closes
  React.useEffect(() => {
    if (!open) {
      setReason("");
    }
  }, [open]);

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
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10">
                <XCircle className="h-6 w-6 text-rose-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Reject Campaign</h2>
                <p className="text-sm text-white/50">Provide feedback</p>
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
            <p className="text-sm text-white/70">Rejecting campaign:</p>
            <p className="mt-1 font-medium text-white">&ldquo;{campaignTitle}&rdquo;</p>
          </div>

          {/* Reason Input */}
          <div className="mb-6">
            <Label className="text-white">Reason for Rejection *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this campaign is being rejected..."
              className="mt-2 min-h-[100px] border-white/10 bg-white/5 text-white"
            />
            <p className="mt-2 text-xs text-white/40">
              This feedback will be shared with the campaign creator.
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
              onClick={handleReject}
              disabled={rejectMutation.isPending || !reason.trim()}
              className="gap-2 bg-rose-600 text-white hover:bg-rose-700"
            >
              <XCircle className="h-4 w-4" />
              Reject Campaign
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
