"use client";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type PublishModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  pending?: boolean;
  classLabel?: string;
  subjectLabel?: string;
};

export function PublishModal({
  open,
  onOpenChange,
  onConfirm,
  pending,
  classLabel,
  subjectLabel,
}: PublishModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[#0f0f14] text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300">
              <AlertTriangle className="h-4 w-4" />
            </span>
            Publish grades
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm text-white/60">
          <p>
            You are about to publish grades for{" "}
            <span className="font-semibold text-white">{subjectLabel ?? "this subject"}</span>
            {classLabel ? ` in ${classLabel}` : ""}.
          </p>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/40">
              <CheckCircle2 className="h-3.5 w-3.5" />
              What happens next
            </div>
            <ul className="mt-2 space-y-1 text-sm text-white/60">
              <li>All draft scores will be marked as published.</li>
              <li>Subject grade summaries will be recalculated.</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/10 text-white/60"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={pending}
            className="bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
          >
            Publish grades
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
