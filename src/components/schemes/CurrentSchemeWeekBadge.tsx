"use client";

import { CalendarRange } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCurrentSchemeWeek } from "@/hooks/useCurrentSchemeWeek";

type Props = {
  className?: string;
  compact?: boolean;
};

export function CurrentSchemeWeekBadge({ className, compact = false }: Props) {
  const { data, isLoading } = useCurrentSchemeWeek();
  const week = data?.data;

  if (isLoading) {
    return (
      <span
        className={cn(
          "inline-block h-6 w-28 animate-pulse rounded-full border border-white/10 bg-white/5",
          className
        )}
      />
    );
  }

  if (!week || week.status === "no_period") return null;

  const title =
    week.rangeLabel && week.label
      ? `${week.label} · ${week.rangeLabel}`
      : week.label || week.rangeLabel || undefined;

  if (week.status !== "active") {
    return (
      <Badge
        title={title}
        className={cn(
          "rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-100",
          compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
          className
        )}
      >
        {week.label}
      </Badge>
    );
  }

  return (
    <Badge
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
        compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        className
      )}
    >
      <CalendarRange className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      <span className="font-medium">{week.label}</span>
      {!compact && week.totalWeeks ? (
        <span className="text-cyan-100/70">of {week.totalWeeks}</span>
      ) : null}
    </Badge>
  );
}
