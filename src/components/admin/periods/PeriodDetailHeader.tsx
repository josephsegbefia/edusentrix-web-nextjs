"use client";

import * as React from "react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Receipt,
  ClipboardList,
  Users,
  Calendar,
  Star,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PeriodSummaryData } from "@/hooks/admin/usePeriodSummary";

type PeriodDetailHeaderProps = {
  data: PeriodSummaryData;
  onSetCurrent?: () => void;
  isSettingCurrent?: boolean;
};

function formatDateRange(start?: string | Date, end?: string | Date) {
  if (!start || !end) return "—";
  const s = typeof start === "string" ? new Date(start) : start;
  const e = typeof end === "string" ? new Date(end) : end;
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "—";
  return `${format(s, "dd MMM yyyy")} – ${format(e, "dd MMM yyyy")}`;
}

function formatMoneyMinor(minor: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  }).format((minor || 0) / 100);
}

function MetricStatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  tone: "teal" | "cyan" | "emerald" | "amber";
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
  };

  const style = tones[tone];

  return (
    <div className="group/card relative overflow-hidden rounded-xl border border-white/10 bg-linear-to-br from-slate-900/80 to-black p-4 shadow-lg shadow-black/30 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl">
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-linear-to-br opacity-60 transition-opacity duration-300 group-hover/card:opacity-100",
          style.gradient
        )}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
        aria-hidden="true"
      />
      <div className="relative z-10 space-y-2">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg border",
              style.iconBg
            )}
          >
            <Icon className={cn("h-4 w-4", style.iconColor)} />
          </div>
          <span className="text-[10px] font-medium uppercase tracking-widest text-white/50">
            {label}
          </span>
        </div>
        <div className="text-xl font-bold tracking-tight text-white">
          {value}
        </div>
      </div>
    </div>
  );
}

export function PeriodDetailHeader({
  data,
  onSetCurrent,
  isSettingCurrent,
}: PeriodDetailHeaderProps) {
  const { period, counts, revenueMinor } = data;

  return (
    <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-teal-950/40 to-transparent shadow-2xl shadow-black/40 backdrop-blur-xl">
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-teal-500/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-teal-500/30 to-transparent"
        aria-hidden="true"
      />

      <CardContent className="relative z-10 flex flex-col gap-6 p-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-1 flex-col gap-5 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-teal-500/30 bg-teal-500/20">
              <Calendar className="h-7 w-7 text-teal-300" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                  {period.term} {period.yearLabel}
                </h1>
                {period.isCurrent && (
                  <Badge className="gap-1 rounded-lg border-emerald-400/50 bg-emerald-500/20 text-[10px] font-semibold text-emerald-200">
                    <Star className="h-3 w-3" />
                    Current
                  </Badge>
                )}
              </div>
              <p className="text-sm text-white/60">
                {formatDateRange(period.startDate, period.endDate)}
              </p>
            </div>
          </div>

          {onSetCurrent && !period.isCurrent && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSetCurrent}
              disabled={isSettingCurrent}
              className="w-fit gap-2 rounded-xl border-teal-500/30 bg-teal-500/10 text-teal-200 hover:bg-teal-500/20"
            >
              {isSettingCurrent ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-teal-300 border-t-transparent" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Set as Current Period
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:w-[380px] lg:grid-cols-2">
          <MetricStatCard
            icon={Receipt}
            label="Invoices"
            value={counts.invoices}
            tone="teal"
          />
          <MetricStatCard
            icon={ClipboardList}
            label="Assessments"
            value={counts.assessments}
            tone="cyan"
          />
          <MetricStatCard
            icon={Users}
            label="Student Roles"
            value={counts.studentRoles}
            tone="amber"
          />
          <MetricStatCard
            icon={Receipt}
            label="Revenue"
            value={formatMoneyMinor(revenueMinor)}
            tone="emerald"
          />
        </div>
      </CardContent>
    </Card>
  );
}
