// src/components/admin/students/StudentsQuickStatsSection.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  GraduationCap,
  AlertCircle,
  Star,
  TrendingUp,
} from "lucide-react";
import { useStudentStats } from "@/hooks/admin/useStudentStats";

type StatTone = "teal" | "rose" | "amber" | "emerald";

type StatCardProps = {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: StatTone;
  loading?: boolean;
  subtitle?: string;
};

const toneConfig: Record<
  StatTone,
  {
    border: string;
    bg: string;
    iconBg: string;
    iconColor: string;
    valueColor: string;
    glow: string;
  }
> = {
  teal: {
    border: "border-teal-500/30",
    bg: "from-teal-500/10 via-teal-500/5 to-transparent",
    iconBg: "from-teal-500/20 to-teal-600/20",
    iconColor: "text-teal-300",
    valueColor: "text-teal-100",
    glow: "bg-teal-500/20",
  },
  emerald: {
    border: "border-emerald-500/30",
    bg: "from-emerald-500/10 via-emerald-500/5 to-transparent",
    iconBg: "from-emerald-500/20 to-emerald-600/20",
    iconColor: "text-emerald-300",
    valueColor: "text-emerald-100",
    glow: "bg-emerald-500/20",
  },
  rose: {
    border: "border-rose-500/30",
    bg: "from-rose-500/10 via-rose-500/5 to-transparent",
    iconBg: "from-rose-500/20 to-rose-600/20",
    iconColor: "text-rose-300",
    valueColor: "text-rose-100",
    glow: "bg-rose-500/20",
  },
  amber: {
    border: "border-amber-500/30",
    bg: "from-amber-500/10 via-amber-500/5 to-transparent",
    iconBg: "from-amber-500/20 to-amber-600/20",
    iconColor: "text-amber-300",
    valueColor: "text-amber-100",
    glow: "bg-amber-500/20",
  },
};

function StatCard({
  label,
  value,
  icon,
  tone,
  loading,
  subtitle,
}: StatCardProps) {
  const config = toneConfig[tone];

  // Animated counter effect
  const [displayValue, setDisplayValue] = React.useState(0);
  React.useEffect(() => {
    if (loading) return;
    const duration = 600;
    const steps = 20;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value, loading]);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 shadow-xl shadow-black/30 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl",
        config.border,
        config.bg
      )}
    >
      {/* Glow effect */}
      <div
        className={cn(
          "pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl transition-opacity duration-300 group-hover:opacity-100",
          config.glow,
          "opacity-50"
        )}
        aria-hidden="true"
      />

      {/* Top shine */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
        aria-hidden="true"
      />

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-white/50">
            {label}
          </p>
          <div className="flex items-baseline gap-2">
            <p
              className={cn(
                "text-3xl font-bold tracking-tight tabular-nums",
                config.valueColor
              )}
            >
              {loading ? (
                <span className="inline-block h-8 w-12 animate-pulse rounded bg-white/10" />
              ) : (
                displayValue.toLocaleString()
              )}
            </p>
          </div>
          {subtitle && (
            <p className="text-[11px] text-white/40">{subtitle}</p>
          )}
        </div>

        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br shadow-inner shadow-white/5 transition-transform duration-300 group-hover:scale-110",
            config.iconBg
          )}
        >
          <span className={config.iconColor}>{icon}</span>
        </div>
      </div>
    </div>
  );
}

export function StudentsQuickStatsSection() {
  const { data, isLoading, isError } = useStudentStats();

  if (isError && !isLoading) {
    // Non-blocking: we just don't show stats if they fail
    return null;
  }

  const total = data?.total ?? 0;
  const owingCount = data?.owingCount ?? 0;
  const owingAmount = data?.owingAmount ?? 0;
  const topPerformers = data?.topPerformers ?? 0;
  const newThisMonth = data?.newThisMonth ?? 0;

  // Calculate percentages for subtitles
  const owingPercent = total > 0 ? Math.round((owingCount / total) * 100) : 0;
  const topPercent = total > 0 ? Math.round((topPerformers / total) * 100) : 0;

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
          label="Total Students"
        value={total}
        icon={<GraduationCap className="h-5 w-5" />}
        tone="teal"
          loading={isLoading}
        subtitle={`${newThisMonth} new this month`}
        />
      <StatCard
          label="Fee Defaulters"
        value={owingCount}
        icon={<AlertCircle className="h-5 w-5" />}
        tone="rose"
          loading={isLoading}
        subtitle={owingAmount > 0 ? `$${owingAmount.toLocaleString()} outstanding` : `${owingPercent}% of total`}
        />
      <StatCard
          label="Top Performers"
        value={topPerformers}
        icon={<Star className="h-5 w-5" />}
        tone="amber"
          loading={isLoading}
        subtitle={`${topPercent}% of students`}
        />
      <StatCard
          label="New This Month"
        value={newThisMonth}
        icon={<TrendingUp className="h-5 w-5" />}
        tone="emerald"
          loading={isLoading}
        subtitle="Recent enrollments"
        />
    </section>
  );
}
