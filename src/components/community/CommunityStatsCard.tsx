// src/components/community/CommunityStatsCard.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface CommunityStatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  tone: "violet" | "emerald" | "blue" | "amber" | "rose";
  href?: string;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const TONE_STYLES = {
  violet: {
    gradient: "from-violet-500/15 via-violet-500/5 to-transparent",
    iconBg: "bg-violet-500/20 border-violet-500/30",
    iconColor: "text-violet-300",
  },
  emerald: {
    gradient: "from-emerald-500/15 via-emerald-500/5 to-transparent",
    iconBg: "bg-emerald-500/20 border-emerald-500/30",
    iconColor: "text-emerald-300",
  },
  blue: {
    gradient: "from-blue-500/15 via-blue-500/5 to-transparent",
    iconBg: "bg-blue-500/20 border-blue-500/30",
    iconColor: "text-blue-300",
  },
  amber: {
    gradient: "from-amber-500/15 via-amber-500/5 to-transparent",
    iconBg: "bg-amber-500/20 border-amber-500/30",
    iconColor: "text-amber-300",
  },
  rose: {
    gradient: "from-rose-500/15 via-rose-500/5 to-transparent",
    iconBg: "bg-rose-500/20 border-rose-500/30",
    iconColor: "text-rose-300",
  },
};

// ============================================================================
// Main Component
// ============================================================================

export default function CommunityStatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone,
  href,
  className,
}: CommunityStatsCardProps) {
  const styles = TONE_STYLES[tone];

  const content = (
    <Card
      className={cn(
        "relative overflow-hidden border-white/10 bg-white/5 transition-all hover:border-white/20",
        href && "cursor-pointer",
        className
      )}
    >
      <div className={cn("absolute inset-0 bg-linear-to-br opacity-60", styles.gradient)} />
      <CardContent className="relative p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-white/60">{title}</p>
            <p className="mt-1 text-3xl font-bold text-white">{value}</p>
            {subtitle && <p className="mt-1 text-sm text-white/50">{subtitle}</p>}
          </div>
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-xl border",
              styles.iconBg
            )}
          >
            <Icon className={cn("h-6 w-6", styles.iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
