"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, ShieldCheck, ShieldX, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimetableConflictBlockers, TimetableConflictDTO } from "@/hooks/admin/useTimetablePlanner";

type ConflictPanelProps = {
  conflicts: TimetableConflictDTO[];
  blockers?: TimetableConflictBlockers;
  isLoading: boolean;
  errorMessage?: string | null;
  onRecompute?: () => void;
  recomputing?: boolean;
  onJumpToSlot?: (slotId: string) => void;
};

function severityStyles(severity: "error" | "warning") {
  if (severity === "error") {
    return "border-rose-500/40 bg-rose-500/15 text-rose-200";
  }
  return "border-amber-500/40 bg-amber-500/15 text-amber-200";
}

export function ConflictPanel({
  conflicts,
  blockers,
  isLoading,
  errorMessage,
  onRecompute,
  recomputing,
  onJumpToSlot,
}: ConflictPanelProps) {
  const openErrorCount = blockers?.openErrorCount || 0;
  const publishBlocked = blockers?.publishBlocked || false;

  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base text-white">
            <AlertTriangle className="h-4 w-4 text-amber-300" />
            Conflicts
          </CardTitle>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "border-white/20",
                publishBlocked ? "text-rose-200" : "text-emerald-200"
              )}
            >
              {publishBlocked ? (
                <>
                  <ShieldX className="mr-1 h-3.5 w-3.5" />
                  Publish blocked ({openErrorCount} errors)
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                  No publish blockers
                </>
              )}
            </Badge>

            {onRecompute ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-white/20 bg-transparent text-white/80 hover:bg-white/10"
                onClick={onRecompute}
                disabled={recomputing}
              >
                <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", recomputing && "animate-spin")} />
                Recompute
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="text-sm text-white/60">Loading conflicts...</div>
        ) : errorMessage ? (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
            {errorMessage}
          </div>
        ) : conflicts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
            No open conflicts found.
          </div>
        ) : (
          <div className="space-y-2">
            {conflicts.map((conflict) => (
              <div
                key={conflict.id}
                className={cn("rounded-lg border p-3", severityStyles(conflict.severity))}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-current text-[11px]">
                        {conflict.code}
                      </Badge>
                      <span className="text-xs uppercase tracking-wide opacity-80">
                        {conflict.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">{conflict.message}</p>
                    <p className="mt-1 text-xs opacity-80">
                      Affected slots: {conflict.slotIds.length}
                    </p>
                  </div>

                  {onJumpToSlot && conflict.slotIds.length > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-current/40 bg-transparent text-current hover:bg-black/10"
                      onClick={() => onJumpToSlot(conflict.slotIds[0])}
                    >
                      <Target className="mr-1.5 h-3.5 w-3.5" />
                      Jump
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
