// src/components/admin/promotions/ReviewTab.tsx
// PROMO-FE-005: Decision table, filters, override modal
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  usePromotionDecisions,
  useOverridePromotionDecision,
} from "@/hooks/admin/usePromotionDecisions";
import { usePromotionCycles } from "@/hooks/admin/usePromotionCycles";
import { OverrideDecisionModal } from "./OverrideDecisionModal";
import { useBusyToast } from "@/hooks/useBusyToast";
import { Users, Loader2, Pencil, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PremiumSelect,
  PremiumSelectTrigger,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { StudentsPagination } from "@/components/admin/students/StudentsPagination";

const REVIEWABLE_STATUSES = ["preview_ready", "review_in_progress"];
const DECISION_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

const OUTCOME_COLORS: Record<string, string> = {
  promote: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  repeat: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  graduate: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  hold: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

export function ReviewTab() {
  const busy = useBusyToast();
  const { data: cyclesData } = usePromotionCycles({ status: undefined });
  const cycles = (cyclesData?.data ?? []).filter((c) =>
    REVIEWABLE_STATUSES.includes(c.status)
  );

  const [cycleId, setCycleId] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [outcomeFilter, setOutcomeFilter] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [overrideDecision, setOverrideDecision] = React.useState<import("@/hooks/admin/usePromotionDecisions").PromotionDecisionDTO | null>(null);

  React.useEffect(() => {
    if (cycles.length && !cycleId) setCycleId(cycles[0].id);
  }, [cycles, cycleId]);

  const { data, isLoading } = usePromotionDecisions({
    cycleId,
    page,
    limit: pageSize,
    outcome: outcomeFilter || undefined,
    search: search.trim() || undefined,
  });

  const overrideMutation = useOverridePromotionDecision(cycleId);
  const decisions = data?.data ?? [];
  const pagination = data?.pagination ?? { page: 1, limit: 20, totalPages: 0, total: 0 };

  const handleOverride = async (params: {
    finalOutcome: string;
    reasonText: string;
    version: number;
  }) => {
    if (!overrideDecision || !cycleId) return;
    await busy.promise(
      overrideMutation.mutateAsync({
        studentId: overrideDecision.studentId,
        ...params,
      }),
      {
        loading: "Applying override...",
        success: "Override applied",
        error: (e: Error) => e.message,
      }
    );
  };

  if (cycles.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Review & overrides</h2>
          <p className="mt-1 text-sm text-white/50">
            Check and adjust promotion decisions before finalizing.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 py-12 text-center">
          <Users className="mx-auto h-12 w-12 text-white/20" />
          <p className="mt-4 text-white/60">No cycles ready for review</p>
          <p className="mt-1 text-sm text-white/40">
            Run a preview first, then return here to review and override decisions
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white">Review & overrides</h2>
        <p className="mt-1 text-sm text-white/50">
          Check and adjust promotion decisions before finalizing.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="space-y-1">
          <label className="text-xs text-white/50">Cycle</label>
          <PremiumSelect
            value={cycleId ?? ""}
            onValueChange={(v) => {
              setCycleId(v || null);
              setPage(1);
            }}
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
        <div className="space-y-1">
          <label className="text-xs text-white/50">Outcome</label>
          <PremiumSelect
            value={outcomeFilter || "all"}
            onValueChange={(v) => {
              setOutcomeFilter(v === "all" ? "" : v);
              setPage(1);
            }}
          >
            <PremiumSelectTrigger className="h-9 min-w-[120px] rounded-xl">
              <PremiumSelectValue placeholder="All outcomes" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              <PremiumSelectItem value="all">All</PremiumSelectItem>
              <PremiumSelectItem value="promote">Promote</PremiumSelectItem>
              <PremiumSelectItem value="repeat">Repeat</PremiumSelectItem>
              <PremiumSelectItem value="graduate">Graduate</PremiumSelectItem>
              <PremiumSelectItem value="hold">Hold</PremiumSelectItem>
            </PremiumSelectContent>
          </PremiumSelect>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <Input
            placeholder="Search student..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-48 border-white/10 bg-white/5 pl-9 text-white"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-white/40" />
        </div>
      ) : decisions.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 py-8 text-center">
          <p className="text-white/60">No decisions match your filters</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => {
              setOutcomeFilter("");
              setSearch("");
              setPage(1);
            }}
          >
            Reset filters
          </Button>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-3 text-left text-white/70">Student</th>
                  <th className="px-4 py-3 text-left text-white/70">From</th>
                  <th className="px-4 py-3 text-left text-white/70">Outcome</th>
                  <th className="px-4 py-3 text-left text-white/70">Target</th>
                  <th className="px-4 py-3 text-left text-white/70">Source</th>
                  <th className="px-4 py-3 w-20" />
                </tr>
              </thead>
              <tbody>
                {decisions.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-white/5 hover:bg-white/5"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-white">{d.studentName}</span>
                      {d.admissionNo && (
                        <span className="ml-1 text-xs text-white/50">({d.admissionNo})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/80">
                      {d.fromGradeName} {d.fromClassGroupName}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          OUTCOME_COLORS[d.finalOutcome] ?? "bg-white/10"
                        )}
                      >
                        {d.finalOutcome}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-white/70">
                      {d.targetGradeName && d.targetClassGroupName
                        ? `${d.targetGradeName} ${d.targetClassGroupName}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-white/50 text-xs">
                      {d.source}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setOverrideDecision(d)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.total > 0 &&
            pagination.totalPages > 0 && (
              <StudentsPagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                pageSize={pagination.limit}
                pageSizeOptions={DECISION_PAGE_SIZE_OPTIONS}
                onChangePage={setPage}
                onChangePageSize={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
                itemLabel="decisions"
              />
            )}
        </>
      )}

      <OverrideDecisionModal
        open={!!overrideDecision}
        onOpenChange={(open) => !open && setOverrideDecision(null)}
        decision={overrideDecision}
        onConfirm={handleOverride}
        isPending={overrideMutation.isPending}
      />
    </div>
  );
}
