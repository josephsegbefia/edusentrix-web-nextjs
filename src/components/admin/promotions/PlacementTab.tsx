// src/components/admin/promotions/PlacementTab.tsx
// PROMO-FE-006: Auto-assign + manual placement
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { usePromotionCycles } from "@/hooks/admin/usePromotionCycles";
import {
  usePromotionDecisions,
  useAutoAssignPlacements,
} from "@/hooks/admin/usePromotionDecisions";
import { useBusyToast } from "@/hooks/useBusyToast";
import { MapPin, Loader2, Zap } from "lucide-react";
import {
  PremiumSelect,
  PremiumSelectTrigger,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectValue,
} from "@/components/ui/premium-select";

const PLACEMENT_STATUSES = ["preview_ready", "review_in_progress", "approved"];

export function PlacementTab() {
  const busy = useBusyToast();
  const { data: cyclesData } = usePromotionCycles({ status: undefined });
  const cycles = (cyclesData?.data ?? []).filter((c) =>
    PLACEMENT_STATUSES.includes(c.status)
  );

  const [cycleId, setCycleId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (cycles.length && !cycleId) setCycleId(cycles[0].id);
  }, [cycles, cycleId]);

  const { data } = usePromotionDecisions({
    cycleId,
    page: 1,
    limit: 100,
    outcome: "promote",
  });

  const autoAssign = useAutoAssignPlacements(cycleId);

  const promoteWithoutTarget = (data?.data ?? []).filter(
    (d) => !d.targetGradeId || !d.targetClassGroupId
  );

  const handleAutoAssign = async () => {
    if (!cycleId) return;
    try {
      await busy.promise(autoAssign.mutateAsync(), {
        loading: "Auto-assigning placements...",
        success: "Placements assigned",
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
          <h2 className="text-lg font-semibold text-white">Placement</h2>
          <p className="mt-1 text-sm text-white/50">
            Assign target grades and classes for students set to promote.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 py-12 text-center">
          <MapPin className="mx-auto h-12 w-12 text-white/20" />
          <p className="mt-4 text-white/60">No cycles ready for placement</p>
          <p className="mt-1 text-sm text-white/40">
            Run a preview and review decisions first
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Placement</h2>
        <p className="mt-1 text-sm text-white/50">
          Assign target grades and classes for students set to promote.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
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
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <h4 className="mb-2 font-semibold text-white">Auto-assign placements</h4>
        <p className="mb-4 text-sm text-white/60">
          Assign promote decisions to target classes using the least-loaded-class algorithm.
        </p>
        <Button
          onClick={handleAutoAssign}
          disabled={autoAssign.isPending || promoteWithoutTarget.length === 0}
          className="gap-2"
        >
          {autoAssign.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
          Auto-assign ({promoteWithoutTarget.length} need placement)
        </Button>
      </div>

      {promoteWithoutTarget.length > 0 && (
        <div className="rounded-xl border border-white/10">
          <h4 className="border-b border-white/10 px-4 py-3 font-medium text-white">
            Promote decisions without target
          </h4>
          <ul className="divide-y divide-white/5">
            {promoteWithoutTarget.slice(0, 20).map((d) => (
              <li key={d.id} className="flex items-center justify-between px-4 py-2">
                <span className="text-white/90">{d.studentName}</span>
                <span className="text-sm text-white/50">
                  {d.fromGradeName} {d.fromClassGroupName} → ?
                </span>
              </li>
            ))}
          </ul>
          {promoteWithoutTarget.length > 20 && (
            <p className="px-4 py-2 text-sm text-white/50">
              +{promoteWithoutTarget.length - 20} more
            </p>
          )}
        </div>
      )}

      {promoteWithoutTarget.length === 0 && data && data.data.length > 0 && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
          <p className="text-sm text-emerald-200">All promote decisions have target placements.</p>
        </div>
      )}
    </div>
  );
}
