"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { BookOpen, ClipboardCheck, Users, CalendarCheck2 } from "lucide-react";

type StatTone = "indigo" | "emerald" | "amber" | "rose";

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
  amber: {
    border: "border-amber-500/30",
    bg: "from-amber-500/10 via-amber-500/5 to-transparent",
    iconBg: "from-amber-500/20 to-amber-600/20",
    iconColor: "text-amber-300",
    valueColor: "text-amber-100",
    glow: "bg-amber-500/20",
  },
  rose: {
    border: "border-rose-500/30",
    bg: "from-rose-500/10 via-rose-500/5 to-transparent",
    iconBg: "from-rose-500/20 to-rose-600/20",
    iconColor: "text-rose-300",
    valueColor: "text-rose-100",
    glow: "bg-rose-500/20",
  },
};

type StatCardProps = {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: StatTone;
  loading?: boolean;
  subtitle?: string;
};

function StatCard({ label, value, icon, tone, loading, subtitle }: StatCardProps) {
  const config = toneConfig[tone];

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 shadow-xl shadow-black/30 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl",
        config.border,
        config.bg
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl transition-opacity duration-300 group-hover:opacity-100",
          config.glow,
          "opacity-50"
        )}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
        aria-hidden="true"
      />

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-white/50">
            {label}
          </p>
          <p
            className={cn(
              "text-3xl font-bold tracking-tight tabular-nums",
              config.valueColor
            )}
          >
            {loading ? (
              <span className="inline-block h-8 w-12 animate-pulse rounded bg-white/10" />
            ) : (
              value.toLocaleString()
            )}
          </p>
          {subtitle && <p className="text-[11px] text-white/40">{subtitle}</p>}
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

type DashboardStatsProps = {
  stats?: {
    totalClasses: number;
    totalStudents: number;
    pendingToMark: number;
    todayAttendanceTaken: boolean;
  };
  loading?: boolean;
};

export function DashboardStats({ stats, loading }: DashboardStatsProps) {
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Classes"
        value={stats?.totalClasses ?? 0}
        icon={<BookOpen className="h-5 w-5" />}
        tone="indigo"
        loading={loading}
        subtitle="Assigned this term"
      />
      <StatCard
        label="Students"
        value={stats?.totalStudents ?? 0}
        icon={<Users className="h-5 w-5" />}
        tone="emerald"
        loading={loading}
        subtitle="Across your classes"
      />
      <StatCard
        label="To Mark"
        value={stats?.pendingToMark ?? 0}
        icon={<ClipboardCheck className="h-5 w-5" />}
        tone="amber"
        loading={loading}
        subtitle="Pending submissions"
      />
      <StatCard
        label="Attendance"
        value={stats?.todayAttendanceTaken ? 1 : 0}
        icon={<CalendarCheck2 className="h-5 w-5" />}
        tone={stats?.todayAttendanceTaken ? "emerald" : "rose"}
        loading={loading}
        subtitle={
          stats?.todayAttendanceTaken
            ? "Marked today"
            : "Not taken yet"
        }
      />
    </section>
  );
}
