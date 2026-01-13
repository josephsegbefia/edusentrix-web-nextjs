// src/components/admin/subjects/SubjectsQuickStatsSection.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { BookOpen, School, Users, TrendingUp } from "lucide-react";
import { useSubjects } from "@/hooks/admin/useSubjects";
import CountUp from "react-countup";

type StatTone = "rose" | "pink" | "fuchsia" | "violet";

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
  rose: {
    border: "border-rose-500/30",
    bg: "from-rose-500/10 via-rose-500/5 to-transparent",
    iconBg: "from-rose-500/20 to-rose-600/20",
    iconColor: "text-rose-300",
    valueColor: "text-rose-100",
    glow: "bg-rose-500/20",
  },
  pink: {
    border: "border-pink-500/30",
    bg: "from-pink-500/10 via-pink-500/5 to-transparent",
    iconBg: "from-pink-500/20 to-pink-600/20",
    iconColor: "text-pink-300",
    valueColor: "text-pink-100",
    glow: "bg-pink-500/20",
  },
  fuchsia: {
    border: "border-fuchsia-500/30",
    bg: "from-fuchsia-500/10 via-fuchsia-500/5 to-transparent",
    iconBg: "from-fuchsia-500/20 to-fuchsia-600/20",
    iconColor: "text-fuchsia-300",
    valueColor: "text-fuchsia-100",
    glow: "bg-fuchsia-500/20",
  },
  violet: {
    border: "border-violet-500/30",
    bg: "from-violet-500/10 via-violet-500/5 to-transparent",
    iconBg: "from-violet-500/20 to-violet-600/20",
    iconColor: "text-violet-300",
    valueColor: "text-violet-100",
    glow: "bg-violet-500/20",
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
            <p className="text-xs text-white/40">{subtitle}</p>
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
        tone="rose"
        loading={isLoading}
      />
      <StatCard
        label="Active Subjects"
        value={stats.active}
        icon={<BookOpen className="h-5 w-5" />}
        tone="pink"
        loading={isLoading}
        subtitle={`${stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}% of total`}
      />
      <StatCard
        label="Classes Teaching"
        value={stats.totalClasses}
        icon={<School className="h-5 w-5" />}
        tone="fuchsia"
        loading={isLoading}
        subtitle="Total class assignments"
      />
      <StatCard
        label="Teachers Assigned"
        value={stats.totalTeachers}
        icon={<Users className="h-5 w-5" />}
        tone="violet"
        loading={isLoading}
        subtitle="Teaching subjects"
      />
    </div>
  );
}
