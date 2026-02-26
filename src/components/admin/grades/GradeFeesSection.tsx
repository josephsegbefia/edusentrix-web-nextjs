"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/fees/money";
import Link from "next/link";
import {
  DollarSign,
  TrendingUp,
  AlertCircle,
  Receipt,
  Users,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { useGradeFees } from "@/hooks/admin/useGrades";
import { cn } from "@/lib/utils";

type Props = {
  gradeId: string;
  gradeName: string;
};

function MetricBlock({
  label,
  value,
  icon: Icon,
  tone,
  loading,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  tone: "teal" | "emerald" | "rose" | "amber";
  loading?: boolean;
}) {
  const config: Record<
    string,
    { border: string; bg: string; iconBg: string; valueColor: string }
  > = {
    teal: {
      border: "border-teal-500/30",
      bg: "from-teal-500/10 to-teal-500/5",
      iconBg: "bg-teal-500/20 text-teal-300",
      valueColor: "text-teal-100",
    },
    emerald: {
      border: "border-emerald-500/30",
      bg: "from-emerald-500/10 to-emerald-500/5",
      iconBg: "bg-emerald-500/20 text-emerald-300",
      valueColor: "text-emerald-100",
    },
    rose: {
      border: "border-rose-500/30",
      bg: "from-rose-500/10 to-rose-500/5",
      iconBg: "bg-rose-500/20 text-rose-300",
      valueColor: "text-rose-100",
    },
    amber: {
      border: "border-amber-500/30",
      bg: "from-amber-500/10 to-amber-500/5",
      iconBg: "bg-amber-500/20 text-amber-300",
      valueColor: "text-amber-100",
    },
  };
  const c = config[tone];

  return (
    <div
      className={cn(
        "rounded-xl border bg-linear-to-br p-4 transition-all",
        c.border,
        c.bg
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-white/50">
            {label}
          </p>
          <p
            className={cn(
              "mt-1 text-xl font-bold tabular-nums",
              c.valueColor
            )}
          >
            {loading ? (
              <span className="inline-block h-6 w-20 animate-pulse rounded bg-white/10" />
            ) : (
              value
            )}
          </p>
        </div>
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            c.iconBg
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

export function GradeFeesSection({ gradeId, gradeName }: Props) {
  const { data, isLoading, isError } = useGradeFees(gradeId);
  const fees = data?.data;

  if (isError) {
    return (
      <Card className="rounded-xl border border-rose-500/30 bg-rose-500/5">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12">
          <AlertCircle className="h-10 w-10 text-rose-400" />
          <p className="text-sm text-rose-200">Failed to load fee analytics</p>
        </CardContent>
      </Card>
    );
  }

  const hasData =
    fees &&
    (fees.totalBilledMinor > 0 ||
      fees.totalOutstandingMinor > 0 ||
      fees.invoiceCount > 0);

  return (
    <div className="space-y-6">
      {/* Summary metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricBlock
          label="Total Billed"
          value={fees ? formatMoney(fees.totalBilledMinor) : "—"}
          icon={DollarSign}
          tone="teal"
          loading={isLoading}
        />
        <MetricBlock
          label="Total Collected"
          value={fees ? formatMoney(fees.totalPaidMinor) : "—"}
          icon={TrendingUp}
          tone="emerald"
          loading={isLoading}
        />
        <MetricBlock
          label="Outstanding"
          value={fees ? formatMoney(fees.totalOutstandingMinor) : "—"}
          icon={Receipt}
          tone="amber"
          loading={isLoading}
        />
        <MetricBlock
          label="Collection Rate"
          value={fees ? `${fees.collectionRate}%` : "—"}
          icon={TrendingUp}
          tone="emerald"
          loading={isLoading}
        />
      </div>

      {/* Fee defaulters CTA */}
      {fees && fees.feeDefaultersCount > 0 && (
        <Link
          href={`/admin/students?gradeId=${gradeId}&tab=fee-defaulters`}
          className="block"
        >
          <div className="flex items-center justify-between gap-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 transition-colors hover:border-rose-500/40 hover:bg-rose-500/15">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-rose-400" />
              <div>
                <p className="font-medium text-rose-200">
                  {fees.feeDefaultersCount} student
                  {fees.feeDefaultersCount !== 1 ? "s" : ""} with outstanding fees
                </p>
                <p className="text-xs text-rose-300/80">
                  View and follow up on fee defaulters
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-rose-400" />
          </div>
        </Link>
      )}

      {/* By class breakdown */}
      {fees && fees.byClass.length > 0 && (
        <Card className="overflow-hidden rounded-xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black">
          <CardHeader className="border-b border-white/5">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
              <Users className="h-4 w-4 text-teal-300" />
              Fees by class
            </CardTitle>
            <p className="text-xs text-white/50">
              Collection breakdown per class in {gradeName}
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="px-4 py-3 text-left font-medium text-white/70">
                      Class
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-white/70">
                      Billed
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-white/70">
                      Collected
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-white/70">
                      Outstanding
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-white/70">
                      Rate
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {fees.byClass.map((row) => (
                    <tr
                      key={row.classGroupId}
                      className="border-b border-white/5 last:border-0"
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-white">
                          {row.className}
                        </span>
                        <span className="ml-2 text-xs text-white/50">
                          ({row.studentCount} students)
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-white/90 tabular-nums">
                        {formatMoney(row.totalBilledMinor)}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-300 tabular-nums">
                        {formatMoney(row.totalPaidMinor)}
                      </td>
                      <td className="px-4 py-3 text-right text-amber-300 tabular-nums">
                        {formatMoney(row.totalOutstandingMinor)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span
                          className={
                            row.collectionRate >= 80
                              ? "text-emerald-300"
                              : row.collectionRate >= 50
                              ? "text-amber-300"
                              : "text-rose-300"
                          }
                        >
                          {row.collectionRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!isLoading && !hasData && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-white/10 bg-white/5 py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5">
            <DollarSign className="h-7 w-7 text-white/40" />
          </div>
          <div className="text-center">
            <p className="font-medium text-white/80">No fee data yet</p>
            <p className="mt-1 text-sm text-white/50">
              Fee analytics will appear once invoices are issued for students in{" "}
              {gradeName}
            </p>
          </div>
          <Link
            href="/admin/fees"
            className="inline-flex items-center gap-2 rounded-lg border border-teal-500/30 bg-teal-500/10 px-4 py-2 text-sm font-medium text-teal-200 transition-colors hover:bg-teal-500/20"
          >
            Go to Fees
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
