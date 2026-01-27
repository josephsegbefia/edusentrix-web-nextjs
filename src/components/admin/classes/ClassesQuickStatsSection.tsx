// src/components/admin/classes/ClassesQuickStatsSection.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { School, Users, BookOpen, UserCheck } from "lucide-react";
import { useClasses } from "@/hooks/admin/useClasses";
import CountUp from "react-countup";

type StatTone = "emerald" | "green" | "lime" | "teal";

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
  emerald: {
    border: "border-emerald-500/30",
    bg: "from-emerald-500/10 via-emerald-500/5 to-transparent",
    iconBg: "from-emerald-500/20 to-emerald-600/20",
    iconColor: "text-emerald-300",
    valueColor: "text-emerald-100",
    glow: "bg-emerald-500/20",
  },
  green: {
    border: "border-green-500/30",
    bg: "from-green-500/10 via-green-500/5 to-transparent",
    iconBg: "from-green-500/20 to-green-600/20",
    iconColor: "text-green-300",
    valueColor: "text-green-100",
    glow: "bg-green-500/20",
  },
  lime: {
    border: "border-lime-500/30",
    bg: "from-lime-500/10 via-lime-500/5 to-transparent",
    iconBg: "from-lime-500/20 to-lime-600/20",
    iconColor: "text-lime-300",
    valueColor: "text-lime-100",
    glow: "bg-lime-500/20",
  },
  teal: {
    border: "border-teal-500/30",
    bg: "from-teal-500/10 via-teal-500/5 to-transparent",
    iconBg: "from-teal-500/20 to-teal-600/20",
    iconColor: "text-teal-300",
    valueColor: "text-teal-100",
    glow: "bg-teal-500/20",
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

export function ClassesQuickStatsSection() {
  const { data, isLoading } = useClasses();

  const classes = data?.data || [];

  const stats = React.useMemo(() => {
    const total = classes.length;
    const active = classes.filter((c) => c.isActive).length;
    const withHomeroom = classes.filter((c) => c.homeroomTeacher).length;
    const totalStudents = classes.reduce((sum, c) => sum + c.studentCount, 0);
    const avgStudents = total > 0 ? Math.round(totalStudents / total) : 0;

    return {
      total,
      active,
      withHomeroom,
      totalStudents,
      avgStudents,
    };
  }, [classes]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total Classes"
        value={stats.total}
        icon={<School className="h-5 w-5" />}
        tone="emerald"
        loading={isLoading}
      />
      <StatCard
        label="Active Classes"
        value={stats.active}
        icon={<School className="h-5 w-5" />}
        tone="green"
        loading={isLoading}
        subtitle={`${stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}% of total`}
      />
      <StatCard
        label="With Homeroom"
        value={stats.withHomeroom}
        icon={<UserCheck className="h-5 w-5" />}
        tone="lime"
        loading={isLoading}
        subtitle={`${stats.total > 0 ? Math.round((stats.withHomeroom / stats.total) * 100) : 0}% assigned`}
      />
      <StatCard
        label="Total Students"
        value={stats.totalStudents}
        icon={<Users className="h-5 w-5" />}
        tone="teal"
        loading={isLoading}
        subtitle={`Avg: ${stats.avgStudents} per class`}
      />
    </div>
  );
}
