"use client";

import { cn } from "@/lib/utils";
import { PERIOD_STATUS_LABELS } from "@/lib/academics/profile/academic-period-selector-utils";
import type { AcademicPeriodProfileStatus } from "@/types/academics/student-academic-profile";

const STATUS_STYLES: Record<AcademicPeriodProfileStatus, string> = {
  no_data: "border-white/10 bg-white/5 text-white/50",
  in_progress: "border-amber-400/25 bg-amber-500/10 text-amber-100",
  compiled: "border-violet-400/25 bg-violet-500/10 text-violet-100",
  approved: "border-cyan-400/25 bg-cyan-500/10 text-cyan-100",
  released: "border-emerald-400/25 bg-emerald-500/10 text-emerald-100",
  legacy: "border-white/15 bg-white/8 text-white/65",
};

type Props = {
  status: AcademicPeriodProfileStatus;
  isOfficial?: boolean;
  compact?: boolean;
  className?: string;
};

export function OfficialStatusBadge({
  status,
  isOfficial = false,
  compact = false,
  className,
}: Props) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border font-medium leading-normal",
        compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        STATUS_STYLES[status],
        className
      )}
    >
      {PERIOD_STATUS_LABELS[status]}
      {isOfficial ? (
        <span className="text-[9px] uppercase tracking-wide text-emerald-200/90">
          Official
        </span>
      ) : null}
    </span>
  );
}
