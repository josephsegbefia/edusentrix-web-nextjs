// src/components/modals/ShareCampaignModal.tsx
"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  QrCode,
  RefreshCw,
  Share2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  useCampaignShareSettings,
  useEnableCampaignShare,
  useDisableCampaignShare,
  CampaignDetailDTO,
} from "@/hooks/admin/useFundraisingCampaigns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ============================================================================
// QR Code Generator (inline SVG-based)
// ============================================================================

function generateQRCodeSVG(text: string, size: number = 200): string {
  // Simple QR code generation using a basic encoding
  // For production, use a library like qrcode
  // This is a placeholder that returns a styled box with instructions
  const encoded = encodeURIComponent(text);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&bgcolor=1e293b&color=ffffff&format=svg`;
}

// ============================================================================
// Component
// ============================================================================

interface ShareCampaignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: CampaignDetailDTO | null;
}

export function ShareCampaignModal({
  open,
  onOpenChange,
  campaign,
}: ShareCampaignModalProps) {
  const [copied, setCopied] = React.useState(false);
  const [showQR, setShowQR] = React.useState(false);

  const { data: shareSettings, isLoading, refetch } = useCampaignShareSettings(
    campaign?.id
  );
  const enableShareMutation = useEnableCampaignShare();
  const disableShareMutation = useDisableCampaignShare();

  const handleEnableShare = async () => {
    if (!campaign) return;
    try {
      await enableShareMutation.mutateAsync({ campaignId: campaign.id });
      toast.success("Public sharing enabled");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to enable sharing");
    }
  };

  const handleRegenerateLink = async () => {
    if (!campaign) return;
    try {
      await enableShareMutation.mutateAsync({
        campaignId: campaign.id,
        regenerate: true,
      });
      toast.success("Share link regenerated");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to regenerate link");
    }
  };

  const handleDisableShare = async () => {
    if (!campaign) return;
    try {
      await disableShareMutation.mutateAsync(campaign.id);
      toast.success("Public sharing disabled");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to disable sharing");
    }
  };

  const handleCopyLink = async () => {
    if (!shareSettings?.shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareSettings.shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleOpenLink = () => {
    if (!shareSettings?.shareUrl) return;
    window.open(shareSettings.shareUrl, "_blank");
  };

  if (!campaign) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900 via-slate-950 to-black p-0 shadow-2xl sm:max-w-lg">
        {/* Ambient gradient */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />

        {/* Header */}
        <DialogHeader className="relative z-10 border-b border-white/5 p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-blue-500/20 to-cyan-500/20">
              <Share2 className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <DialogTitle className="text-xl text-white">Share Campaign</DialogTitle>
              <DialogDescription className="mt-1 text-white/50">
                Share a public donation link
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="relative z-10 space-y-6 p-6">
          {/* Campaign Info */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="font-medium text-white">{campaign.title}</p>
            <p className="mt-1 text-sm text-white/50">
              {campaign.status === "live" ? "Accepting donations" : `Status: ${campaign.status}`}
            </p>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
            </div>
          )}

          {/* Sharing Not Enabled */}
          {!isLoading && !shareSettings?.enabled && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-white/20 p-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-blue-500/10 to-cyan-500/10">
                  <Globe className="h-8 w-8 text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Public Sharing Disabled</p>
                  <p className="mt-1 text-sm text-white/50">
                    Enable public sharing to allow anyone to donate via a link or QR code
                  </p>
                </div>
              </div>

              {campaign.status !== "live" && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
                  Only live campaigns can be shared publicly. Please publish this campaign first.
                </div>
              )}

              <Button
                onClick={handleEnableShare}
                disabled={campaign.status !== "live" || enableShareMutation.isPending}
                className="w-full gap-2 bg-linear-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-500 hover:to-cyan-500"
              >
                {enableShareMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enabling...
                  </>
                ) : (
                  <>
                    <Globe className="h-4 w-4" />
                    Enable Public Sharing
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Sharing Enabled */}
          {!isLoading && shareSettings?.enabled && shareSettings?.shareUrl && (
            <div className="space-y-5">
              {/* Share Link */}
              <div className="space-y-2">
                <Label className="text-sm text-white/60">Public Donation Link</Label>
                <div className="flex gap-2">
                  <Input
                    value={shareSettings.shareUrl}
                    readOnly
                    className="flex-1 border-white/10 bg-white/5 text-sm text-white"
                  />
                  <Button
                    onClick={handleCopyLink}
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "shrink-0 border border-white/10",
                      copied ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-white/60 hover:text-white"
                    )}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button
                    onClick={handleOpenLink}
                    variant="ghost"
                    size="icon"
                    className="shrink-0 border border-white/10 bg-white/5 text-white/60 hover:text-white"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* QR Code Toggle */}
              <div className="space-y-3">
                <button
                  onClick={() => setShowQR(!showQR)}
                  className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10"
                >
                  <div className="flex items-center gap-3">
                    <QrCode className="h-5 w-5 text-blue-400" />
                    <span className="font-medium text-white">QR Code</span>
                  </div>
                  <span className="text-sm text-white/50">
                    {showQR ? "Hide" : "Show"}
                  </span>
                </button>

                <AnimatePresence>
                  {showQR && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-col items-center gap-4 rounded-xl border border-white/10 bg-linear-to-br from-slate-800/50 to-slate-900/50 p-6">
                        <img
                          src={generateQRCodeSVG(shareSettings.shareUrl, 180)}
                          alt="QR Code"
                          className="h-44 w-44 rounded-lg"
                        />
                        <p className="text-center text-xs text-white/40">
                          Scan to donate directly to this campaign
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3 border-t border-white/10 pt-5">
                <Button
                  onClick={handleRegenerateLink}
                  disabled={enableShareMutation.isPending}
                  variant="outline"
                  className="w-full gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10"
                >
                  {enableShareMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Regenerate Link
                </Button>

                <Button
                  onClick={handleDisableShare}
                  disabled={disableShareMutation.isPending}
                  variant="ghost"
                  className="w-full gap-2 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                >
                  {disableShareMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                  Disable Public Sharing
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Close Button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </DialogContent>
    </Dialog>
  );
}
