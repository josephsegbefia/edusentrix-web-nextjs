// src/components/admin/subjects/SubjectsQuickStatsSection.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { BookOpen, School, Users, TrendingUp } from "lucide-react";
import { useSubjects } from "@/hooks/admin/useSubjects";
import CountUp from "react-countup";

type StatTone = "slate" | "zinc" | "neutral" | "stone";

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
  slate: {
    border: "border-slate-700/55",
    bg: "from-slate-800/50 via-slate-900/40 to-transparent",
    iconBg: "from-slate-700/35 to-slate-800/35",
    iconColor: "text-slate-200",
    valueColor: "text-slate-100",
    glow: "bg-slate-700/20",
  },
  zinc: {
    border: "border-zinc-700/55",
    bg: "from-zinc-800/50 via-zinc-900/40 to-transparent",
    iconBg: "from-zinc-700/35 to-zinc-800/35",
    iconColor: "text-zinc-200",
    valueColor: "text-zinc-100",
    glow: "bg-zinc-700/20",
  },
  neutral: {
    border: "border-neutral-700/55",
    bg: "from-neutral-800/50 via-neutral-900/40 to-transparent",
    iconBg: "from-neutral-700/35 to-neutral-800/35",
    iconColor: "text-neutral-200",
    valueColor: "text-neutral-100",
    glow: "bg-neutral-700/20",
  },
  stone: {
    border: "border-stone-700/55",
    bg: "from-stone-800/50 via-stone-900/40 to-transparent",
    iconBg: "from-stone-700/35 to-stone-800/35",
    iconColor: "text-stone-200",
    valueColor: "text-stone-100",
    glow: "bg-stone-700/20",
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
                <CountUp end={value} duration={1.5} separator="," />
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

export function SubjectsQuickStatsSection() {
  const { data, isLoading } = useSubjects();

  const subjects = data?.data || [];

  const stats = React.useMemo(() => {
    const total = subjects.length;
    const active = subjects.filter((s) => s.isActive).length;
    const totalClasses = subjects.reduce((sum, s) => sum + s.classCount, 0);
    const totalTeachers = subjects.reduce((sum, s) => sum + s.teacherCount, 0);

    return {
      total,
      active,
      totalClasses,
      totalTeachers,
    };
  }, [subjects]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total Subjects"
        value={stats.total}
        icon={<BookOpen className="h-5 w-5" />}
        tone="slate"
        loading={isLoading}
      />
      <StatCard
        label="Active Subjects"
        value={stats.active}
        icon={<TrendingUp className="h-5 w-5" />}
        tone="zinc"
        loading={isLoading}
        subtitle={`${stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}% of total`}
      />
      <StatCard
        label="Classes Teaching"
        value={stats.totalClasses}
        icon={<School className="h-5 w-5" />}
        tone="neutral"
        loading={isLoading}
        subtitle="Total class assignments"
      />
      <StatCard
        label="Teachers Assigned"
        value={stats.totalTeachers}
        icon={<Users className="h-5 w-5" />}
        tone="stone"
        loading={isLoading}
        subtitle="Teaching subjects"
      />
    </div>
  );
}
