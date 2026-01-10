// src/components/demo/DemoRestrictionBadge.tsx
"use client";

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDemo } from "./DemoContext";

interface DemoRestrictionBadgeProps {
  feature: string;
  className?: string;
}

/**
 * Small badge/icon that shows when a feature is restricted in demo mode
 */
export function DemoRestrictionBadge({ feature, className = "" }: DemoRestrictionBadgeProps) {
  const { isDemo, isFeatureAllowed, getRestrictionMessage } = useDemo();

  if (!isDemo || isFeatureAllowed(feature)) return null;

  const message = getRestrictionMessage(feature);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center gap-1 text-xs text-amber-500 ${className}`}>
            <Info className="h-3 w-3" />
            <span>Demo</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p>{message}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
