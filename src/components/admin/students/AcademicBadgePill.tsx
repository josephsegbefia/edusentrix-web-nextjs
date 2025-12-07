"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AcademicBadge } from "@/types/admin/student";
type AcademicBadgePillProps = {
  badge: AcademicBadge;
  latestAverage?: number | null;
};

export function AcademicBadgePill({
  badge,
  latestAverage,
}: AcademicBadgePillProps) {
  if (!badge || badge === "none") return null;

  const label = (() => {
    switch (badge) {
      case "top_1_percent":
        return "Top 1%";
      case "top_5_percent":
        return "Top 5%";
      case "top_10_percent":
        return "Top 10%";
      case "honours":
        return "Honours";
      default:
        return "Top performer";
    }
  })();

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-amber-400/50",
        "bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-50 backdrop-blur"
      )}
    >
      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
      <span>{label}</span>
      {typeof latestAverage === "number" && (
        <span className="text-[10px] text-amber-100/80">
          {latestAverage.toFixed(0)}%
        </span>
      )}
    </span>
  );
}
