// src/components/admin/promotions/HistoryTab.tsx
// PROMO-FE-008: Cycle history list
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { usePromotionCycles, useDeletePromotionCycle } from "@/hooks/admin/usePromotionCycles";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { useBusyToast } from "@/hooks/useBusyToast";
import { Badge } from "@/components/ui/badge";
import { History, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { StudentsPagination } from "@/components/admin/students/StudentsPagination";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  preview_ready: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  review_in_progress: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  approved: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  finalizing: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  finalized: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  finalize_failed: "bg-red-500/20 text-red-300 border-red-500/30",
  cancelled: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  rolled_back: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  rollback_failed: "bg-red-500/20 text-red-300 border-red-500/30",
};

function formatStatus(s: string) {
  return s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const CYCLE_PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;

export function HistoryTab() {
  const busy = useBusyToast();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const { data, isLoading } = usePromotionCycles({ page, limit: pageSize });
  const deleteCycle = useDeletePromotionCycle();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-white/40" />
      </div>
    );
  }

  const cycles = data?.data ?? [];
  const pagination = data?.pagination ?? { page: 1, limit: 10, totalPages: 0, total: 0 };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Cycle history</h2>
        <p className="mt-1 text-sm text-white/50">
          Past promotion cycles and their status.
        </p>
      </div>

      {cycles.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] py-12 text-center">
          <History className="mx-auto h-12 w-12 text-white/20" />
          <p className="mt-4 text-white/60">No promotion cycles yet</p>
          <p className="mt-1 text-sm text-white/40">
            Run a preview in the Preview tab to create your first cycle
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {cycles.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.04]"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white">{c.sourceYearLabel}</p>
                <p className="text-xs text-white/50">
                  {c.totals.studentsEvaluated} evaluated • P: {c.totals.promote} R: {c.totals.repeat}{" "}
                  G: {c.totals.graduate} H: {c.totals.hold}
                </p>
              </div>
              <Badge
                variant="outline"
                className={cn("shrink-0", STATUS_COLORS[c.status] ?? "bg-white/10")}
              >
                {formatStatus(c.status)}
              </Badge>
              <span className="text-xs text-white/40">
                {new Date(c.createdAt).toLocaleDateString()}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-white/40 hover:bg-red-500/10 hover:text-red-400"
                onClick={async () => {
                  const ok = await confirm({
                    title: "Delete cycle?",
                    description: `This will permanently delete "${c.sourceYearLabel}" and all its decisions. This cannot be undone.`,
                    confirmLabel: "Delete",
                    intent: "destructive",
                  });
                  if (ok !== "confirm") return;
                  try {
                    await busy.promise(deleteCycle.mutateAsync(c.id), {
                      loading: "Deleting...",
                      success: "Cycle deleted",
                      error: (e: Error) => e.message,
                    });
                  } catch {
                    // Handled
                  }
                }}
                disabled={deleteCycle.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {confirmationDialog}

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-white/50">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= pagination.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
