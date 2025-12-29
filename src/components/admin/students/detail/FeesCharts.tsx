/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/fees/money";
import { cn } from "@/lib/utils";
import { TrendingUp, DollarSign, Calendar } from "lucide-react";
import { useStudentFeesSummary } from "@/hooks/admin/useStudentFeesSummary";

type Props = {
  studentId: string;
};

function fmtDate(iso: string | Date | null | undefined) {
  if (!iso) return "N/A";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "N/A";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(d);
}

// Simple bar chart component using divs
function SimpleBarChart({
  data,
  height = 120,
}: {
  data: Array<{ label: string; value: number; color?: string }>;
  height?: number;
}) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex items-end justify-between gap-2" style={{ height }}>
      {data.map((item, idx) => {
        const percentage = (item.value / maxValue) * 100;
        return (
          <div key={idx} className="flex-1 flex flex-col items-center gap-1">
            <div className="relative w-full" style={{ height: height - 30 }}>
              <div
                className={cn(
                  "w-full rounded-t transition-all",
                  item.color || "bg-emerald-500/30"
                )}
                style={{ height: `${percentage}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground text-center">
              {item.label}
            </div>
            <div className="text-xs font-semibold text-white/80">
              {formatMoney(item.value)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Simple line chart component using divs
function SimpleLineChart({
  data,
  height = 120,
}: {
  data: Array<{ label: string; value: number }>;
  height?: number;
}) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const minValue = Math.min(...data.map((d) => d.value), 0);

  // Normalize values to 0-100% for display
  const normalized = data.map((item) => ({
    ...item,
    normalized: ((item.value - minValue) / (maxValue - minValue || 1)) * 100,
  }));

  return (
    <div className="relative" style={{ height }}>
      <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${data.length * 40} ${height}`}>
        <polyline
          fill="none"
          stroke="rgb(34, 197, 94)"
          strokeWidth="2"
          points={normalized
            .map(
              (item, idx) =>
                `${idx * 40 + 20},${height - 20 - (item.normalized / 100) * (height - 40)}`
            )
            .join(" ")}
        />
        {normalized.map((item, idx) => (
          <circle
            key={idx}
            cx={idx * 40 + 20}
            cy={height - 20 - (item.normalized / 100) * (height - 40)}
            r="3"
            fill="rgb(34, 197, 94)"
          />
        ))}
      </svg>
      <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-muted-foreground px-2">
        {data.map((item, idx) => (
          <span key={idx} className="text-center" style={{ width: `${100 / data.length}%` }}>
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function FeesCharts({ studentId }: Props) {
  const { data: summary, isLoading } = useStudentFeesSummary(studentId);

  if (isLoading || !summary) {
    return null;
  }

  const periodBreakdown = summary.periodBreakdown || [];
  const hasMultiplePeriods = periodBreakdown.length > 1;

  // Prepare data for charts
  const paymentTrendData = periodBreakdown.slice(-6).map((period: any) => ({
    label: period.periodLabel.split(" • ")[1] || period.periodLabel.substring(0, 3),
    value: period.totalPaid,
  }));

  const outstandingBreakdownData = [
    {
      label: "Current",
      value: summary.currentPeriod.totalOutstanding,
      color: "bg-amber-500/30",
    },
    {
      label: "All Time",
      value: summary.allTime.totalOutstanding,
      color: "bg-red-500/30",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Payment Trend */}
      {hasMultiplePeriods && (
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-emerald-500/5 via-emerald-500/2 to-transparent"
            aria-hidden="true"
          />
          <CardHeader className="relative z-10 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/80">
              <TrendingUp className="h-4 w-4" />
              Payment Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="space-y-4">
              <SimpleLineChart data={paymentTrendData} height={150} />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Last {paymentTrendData.length} periods</span>
                <span className="font-semibold text-emerald-200">
                  {formatMoney(
                    paymentTrendData.reduce((sum, d) => sum + d.value, 0) /
                      paymentTrendData.length
                  )}{" "}
                  avg
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Outstanding Breakdown */}
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-amber-500/5 via-amber-500/2 to-transparent"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10 pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/80">
            <DollarSign className="h-4 w-4" />
            Outstanding Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="space-y-4">
            <SimpleBarChart data={outstandingBreakdownData} height={150} />
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-white/10 bg-white/5 p-2">
                <div className="text-muted-foreground">Current Period</div>
                <div className="mt-1 font-semibold text-amber-200">
                  {formatMoney(summary.currentPeriod.totalOutstanding)}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-2">
                <div className="text-muted-foreground">All Time</div>
                <div className="mt-1 font-semibold text-red-200">
                  {formatMoney(summary.allTime.totalOutstanding)}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Collection Rate */}
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur md:col-span-2">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-blue-500/5 via-blue-500/2 to-transparent"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10 pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/80">
            <TrendingUp className="h-4 w-4" />
            Collection Rate
          </CardTitle>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-muted-foreground">Current Period</div>
              <div className="mt-2 text-2xl font-bold text-white/90">
                {summary.currentPeriod.collectionRate}%
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {formatMoney(summary.currentPeriod.totalPaid)} /{" "}
                {formatMoney(summary.currentPeriod.totalBilled)}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-muted-foreground">All Time</div>
              <div className="mt-2 text-2xl font-bold text-white/90">
                {summary.allTime.collectionRate}%
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {formatMoney(summary.allTime.totalPaid)} /{" "}
                {formatMoney(summary.allTime.totalBilled)}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-muted-foreground">Credit Balance</div>
              <div className="mt-2 text-2xl font-bold text-sky-200">
                {formatMoney(summary.creditBalance)}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-muted-foreground">Upcoming</div>
              <div className="mt-2 text-2xl font-bold text-amber-200">
                {summary.upcomingInstallments.count}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {formatMoney(summary.upcomingInstallments.totalAmount)} due
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
