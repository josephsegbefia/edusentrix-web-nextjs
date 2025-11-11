"use client";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";

export function RejectionModal({
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  isPending: boolean;
}) {
  const isMobile = useIsMobile();
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    if (reason.trim().length >= 3) {
      onConfirm(reason.trim());
      setReason("");
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    setReason("");
    onOpenChange(false);
  };

  // Reset reason when modal closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setReason("");
    }
    onOpenChange(newOpen);
  };

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className={cn(
            "bg-card/95 backdrop-blur border-white/10 px-4 py-6",
            "h-auto max-h-[90vh] rounded-t-2xl"
          )}
        >
          <SheetHeader>
            <SheetTitle className="text-lg font-semibold text-white">
              Reject Application
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80">
                Reason for rejection
              </label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Please provide a reason for rejecting this application..."
                className="min-h-32 bg-white/5 border-white/20 text-white placeholder:text-white/40"
                disabled={isPending}
              />
              {reason.trim().length > 0 && reason.trim().length < 3 && (
                <p className="text-xs text-rose-400">
                  Reason must be at least 3 characters
                </p>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isPending}
                className="flex-1 border-white/20 bg-white/5 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={isPending || reason.trim().length < 3}
                className="flex-1 bg-rose-500 hover:bg-rose-600 text-white"
              >
                {isPending ? "Rejecting..." : "Reject Application"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card/95 backdrop-blur border-white/10 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-white">
            Reject Application
          </DialogTitle>
          <DialogDescription className="text-white/60">
            Please provide a reason for rejecting this application. This will be
            recorded in the audit trail.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80">
              Reason for rejection
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please provide a reason for rejecting this application..."
              className="min-h-32 bg-white/5 border-white/20 text-white placeholder:text-white/40"
              disabled={isPending}
            />
            {reason.trim().length > 0 && reason.trim().length < 3 && (
              <p className="text-xs text-rose-400">
                Reason must be at least 3 characters
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isPending}
            className="border-white/20 bg-white/5 text-white hover:bg-white/10"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isPending || reason.trim().length < 3}
            className="bg-rose-500 hover:bg-rose-600 text-white"
          >
            {isPending ? "Rejecting..." : "Reject Application"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
