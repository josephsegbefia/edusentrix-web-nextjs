// src/components/modals/PostCampaignUpdateModal.tsx
"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { FileText, Loader2, Megaphone, X } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  useCreateCampaignUpdate,
  useUpdateCampaignUpdate,
  CampaignUpdateDTO,
} from "@/hooks/admin/useFundraisingCampaigns";
import { toast } from "sonner";

// ============================================================================
// Component
// ============================================================================

interface PostCampaignUpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignTitle: string;
  existingUpdate?: CampaignUpdateDTO | null;
  onSuccess?: () => void;
}

export function PostCampaignUpdateModal({
  open,
  onOpenChange,
  campaignId,
  campaignTitle,
  existingUpdate,
  onSuccess,
}: PostCampaignUpdateModalProps) {
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [isPublished, setIsPublished] = React.useState(true);

  const createMutation = useCreateCampaignUpdate();
  const updateMutation = useUpdateCampaignUpdate();

  const isEditing = !!existingUpdate;

  // Reset form when modal opens
  React.useEffect(() => {
    if (open) {
      if (existingUpdate) {
        setTitle(existingUpdate.title);
        setBody(existingUpdate.body);
        setIsPublished(existingUpdate.isPublished);
      } else {
        setTitle("");
        setBody("");
        setIsPublished(true);
      }
    }
  }, [open, existingUpdate]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }
    if (body.trim().length < 10) {
      toast.error("Body must be at least 10 characters");
      return;
    }

    try {
      if (isEditing && existingUpdate) {
        await updateMutation.mutateAsync({
          campaignId,
          updateId: existingUpdate.id,
          data: { title: title.trim(), body: body.trim(), isPublished },
        });
        toast.success("Update modified successfully");
      } else {
        await createMutation.mutateAsync({
          campaignId,
          data: { title: title.trim(), body: body.trim(), isPublished },
        });
        toast.success("Update posted successfully");
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to post update");
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900 via-slate-950 to-black p-0 shadow-2xl sm:max-w-lg">
        {/* Ambient gradient */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-violet-500/10 via-transparent to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />

        {/* Header */}
        <DialogHeader className="relative z-10 border-b border-white/5 p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-violet-500/20 to-purple-500/20">
              <Megaphone className="h-6 w-6 text-violet-400" />
            </div>
            <div>
              <DialogTitle className="text-xl text-white">
                {isEditing ? "Edit Update" : "Post Update"}
              </DialogTitle>
              <DialogDescription className="mt-1 text-white/50">
                Share progress on {campaignTitle}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="relative z-10 space-y-5 p-6">
          {/* Title */}
          <div className="space-y-2">
            <Label className="text-sm text-white/60">Update Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., We've reached 50% of our goal!"
              maxLength={200}
              className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
            />
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label className="text-sm text-white/60">Message</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Share the latest progress, thank donors, or provide updates on how funds are being used..."
              maxLength={5000}
              className="min-h-[160px] resize-none border-white/10 bg-white/5 text-white placeholder:text-white/30"
            />
            <p className="text-right text-xs text-white/30">{body.length}/5000</p>
          </div>

          {/* Publish Toggle */}
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4">
            <div>
              <p className="font-medium text-white">Publish immediately</p>
              <p className="text-sm text-white/50">Donors will see this update right away</p>
            </div>
            <Switch checked={isPublished} onCheckedChange={setIsPublished} />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending || !title.trim() || body.trim().length < 10}
              className="flex-1 gap-2 bg-linear-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isEditing ? "Saving..." : "Posting..."}
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  {isEditing ? "Save Changes" : "Post Update"}
                </>
              )}
            </Button>
          </div>
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
