// src/components/admin/stats/MetricStatCard.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

type MetricStatCardProps = {
  label: string;
  value: string;
  description?: string;
  icon?: React.ReactNode;
  tone?:
    | "default"
    | "success"
    | "danger"
    | "warning"
    | "info"
    | "blue"
    | "purple"
    | "cyan"
    | "orange"
    | "violet";
  loading?: boolean;
};

const toneConfig: Record<
  NonNullable<MetricStatCardProps["tone"]>,
  {
    gradient: string;
    iconBg: string;
    iconBorder: string;
    iconColor: string;
    valueColor: string;
  }
> = {
  default: {
    gradient: "from-muted/10 via-muted/5 to-transparent",
    iconBg: "bg-muted/20",
    iconBorder: "border-muted/30",
    iconColor: "text-muted-foreground",
    valueColor: "text-white",
  },
  success: {
    gradient: "from-emerald-500/15 via-emerald-500/5 to-transparent",
    iconBg: "bg-emerald-500/20",
    iconBorder: "border-emerald-500/30",
    iconColor: "text-emerald-300",
    valueColor: "text-emerald-300",
  },
  danger: {
    gradient: "from-red-500/15 via-red-500/5 to-transparent",
    iconBg: "bg-red-500/20",
    iconBorder: "border-red-500/30",
    iconColor: "text-red-300",
    valueColor: "text-red-300",
  },
  warning: {
    gradient: "from-amber-500/15 via-amber-500/5 to-transparent",
    iconBg: "bg-amber-500/20",
    iconBorder: "border-amber-500/30",
    iconColor: "text-amber-300",
    valueColor: "text-amber-300",
  },
  info: {
    gradient: "from-blue-500/15 via-blue-500/5 to-transparent",
    iconBg: "bg-blue-500/20",
    iconBorder: "border-blue-500/30",
    iconColor: "text-blue-300",
    valueColor: "text-blue-300",
  },
  blue: {
    gradient: "from-blue-500/15 via-blue-500/5 to-transparent",
    iconBg: "bg-blue-500/20",
    iconBorder: "border-blue-500/30",
    iconColor: "text-blue-300",
    valueColor: "text-blue-300",
  },
  purple: {
    gradient: "from-purple-500/15 via-purple-500/5 to-transparent",
    iconBg: "bg-purple-500/20",
    iconBorder: "border-purple-500/30",
    iconColor: "text-purple-300",
    valueColor: "text-purple-300",
  },
  cyan: {
    gradient: "from-cyan-500/15 via-cyan-500/5 to-transparent",
    iconBg: "bg-cyan-500/20",
    iconBorder: "border-cyan-500/30",
    iconColor: "text-cyan-300",
    valueColor: "text-white",
  },
  orange: {
    gradient: "from-orange-500/15 via-orange-500/5 to-transparent",
    iconBg: "bg-orange-500/20",
    iconBorder: "border-orange-500/30",
    iconColor: "text-orange-300",
    valueColor: "text-white",
  },
  violet: {
    gradient: "from-violet-500/15 via-violet-500/5 to-transparent",
    iconBg: "bg-violet-500/20",
    iconBorder: "border-violet-500/30",
    iconColor: "text-violet-300",
    valueColor: "text-amber-300",
  },
};

export function MetricStatCard({
  label,
  value,
  description,
  icon,
  tone = "default",
  loading = false,
}: MetricStatCardProps) {
  const config = toneConfig[tone];

  return (
    <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
      {/* Gradient overlay */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-linear-to-br",
          config.gradient
        )}
        aria-hidden="true"
      />

      <CardContent className="relative z-10 p-4">
        <div className="flex items-center gap-3 mb-2">
          {icon && (
            <div
              className={cn(
                "p-2 rounded-lg border",
                config.iconBg,
                config.iconBorder
              )}
            >
              <div className={cn("h-4 w-4", config.iconColor)}>{icon}</div>
            </div>
          )}
          <div className="text-xs text-white/60 uppercase tracking-wider">
            {label}
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            <div className="h-8 w-24 animate-pulse rounded bg-white/10" />
            {description && (
              <div className="h-3 w-32 animate-pulse rounded bg-white/5" />
            )}
          </div>
        ) : (
          <>
            <div className={cn("text-2xl font-bold", config.valueColor)}>
              {value}
            </div>
            {description && (
              <div className="text-xs text-white/50 mt-1">{description}</div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
