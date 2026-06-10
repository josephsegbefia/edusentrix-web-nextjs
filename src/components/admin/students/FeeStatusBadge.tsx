"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { FeeStatus } from "@/types/admin/student";

type FeeStatusBadgeProps = {
  status: FeeStatus;
  amountOwed: number | null;
};

export function FeeStatusBadge({ status, amountOwed }: FeeStatusBadgeProps) {
  const { label, classes } = React.useMemo(() => {
    switch (status) {
      case "cleared":
        return {
          label: "Fees Cleared",
          classes:
            "bg-emerald-500/15 text-emerald-100 border border-emerald-400/40",
        };
      case "owing":
        return {
          label:
            amountOwed !== null && amountOwed > 0
              ? `Owing GH₵${amountOwed.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}`
              : "Owing Fees",
          classes: "bg-red-500/15 text-red-100 border border-red-400/40",
        };
      case "partial":
        return {
          label:
            amountOwed !== null && amountOwed > 0
              ? `Partially paid · ₵${amountOwed.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })} left`
              : "Partially paid",
          classes: "bg-amber-500/15 text-amber-100 border border-amber-400/40",
        };
      case "none":
        return {
          label: "No fees assigned yet",
          classes: "bg-blue-500/10 text-blue-100 border border-blue-400/40",
        };
      case "unknown":
      default:
        return {
          label: "Fee data pending",
          classes: "bg-slate-700/70 text-slate-100 border border-slate-500/40",
        };
    }
  }, [status, amountOwed]);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium backdrop-blur",
        classes
      )}
    >
      {label}
    </span>
  );
}
