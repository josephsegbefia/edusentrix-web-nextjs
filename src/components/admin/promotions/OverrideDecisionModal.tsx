// src/components/admin/promotions/OverrideDecisionModal.tsx
// PROMO-FE-005: Override outcome modal
"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PromotionDecisionDTO } from "@/hooks/admin/usePromotionDecisions";
import { Loader2 } from "lucide-react";
import {
  PremiumSelect,
  PremiumSelectTrigger,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectValue,
} from "@/components/ui/premium-select";

type OverrideDecisionModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  decision: PromotionDecisionDTO | null;
  onConfirm: (params: {
    finalOutcome: string;
    reasonText: string;
    version: number;
  }) => Promise<void>;
  isPending: boolean;
};

const OUTCOMES = [
  { value: "promote", label: "Promote" },
  { value: "repeat", label: "Repeat" },
  { value: "graduate", label: "Graduate" },
  { value: "hold", label: "Hold" },
] as const;

export function OverrideDecisionModal({
  open,
  onOpenChange,
  decision,
  onConfirm,
  isPending,
}: OverrideDecisionModalProps) {
  const [outcome, setOutcome] = React.useState(decision?.finalOutcome ?? "hold");
  const [reason, setReason] = React.useState("");

  React.useEffect(() => {
    if (decision) {
      setOutcome(decision.finalOutcome);
      setReason("");
    }
  }, [decision]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decision || !reason.trim()) return;
    await onConfirm({
      finalOutcome: outcome,
      reasonText: reason.trim(),
      version: decision.version,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-slate-900 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Override Decision</DialogTitle>
        </DialogHeader>
        {decision && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-white/70">
              {decision.studentName}
              {decision.admissionNo && ` (${decision.admissionNo})`}
            </p>
            <p className="text-xs text-white/50">
              Current: {decision.finalOutcome} • From: {decision.fromGradeName} {decision.fromClassGroupName}
            </p>

            <div className="space-y-2">
              <Label className="text-white/70">New outcome</Label>
              <PremiumSelect value={outcome} onValueChange={(v) => setOutcome(v)}>
                <PremiumSelectTrigger className="h-9 w-full rounded-xl">
                  <PremiumSelectValue placeholder="Select outcome" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  {OUTCOMES.map((o) => (
                    <PremiumSelectItem key={o.value} value={o.value}>
                      {o.label}
                    </PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Reason (required)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why this override is needed..."
                rows={3}
                required
                className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || !reason.trim()}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Apply Override
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
