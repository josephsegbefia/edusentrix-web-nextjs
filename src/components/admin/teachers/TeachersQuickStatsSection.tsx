// src/components/admin/teachers/TeachersQuickStatsSection.tsx
"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Users,
  UserCheck,
  UserX,
  Home,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useTeacherStats } from "@/hooks/admin/useTeacherStats";

type StatTone = "indigo" | "emerald" | "rose" | "amber";

type StatCardProps = {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: StatTone;
  loading?: boolean;
  trend?: { value: number; label: string } | null;
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
  indigo: {
    border: "border-indigo-500/30",
    bg: "from-indigo-500/10 via-indigo-500/5 to-transparent",
    iconBg: "from-indigo-500/20 to-indigo-600/20",
    iconColor: "text-indigo-300",
    valueColor: "text-indigo-100",
    glow: "bg-indigo-500/20",
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
  trend,
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
            {trend && !loading && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  trend.value >= 0
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-rose-500/20 text-rose-300"
                )}
              >
                {trend.value >= 0 ? (
                  <TrendingUp className="h-2.5 w-2.5" />
                ) : (
                  <TrendingDown className="h-2.5 w-2.5" />
                )}
                {Math.abs(trend.value)}%
              </span>
            )}
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

export function TeachersQuickStatsSection() {
  const { data, isLoading } = useTeacherStats();
  const stats = data?.data;

  // Calculate percentages for subtitles
  const total = stats?.total ?? 0;
  const activePercent = total > 0 ? Math.round(((stats?.active ?? 0) / total) * 100) : 0;
  const inactivePercent = total > 0 ? Math.round(((stats?.inactive ?? 0) / total) * 100) : 0;
  const homeroomPercent = total > 0 ? Math.round(((stats?.homeroom ?? 0) / total) * 100) : 0;

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total Teachers"
        value={stats?.total ?? 0}
        icon={<Users className="h-5 w-5" />}
        tone="indigo"
        loading={isLoading}
        subtitle="All staff members"
      />
      <StatCard
        label="Active"
        value={stats?.active ?? 0}
        icon={<UserCheck className="h-5 w-5" />}
        tone="emerald"
        loading={isLoading}
        subtitle={`${activePercent}% of total`}
      />
      <StatCard
        label="Inactive"
        value={stats?.inactive ?? 0}
        icon={<UserX className="h-5 w-5" />}
        tone="rose"
        loading={isLoading}
        subtitle={`${inactivePercent}% of total`}
      />
      <StatCard
        label="Homeroom"
        value={stats?.homeroom ?? 0}
        icon={<Home className="h-5 w-5" />}
        tone="amber"
        loading={isLoading}
        subtitle={`${homeroomPercent}% assigned`}
      />
    </section>
  );
}
