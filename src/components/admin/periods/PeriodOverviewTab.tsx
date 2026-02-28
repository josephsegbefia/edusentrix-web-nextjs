"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Receipt,
  ClipboardList,
  Users,
  Calendar,
  BookOpen,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PeriodSummaryData } from "@/hooks/admin/usePeriodSummary";

type PeriodOverviewTabProps = {
  data: PeriodSummaryData;
};

function OverviewStatCard({
  icon: Icon,
  label,
  value,
  description,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number | React.ReactNode;
  description?: string;
  tone: "teal" | "cyan" | "emerald" | "amber" | "purple";
}) {
  const tones = {
    teal: {
      gradient: "from-teal-500/10 via-teal-500/5 to-transparent",
      iconBg: "bg-teal-500/20 border-teal-500/30",
      iconColor: "text-teal-300",
    },
    cyan: {
      gradient: "from-cyan-500/10 via-cyan-500/5 to-transparent",
      iconBg: "bg-cyan-500/20 border-cyan-500/30",
      iconColor: "text-cyan-300",
    },
    emerald: {
      gradient: "from-emerald-500/10 via-emerald-500/5 to-transparent",
      iconBg: "bg-emerald-500/20 border-emerald-500/30",
      iconColor: "text-emerald-300",
    },
    amber: {
      gradient: "from-amber-500/10 via-amber-500/5 to-transparent",
      iconBg: "bg-amber-500/20 border-amber-500/30",
      iconColor: "text-amber-300",
    },
    purple: {
      gradient: "from-purple-500/10 via-purple-500/5 to-transparent",
      iconBg: "bg-purple-500/20 border-purple-500/30",
      iconColor: "text-purple-300",
    },
  };

  const style = tones[tone];

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 to-black p-5 shadow-xl shadow-black/30 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-linear-to-br opacity-60 transition-opacity duration-300 group-hover:opacity-100",
          style.gradient
        )}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
        aria-hidden="true"
      />
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl border",
                style.iconBg
              )}
            >
              <Icon className={cn("h-5 w-5", style.iconColor)} />
            </div>
            <span className="text-[11px] font-medium uppercase tracking-[0.15em] text-white/50">
              {label}
            </span>
          </div>
          <div className="text-2xl font-bold tracking-tight text-white">
            {value}
          </div>
          {description && (
            <p className="text-[11px] text-white/40">{description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

import { formatCurrency } from "@/lib/fees/money";

export function PeriodOverviewTab({ data }: PeriodOverviewTabProps) {
  const { period, counts, revenueMinor } = data;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <OverviewStatCard
          icon={Receipt}
          label="Invoices"
          value={counts.invoices}
          description="Issued for this period"
          tone="teal"
        />
        <OverviewStatCard
          icon={ClipboardList}
          label="Assessments"
          value={counts.assessments}
          description="Recorded in this term"
          tone="cyan"
        />
        <OverviewStatCard
          icon={TrendingUp}
          label="Revenue"
          value={formatCurrency(revenueMinor)}
          description="Fees collected"
          tone="emerald"
        />
        <OverviewStatCard
          icon={Users}
          label="Teacher Assignments"
          value={counts.teacherAssignments}
          description="Active assignments"
          tone="amber"
        />
        <OverviewStatCard
          icon={BookOpen}
          label="Timetable Versions"
          value={counts.timetableVersions}
          description="Created for this period"
          tone="purple"
        />
        <OverviewStatCard
          icon={Users}
          label="Student Roles"
          value={counts.studentRoles}
          description="Class enrollments"
          tone="teal"
        />
      </div>

      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 to-black shadow-xl shadow-black/30 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-white">
            Period Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-white/50">
                Academic Activity
              </p>
              <p className="mt-2 text-sm text-white/80">
                {counts.assessments} assessments have been recorded across subjects.
                {counts.studentRoles > 0 && (
                  <> {counts.studentRoles} students are enrolled in classes.</>
                )}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-white/50">
                Finance Snapshot
              </p>
              <p className="mt-2 text-sm text-white/80">
                {counts.invoices} invoices issued. Total revenue collected:{" "}
                <span className="font-semibold text-emerald-300">
                  {formatCurrency(revenueMinor)}
                </span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
