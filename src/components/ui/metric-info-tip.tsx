"use client";

import * as React from "react";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type MetricInfoTipProps = {
  content: React.ReactNode;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
  /** Accessible name for the trigger button. */
  ariaLabel?: string;
};

export function MetricInfoTip({
  content,
  className,
  side = "top",
  ariaLabel = "How this metric is calculated",
}: MetricInfoTipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white/40 transition-colors",
              "hover:text-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/40",
              className
            )}
            aria-label={ariaLabel}
          >
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          sideOffset={6}
          className="max-w-[16rem] border-white/10 bg-slate-950/95 px-3 py-2 text-xs leading-relaxed text-white/80 shadow-xl"
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

type MetricLabelWithInfoProps = {
  label: string;
  tooltip: React.ReactNode;
  className?: string;
  labelClassName?: string;
};

/** Inline label + info icon for stat cards and section headers. */
export function MetricLabelWithInfo({
  label,
  tooltip,
  className,
  labelClassName,
}: MetricLabelWithInfoProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className={labelClassName}>{label}</span>
      <MetricInfoTip content={tooltip} />
    </span>
  );
}
