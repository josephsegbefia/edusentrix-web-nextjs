// src/components/admin/grades/GradesQuickStatsSection.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { GraduationCap, Layers, Users } from "lucide-react";
import { useGrades } from "@/hooks/admin/useGrades";

type StatTone = "blue" | "cyan" | "indigo" | "sky";

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
  blue: {
    border: "border-blue-500/30",
    bg: "from-blue-500/10 via-blue-500/5 to-transparent",
    iconBg: "from-blue-500/20 to-blue-600/20",
    iconColor: "text-blue-300",
    valueColor: "text-blue-100",
    glow: "bg-blue-500/20",
  },
  cyan: {
    border: "border-cyan-500/30",
    bg: "from-cyan-500/10 via-cyan-500/5 to-transparent",
    iconBg: "from-cyan-500/20 to-cyan-600/20",
    iconColor: "text-cyan-300",
    valueColor: "text-cyan-100",
    glow: "bg-cyan-500/20",
  },
  indigo: {
    border: "border-indigo-500/30",
    bg: "from-indigo-500/10 via-indigo-500/5 to-transparent",
    iconBg: "from-indigo-500/20 to-indigo-600/20",
    iconColor: "text-indigo-300",
    valueColor: "text-indigo-100",
    glow: "bg-indigo-500/20",
  },
  sky: {
    border: "border-sky-500/30",
    bg: "from-sky-500/10 via-sky-500/5 to-transparent",
    iconBg: "from-sky-500/20 to-sky-600/20",
    iconColor: "text-sky-300",
    valueColor: "text-sky-100",
    glow: "bg-sky-500/20",
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

export function GradesQuickStatsSection() {
  const { data, isLoading, isError } = useGrades(undefined, true);

  if (isError && !isLoading) {
    return null;
  }

  const grades = data?.data ?? [];
  const totalGrades = grades.length;
  const totalClasses = grades.reduce((sum, g) => sum + (g.classCount ?? 0), 0);
  const totalStudents = grades.reduce(
    (sum, g) => sum + (g.studentCount ?? 0),
    0
  );

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        label="Total Grades"
        value={totalGrades}
        icon={<GraduationCap className="h-5 w-5" />}
        tone="blue"
        loading={isLoading}
        subtitle="Grade levels"
      />
      <StatCard
        label="Total Classes"
        value={totalClasses}
        icon={<Layers className="h-5 w-5" />}
        tone="cyan"
        loading={isLoading}
        subtitle="Across all grades"
      />
      <StatCard
        label="Total Students"
        value={totalStudents}
        icon={<Users className="h-5 w-5" />}
        tone="indigo"
        loading={isLoading}
        subtitle="Enrolled"
      />
    </section>
  );
}
