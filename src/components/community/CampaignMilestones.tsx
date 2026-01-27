// src/components/community/CampaignMilestones.tsx
"use client";

import * as React from "react";
import { Check, Circle, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/fees/money";
import { CampaignMilestoneDTO } from "@/hooks/admin/useFundraisingCampaigns";

// ============================================================================
// Types
// ============================================================================

interface CampaignMilestonesProps {
  milestones: CampaignMilestoneDTO[];
  raisedAmountMinor: number;
  currency: string;
  className?: string;
  orientation?: "horizontal" | "vertical";
}

// ============================================================================
// Main Component
// ============================================================================

export default function CampaignMilestones({
  milestones,
  raisedAmountMinor,
  currency,
  className,
  orientation = "vertical",
}: CampaignMilestonesProps) {
  if (milestones.length === 0) {
    return (
      <div className={cn("rounded-xl border border-white/10 bg-white/5 p-6", className)}>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Target className="h-10 w-10 text-white/20" />
          <p className="mt-2 text-sm text-white/50">No milestones set</p>
        </div>
      </div>
    );
  }

  // Sort milestones by amount
  const sortedMilestones = [...milestones].sort((a, b) => a.amountMinor - b.amountMinor);

  if (orientation === "horizontal") {
    return (
      <div className={cn("rounded-xl border border-white/10 bg-white/5 p-6", className)}>
        <h4 className="mb-4 font-medium text-white">Milestones</h4>
        <div className="relative">
          {/* Progress Line */}
          <div className="absolute left-0 right-0 top-4 h-0.5 bg-white/10" />
          <div
            className="absolute left-0 top-4 h-0.5 bg-emerald-500 transition-all"
            style={{
              width: `${Math.min(
                (raisedAmountMinor / (sortedMilestones[sortedMilestones.length - 1]?.amountMinor || 1)) * 100,
                100
              )}%`,
            }}
          />

          {/* Milestone Points */}
          <div className="flex justify-between">
            {sortedMilestones.map((milestone) => {
              const isReached = raisedAmountMinor >= milestone.amountMinor;
              return (
                <div key={milestone.id} className="flex flex-col items-center">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all",
                      isReached
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-white/20 bg-neutral-900 text-white/40"
                    )}
                  >
                    {isReached ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Circle className="h-3 w-3" />
                    )}
                  </div>
                  <div className="mt-2 text-center">
                    <div className="text-xs font-medium text-white/70">
                      {formatMoney(milestone.amountMinor, currency)}
                    </div>
                    <div className="max-w-20 truncate text-xs text-white/50">
                      {milestone.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Vertical orientation
  return (
    <div className={cn("rounded-xl border border-white/10 bg-white/5 p-6", className)}>
      <h4 className="mb-4 font-medium text-white">Milestones</h4>
      <div className="relative space-y-4">
        {sortedMilestones.map((milestone, index) => {
          const isReached = raisedAmountMinor >= milestone.amountMinor;
          const isLast = index === sortedMilestones.length - 1;

          return (
            <div key={milestone.id} className="relative flex gap-4">
              {/* Connector Line */}
              {!isLast && (
                <div
                  className={cn(
                    "absolute left-4 top-8 h-full w-0.5 -translate-x-1/2",
                    isReached ? "bg-emerald-500" : "bg-white/10"
                  )}
                />
              )}

              {/* Icon */}
              <div
                className={cn(
                  "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                  isReached
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-white/20 bg-neutral-900 text-white/40"
                )}
              >
                {isReached ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pb-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">{milestone.label}</span>
                  <span
                    className={cn(
                      "text-sm",
                      isReached ? "text-emerald-400" : "text-white/50"
                    )}
                  >
                    {formatMoney(milestone.amountMinor, currency)}
                  </span>
                </div>
                {milestone.reachedAt && (
                  <div className="mt-1 text-xs text-white/40">
                    Reached on {new Date(milestone.reachedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
