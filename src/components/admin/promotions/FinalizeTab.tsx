// src/components/admin/promotions/FinalizeTab.tsx
// PROMO-FE-007: Approve and finalize actions
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { usePromotionCycles, usePromotionCycle } from "@/hooks/admin/usePromotionCycles";
import { useApprovePromotionCycle, useFinalizePromotionCycle, useRollbackPromotionCycle } from "@/hooks/admin/usePromotionFinalize";
import { promotionFeatureFlags } from "@/lib/promotions/feature-flags";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { CheckCircle, Loader2, ShieldCheck, RotateCcw, RefreshCw } from "lucide-react";
import {
  PremiumSelect,
  PremiumSelectTrigger,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectValue,
} from "@/components/ui/premium-select";

const FINALIZE_STATUSES = ["preview_ready", "review_in_progress", "approved", "finalizing", "finalized", "finalize_failed", "rolling_back", "rolled_back", "rollback_failed"];

export function FinalizeTab() {
  const busy = useBusyToast();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const { data: cyclesData } = usePromotionCycles({ status: undefined });
  const cycles = (cyclesData?.data ?? []).filter((c) =>
    FINALIZE_STATUSES.includes(c.status)
  );

  const [cycleId, setCycleId] = React.useState<string | null>(null);

  const { data: cycleData } = usePromotionCycle(cycleId ?? "", { pollWhenActive: true });
  const cycle = cycleData?.data;

  const approveMutation = useApprovePromotionCycle(cycleId);
  const finalizeMutation = useFinalizePromotionCycle(cycleId);
  const rollbackMutation = useRollbackPromotionCycle(cycleId);

  React.useEffect(() => {
    if (cycles.length && !cycleId) setCycleId(cycles[0].id);
  }, [cycles, cycleId]);

  const handleApprove = async () => {
    if (!cycleId) return;
    const ok = await confirm({
      title: "Approve cycle?",
      description: "This allows the cycle to be finalized. No student data is changed yet.",
      confirmLabel: "Approve",
      intent: "default",
    });
    if (ok !== "confirm") return;
    try {
      await busy.promise(approveMutation.mutateAsync(), {
        loading: "Approving...",
        success: "Cycle approved",
        error: (e: Error) => e.message,
      });
    } catch {
      // Handled
    }
  };

  const handleFinalize = async () => {
    if (!cycleId) return;
    const ok = await confirm({
      title: "Finalize promotions?",
      description:
        "This will apply all decisions to students: update grades, classes, and TermResult.isPromoted. This action cannot be undone without a rollback.",
      confirmLabel: "Finalize",
      intent: "destructive",
    });
    if (ok !== "confirm") return;
    try {
      await busy.promise(finalizeMutation.mutateAsync(), {
        loading: "Finalizing...",
        success: "Promotions finalized",
        error: (e: Error) => e.message,
      });
    } catch {
      // Handled
    }
  };

  const handleRollback = async () => {
    if (!cycleId) return;
    const ok = await confirm({
      title: "Rollback promotions?",
      description:
        "This will restore all students to their pre-finalize grade and class. This reverses the finalize action.",
      confirmLabel: "Rollback",
      intent: "destructive",
    });
    if (ok !== "confirm") return;
    try {
      await busy.promise(rollbackMutation.mutateAsync(), {
        loading: "Rolling back...",
        success: "Promotions rolled back",
        error: (e: Error) => e.message,
      });
    } catch {
      // Handled
    }
  };

  if (cycles.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Approve & finalize</h2>
          <p className="mt-1 text-sm text-white/50">
            Apply grade transitions after reviewing and approving decisions.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 py-12 text-center">
        <CheckCircle className="mx-auto h-12 w-12 text-white/20" />
          <p className="mt-4 text-white/60">No cycles ready for finalize</p>
          <p className="mt-1 text-sm text-white/40">
            Approve a cycle from the Review tab first
          </p>
        </div>
      </div>
    );
  }

  const canApprove = cycle?.status === "preview_ready" || cycle?.status === "review_in_progress";
  const canFinalize = cycle?.status === "approved";
  const isFinalizeFailed = cycle?.status === "finalize_failed";
  const canRetryFinalize = isFinalizeFailed;
  const isFinalizing = cycle?.status === "finalizing";
  const isFinalized = cycle?.status === "finalized";
  const canRollback = cycle?.status === "finalized";
  const isRollbackFailed = cycle?.status === "rollback_failed";
  const canRetryRollback = isRollbackFailed;
  const isRollingBack = cycle?.status === "rolling_back";
  const isRolledBack = cycle?.status === "rolled_back";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Approve & finalize</h2>
        <p className="mt-1 text-sm text-white/50">
          Apply grade transitions after reviewing and approving decisions.
        </p>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-white/50">Cycle</label>
        <PremiumSelect
          value={cycleId ?? ""}
          onValueChange={(v) => setCycleId(v || null)}
        >
          <PremiumSelectTrigger className="h-9 min-w-[180px] rounded-xl">
            <PremiumSelectValue placeholder="Select cycle" />
          </PremiumSelectTrigger>
          <PremiumSelectContent>
            {cycles.map((c) => (
              <PremiumSelectItem key={c.id} value={c.id}>
                {c.sourceYearLabel} ({c.status})
              </PremiumSelectItem>
            ))}
          </PremiumSelectContent>
        </PremiumSelect>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <h4 className="mb-2 font-semibold text-white">Approve</h4>
        <p className="mb-4 text-sm text-white/60">
          Approve the cycle to unlock the finalize action. No changes are made until you finalize.
        </p>
        <Button
          onClick={handleApprove}
          disabled={!canApprove || approveMutation.isPending}
          variant="outline"
          className="gap-2"
        >
          {approveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )}
          Approve cycle
        </Button>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <h4 className="mb-2 font-semibold text-white">Finalize</h4>
        <p className="mb-4 text-sm text-white/60">
          Apply all decisions to students. Updates grade/class placement and TermResult.isPromoted.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleFinalize}
            disabled={!promotionFeatureFlags.finalizeEnabled || (!canFinalize && !canRetryFinalize) || isFinalizing || isFinalized || finalizeMutation.isPending}
            className="gap-2"
          >
            {finalizeMutation.isPending || isFinalizing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : canRetryFinalize ? (
              <RefreshCw className="h-4 w-4" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            {isFinalized ? "Finalized" : isFinalizing ? "Finalizing..." : canRetryFinalize ? "Retry finalize" : "Finalize"}
          </Button>
          {isFinalizeFailed && (
            <span className="flex items-center text-sm text-amber-200">Previous run failed</span>
          )}
        </div>
        {(isFinalizing || isRollingBack) &&
          cycle?.progress != null &&
          typeof cycle.progress === "object" && (
          <div className="mt-4 space-y-1">
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-indigo-500 transition-all"
                style={{
                  width: `${Math.min(100, ((cycle.progress as { processed?: number; total?: number }).processed ?? 0) / Math.max(1, (cycle.progress as { total?: number }).total ?? 1) * 100)}%`,
                }}
              />
            </div>
            <p className="text-xs text-white/50">
              {(cycle.progress as { processed?: number; total?: number }).processed ?? 0} / {(cycle.progress as { total?: number }).total ?? 0} processed
            </p>
          </div>
        )}
      </div>

      {(isFinalized || isRollbackFailed) && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-6">
          <h4 className="mb-2 font-semibold text-white">Rollback</h4>
          <p className="mb-4 text-sm text-white/60">
            Restore all students to their pre-finalize grade and class placement.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleRollback}
              disabled={!promotionFeatureFlags.rollbackEnabled || (!canRollback && !canRetryRollback) || isRollingBack || isRolledBack || rollbackMutation.isPending}
              variant="outline"
              className="gap-2 border-amber-500/30 text-amber-200 hover:bg-amber-500/10"
            >
              {rollbackMutation.isPending || isRollingBack ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : canRetryRollback ? (
                <RefreshCw className="h-4 w-4" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              {isRolledBack ? "Rolled back" : isRollingBack ? "Rolling back..." : canRetryRollback ? "Retry rollback" : "Rollback"}
            </Button>
            {isRollbackFailed && (
              <span className="flex items-center text-sm text-amber-200">Previous rollback failed</span>
            )}
          </div>
        </div>
      )}

      {isRolledBack && (
        <div className="rounded-xl border border-slate-500/20 bg-slate-500/10 p-4">
          <p className="text-sm text-slate-200">This cycle has been rolled back.</p>
        </div>
      )}

      {confirmationDialog}
    </div>
  );
}
