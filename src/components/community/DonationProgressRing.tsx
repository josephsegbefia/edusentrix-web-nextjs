// src/components/community/DonationProgressRing.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/fees/money";

// ============================================================================
// Types
// ============================================================================

interface DonationProgressRingProps {
  raisedAmountMinor: number;
  goalAmountMinor: number;
  currency: string;
  size?: "sm" | "md" | "lg";
  showLabels?: boolean;
  className?: string;
  colorScheme?: "emerald" | "violet" | "blue" | "amber";
}

// ============================================================================
// Constants
// ============================================================================

const SIZE_CONFIG = {
  sm: { size: 80, strokeWidth: 6, fontSize: "text-sm" },
  md: { size: 120, strokeWidth: 8, fontSize: "text-lg" },
  lg: { size: 160, strokeWidth: 10, fontSize: "text-2xl" },
};

const COLOR_SCHEMES = {
  emerald: { stroke: "#10b981", bg: "rgba(16, 185, 129, 0.2)" },
  violet: { stroke: "#8b5cf6", bg: "rgba(139, 92, 246, 0.2)" },
  blue: { stroke: "#3b82f6", bg: "rgba(59, 130, 246, 0.2)" },
  amber: { stroke: "#f59e0b", bg: "rgba(245, 158, 11, 0.2)" },
};

// ============================================================================
// Main Component
// ============================================================================

export default function DonationProgressRing({
  raisedAmountMinor,
  goalAmountMinor,
  currency,
  size = "md",
  showLabels = true,
  className,
  colorScheme = "emerald",
}: DonationProgressRingProps) {
  const config = SIZE_CONFIG[size];
  const colors = COLOR_SCHEMES[colorScheme];

  const percentage = goalAmountMinor > 0
    ? Math.min((raisedAmountMinor / goalAmountMinor) * 100, 100)
    : 0;

  const radius = (config.size - config.strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative" style={{ width: config.size, height: config.size }}>
        {/* Background Ring */}
        <svg
          className="absolute inset-0 -rotate-90"
          width={config.size}
          height={config.size}
        >
          <circle
            cx={config.size / 2}
            cy={config.size / 2}
            r={radius}
            fill="none"
            stroke={colors.bg}
            strokeWidth={config.strokeWidth}
          />
          <circle
            cx={config.size / 2}
            cy={config.size / 2}
            r={radius}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Center Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-bold text-white", config.fontSize)}>
            {percentage.toFixed(0)}%
          </span>
        </div>
      </div>

      {showLabels && (
        <div className="mt-4 text-center">
          <div className="text-lg font-bold text-white">
            {formatMoney(raisedAmountMinor, currency)}
          </div>
          <div className="text-sm text-white/50">
            of {formatMoney(goalAmountMinor, currency)} goal
          </div>
        </div>
      )}
    </div>
  );
}
