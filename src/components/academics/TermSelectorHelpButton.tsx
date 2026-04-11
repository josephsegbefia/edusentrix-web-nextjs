"use client";

import * as React from "react";
import { CircleHelp } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { termSelectorTooltip } from "@/lib/academics/term-selector-tooltip";

type Props = {
  schoolLevel?: "Basic" | "SHS" | null;
  noTermsAvailable?: boolean;
};

export function TermSelectorHelpButton({
  schoolLevel,
  noTermsAvailable,
}: Props) {
  const text = termSelectorTooltip(schoolLevel, { noTermsAvailable });
  return (
    <TooltipProvider delayDuration={280}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="rounded-full p-1.5 text-white/45 transition-colors hover:bg-white/10 hover:text-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40"
            aria-label="How term selection works"
          >
            <CircleHelp className="h-4 w-4 shrink-0" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="end"
          className="max-w-[min(20rem,calc(100vw-2rem))] border-white/10 bg-slate-950/95 px-3 py-2 text-left text-xs leading-relaxed text-white/90 shadow-xl"
        >
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
