"use client";

import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProposalPipelineCounts = {
  draft: number;
  ready: number;
  outreach: number; // sent + followed_up
  demo: number;     // demo_scheduled
  pilot: number;    // pilot_started
  won: number;      // accepted
};

type Stage = {
  key: keyof ProposalPipelineCounts;
  label: string;
  filterStatus: string;
  color: string;
  dotColor: string;
};

const STAGES: Stage[] = [
  { key: "draft",    label: "Drafts",   filterStatus: "draft",          color: "text-white/50 border-white/10 bg-white/[0.04]",       dotColor: "bg-white/30" },
  { key: "ready",    label: "Ready",    filterStatus: "ready",          color: "text-cyan-200 border-cyan-400/20 bg-cyan-500/10",      dotColor: "bg-cyan-400" },
  { key: "outreach", label: "Sent",     filterStatus: "sent",           color: "text-violet-200 border-violet-400/20 bg-violet-500/10",dotColor: "bg-violet-400" },
  { key: "demo",     label: "Demo",     filterStatus: "demo_scheduled", color: "text-amber-200 border-amber-400/20 bg-amber-500/10",   dotColor: "bg-amber-400" },
  { key: "pilot",    label: "Pilot",    filterStatus: "pilot_started",  color: "text-sky-200 border-sky-400/20 bg-sky-500/10",         dotColor: "bg-sky-400" },
  { key: "won",      label: "Won",      filterStatus: "accepted",       color: "text-emerald-200 border-emerald-400/20 bg-emerald-500/10", dotColor: "bg-emerald-400" },
];

type Props = {
  counts: ProposalPipelineCounts;
  activeFilter?: string;
  onFilter?: (status: string) => void;
};

export function ProposalPipeline({ counts, activeFilter, onFilter }: Props) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/35">Sales pipeline</p>
      <div className="flex flex-wrap items-center gap-2">
        {STAGES.map((stage, idx) => {
          const count = counts[stage.key];
          const isActive = activeFilter === stage.filterStatus;
          return (
            <div key={stage.key} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onFilter?.(isActive ? "all" : stage.filterStatus)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all",
                  stage.color,
                  isActive ? "ring-2 ring-white/20" : "hover:opacity-80",
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", stage.dotColor)} />
                {stage.label}
                <span className="ml-0.5 font-bold">{count}</span>
              </button>
              {idx < STAGES.length - 1 && (
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-white/20" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
