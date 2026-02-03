// src/app/(app)/parent/attendance/page.tsx
"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { cn } from "@/lib/utils";
import {
  ClipboardCheck,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  AlertTriangle,
  Users,
  ChevronRight,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Sparkles,
  CalendarDays,
  BarChart3,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useParentAttendance } from "@/hooks/parent/useParentAttendance";
import type { WardAttendanceSummary, DailyAttendanceRecord, AttendanceStatus } from "@/hooks/parent/useParentAttendance";
import { format, parseISO } from "date-fns";

/* --------------------------------------------------------------------------------
   Helpers
-------------------------------------------------------------------------------- */
function initialsFromName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0]!.charAt(0)?.toUpperCase() ?? "";
  return (
    (parts[0]?.charAt(0)?.toUpperCase() ?? "") +
    (parts[parts.length - 1]?.charAt(0)?.toUpperCase() ?? "")
  );
}

function getStatusColor(status: AttendanceStatus): string {
  const colors: Record<AttendanceStatus, string> = {
    present: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    absent: "bg-red-500/20 text-red-300 border-red-500/30",
    late: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    excused: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  };
  return colors[status] || "bg-slate-500/20 text-slate-300";
}

function getStatusIcon(status: AttendanceStatus) {
  const icons: Record<AttendanceStatus, React.ElementType> = {
    present: CheckCircle2,
    absent: XCircle,
    late: Clock,
    excused: AlertCircle,
  };
  return icons[status] || AlertCircle;
}

function getRateColor(rate: number): string {
  if (rate >= 95) return "text-emerald-300";
  if (rate >= 85) return "text-blue-300";
  if (rate >= 75) return "text-amber-300";
  return "text-red-300";
}

/* --------------------------------------------------------------------------------
   Summary Cards
-------------------------------------------------------------------------------- */
function SummaryCard({
  icon: Icon,
  label,
  value,
  subLabel,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subLabel?: string;
  tone: "emerald" | "blue" | "amber" | "red" | "purple" | "cyan";
}) {
  const tones = {
    emerald: {
      gradient: "from-emerald-500/15 via-emerald-500/5 to-transparent",
      iconBg: "bg-emerald-500/20 border-emerald-500/30",
      iconColor: "text-emerald-300",
    },
    blue: {
      gradient: "from-blue-500/15 via-blue-500/5 to-transparent",
      iconBg: "bg-blue-500/20 border-blue-500/30",
      iconColor: "text-blue-300",
    },
    amber: {
      gradient: "from-amber-500/15 via-amber-500/5 to-transparent",
      iconBg: "bg-amber-500/20 border-amber-500/30",
      iconColor: "text-amber-300",
    },
    red: {
      gradient: "from-red-500/15 via-red-500/5 to-transparent",
      iconBg: "bg-red-500/20 border-red-500/30",
      iconColor: "text-red-300",
    },
    purple: {
      gradient: "from-purple-500/15 via-purple-500/5 to-transparent",
      iconBg: "bg-purple-500/20 border-purple-500/30",
      iconColor: "text-purple-300",
    },
    cyan: {
      gradient: "from-cyan-500/15 via-cyan-500/5 to-transparent",
      iconBg: "bg-cyan-500/20 border-cyan-500/30",
      iconColor: "text-cyan-300",
    },
  };

  const style = tones[tone];

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 to-black p-5 shadow-lg shadow-black/30 backdrop-blur-xl">
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-linear-to-br opacity-60",
          style.gradient
        )}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
        aria-hidden="true"
      />

      <div className="relative z-10 space-y-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl border",
              style.iconBg
            )}
          >
            <Icon className={cn("h-5 w-5", style.iconColor)} />
          </div>
          <span className="text-xs font-medium uppercase tracking-[0.1em] text-white/50">
            {label}
          </span>
        </div>
        <div className="text-2xl font-bold tracking-tight text-white">
          {value}
        </div>
        {subLabel && <p className="text-xs text-white/50">{subLabel}</p>}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------------
   Ward Attendance Card
-------------------------------------------------------------------------------- */
function WardAttendanceCard({
  ward,
  onClick,
}: {
  ward: WardAttendanceSummary;
  onClick: () => void;
}) {
  const TrendIcon = ward.trend === "up" ? TrendingUp : ward.trend === "down" ? TrendingDown : ArrowRight;
  const trendColor = ward.trend === "up" ? "text-emerald-400" : ward.trend === "down" ? "text-red-400" : "text-slate-400";

  return (
    <button
      onClick={onClick}
      className="group relative w-full overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-4 text-left transition-all duration-200 hover:border-white/20 hover:shadow-lg hover:scale-[1.01]"
    >
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <Avatar className="h-14 w-14 border-2 border-white/20">
          {ward.photoUrl ? (
            <AvatarImage src={ward.photoUrl} alt={ward.wardName} />
          ) : null}
          <AvatarFallback className="bg-gradient-to-br from-amber-600/40 to-orange-600/40 text-lg font-bold text-white">
            {initialsFromName(ward.wardName)}
          </AvatarFallback>
        </Avatar>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white truncate">{ward.wardName}</h3>
            {ward.rate >= 95 && (
              <Sparkles className="h-4 w-4 text-emerald-400" />
            )}
          </div>
          <p className="text-sm text-white/60">{ward.classGroup}</p>
          <div className="flex items-center gap-3 mt-2 text-xs">
            <span className="flex items-center gap-1 text-emerald-300">
              <CheckCircle2 className="h-3 w-3" />
              {ward.daysPresent}
            </span>
            <span className="flex items-center gap-1 text-red-300">
              <XCircle className="h-3 w-3" />
              {ward.daysAbsent}
            </span>
            <span className="flex items-center gap-1 text-amber-300">
              <Clock className="h-3 w-3" />
              {ward.daysLate}
            </span>
          </div>
        </div>

        {/* Rate & Trend */}
        <div className="text-right shrink-0">
          <div className={cn("text-2xl font-bold", getRateColor(ward.rate))}>
            {ward.rate.toFixed(1)}%
          </div>
          <div className={cn("flex items-center justify-end gap-1 text-xs mt-1", trendColor)}>
            <TrendIcon className="h-3.5 w-3.5" />
            <span className="capitalize">{ward.trend}</span>
          </div>
          <div className="text-[10px] text-white/40 mt-1">
            {ward.totalDays} school days
          </div>
        </div>

        <ChevronRight className="h-5 w-5 text-white/40 transition-transform group-hover:translate-x-0.5" />
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <Progress value={ward.rate} className="h-1.5" />
      </div>
    </button>
  );
}

/* --------------------------------------------------------------------------------
   Recent Record Card
-------------------------------------------------------------------------------- */
function RecentRecordCard({ record }: { record: DailyAttendanceRecord }) {
  const StatusIcon = getStatusIcon(record.status);

  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
      <div className="flex items-center gap-3">
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", getStatusColor(record.status).split(" ")[0])}>
          <StatusIcon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-white">{record.wardName}</p>
          <p className="text-xs text-white/50">
            {format(parseISO(record.date), "EEE, MMM d")}
          </p>
        </div>
      </div>
      <Badge variant="outline" className={getStatusColor(record.status)}>
        {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
      </Badge>
    </div>
  );
}

/* --------------------------------------------------------------------------------
   Monthly Chart
-------------------------------------------------------------------------------- */
function MonthlyChart({ data }: { data: Array<{ label: string; present: number; absent: number; late: number }> }) {
  if (!data.length) {
    return (
      <div className="h-64 flex items-center justify-center rounded-xl border border-dashed border-white/15 bg-black/30">
        <p className="text-xs text-white/50">No attendance data available</p>
      </div>
    );
  }

  const chartData = data.slice(0, 6).reverse().map((d) => ({
    name: d.label.split(" ")[0], // Just month name
    Present: d.present,
    Absent: d.absent,
    Late: d.late,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis
          dataKey="name"
          tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
          axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
        />
        <YAxis
          tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
          axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "rgba(15, 23, 42, 0.95)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "8px",
          }}
        />
        <Legend />
        <Bar dataKey="Present" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Absent" fill="#ef4444" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Late" fill="#f59e0b" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* --------------------------------------------------------------------------------
   Main Content
-------------------------------------------------------------------------------- */
function AttendancePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const periodIdParam = searchParams?.get("periodId") ?? null;
  const [selectedPeriodId, setSelectedPeriodId] = React.useState<string | null>(periodIdParam);

  const { data, isLoading, error } = useParentAttendance(selectedPeriodId ?? undefined);

  // Update selectedPeriodId when data loads
  React.useEffect(() => {
    if (!selectedPeriodId && data?.selectedPeriodId) {
      setSelectedPeriodId(data.selectedPeriodId);
    } else if (!selectedPeriodId && data?.availablePeriods?.length) {
      setSelectedPeriodId(data.availablePeriods[0].id);
    }
  }, [data?.selectedPeriodId, data?.availablePeriods, selectedPeriodId]);

  const handlePeriodChange = (periodId: string) => {
    setSelectedPeriodId(periodId);
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("periodId", periodId);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const handleWardClick = (wardId: string) => {
    router.push(`/parent/wards/${wardId}?tab=attendance`);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-linear-to-br from-red-950/40 to-transparent p-8 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-300/60 mb-4" />
        <p className="text-red-200/80">Failed to load attendance data. Please try again.</p>
      </Card>
    );
  }

  const {
    currentPeriod,
    availablePeriods = [],
    wards = [],
    overallSummary,
    recentRecords = [],
    monthlyBreakdown = [],
  } = data || {};

  const hasData = wards.length > 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative">
        <div
          className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-amber-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-10 top-10 h-40 w-40 rounded-full bg-orange-500/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="bg-linear-to-r from-amber-200 via-orange-200 to-red-300 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent lg:text-4xl">
                Attendance Overview
              </h1>
              {hasData && overallSummary?.averageRate != null && overallSummary.averageRate >= 95 && (
                <div className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                  <Sparkles className="h-3 w-3" />
                  Excellent
                </div>
              )}
            </div>
            <p className="text-sm text-white/60">
              Track attendance across all your children
            </p>
          </div>

          {/* Period Selector */}
          {availablePeriods.length > 0 && (
            <PremiumSelect
              value={selectedPeriodId || data?.selectedPeriodId || availablePeriods[0]?.id || ""}
              onValueChange={handlePeriodChange}
            >
              <PremiumSelectTrigger
                className="h-10 w-56 rounded-xl text-sm border-white/15 bg-white/5 hover:bg-white/10"
                icon={<CalendarDays className="h-4 w-4" />}
              >
                <PremiumSelectValue placeholder="Select academic term" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {availablePeriods.map((p) => (
                  <PremiumSelectItem
                    key={p.id}
                    value={p.id}
                    description={p.id === currentPeriod?.id ? "Current term" : undefined}
                  >
                    {p.label || p.name}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          )}
        </div>
      </div>

      {!hasData ? (
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 to-black shadow-2xl p-12 text-center">
          <div className="relative z-10 flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-linear-to-br from-amber-500/20 to-orange-500/20">
              <ClipboardCheck className="h-8 w-8 text-amber-300" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-white">No Attendance Data Yet</h3>
              <p className="text-sm text-white/60 max-w-md">
                Attendance records will appear here once teachers start marking attendance for your children.
              </p>
            </div>
            <Button asChild variant="outline" className="mt-4 gap-2 rounded-xl">
              <Link href="/parent/wards">
                <Users className="h-4 w-4" />
                View My Children
              </Link>
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              icon={BarChart3}
              label="Average Rate"
              value={overallSummary?.averageRate != null ? `${overallSummary.averageRate.toFixed(1)}%` : "--"}
              subLabel="Across all children"
              tone={overallSummary?.averageRate != null && overallSummary.averageRate >= 90 ? "emerald" : "amber"}
            />
            <SummaryCard
              icon={CheckCircle2}
              label="Days Present"
              value={String(overallSummary?.totalPresent || 0)}
              subLabel={`of ${overallSummary?.totalDays || 0} total days`}
              tone="emerald"
            />
            <SummaryCard
              icon={XCircle}
              label="Days Absent"
              value={String(overallSummary?.totalAbsent || 0)}
              subLabel="Across all children"
              tone="red"
            />
            <SummaryCard
              icon={Clock}
              label="Days Late"
              value={String(overallSummary?.totalLate || 0)}
              subLabel="Tardiness count"
              tone="amber"
            />
          </div>

          {/* Main Grid */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Ward Cards */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Users className="h-5 w-5 text-white/60" />
                  Attendance by Child
                </h2>
                <Button asChild variant="ghost" size="sm" className="gap-1 text-brand">
                  <Link href="/parent/wards">
                    View All
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <div className="space-y-3">
                {wards.map((ward) => (
                  <WardAttendanceCard
                    key={ward.wardId}
                    ward={ward}
                    onClick={() => handleWardClick(ward.wardId)}
                  />
                ))}
              </div>
            </div>

            {/* Recent Records */}
            <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 to-black shadow-lg backdrop-blur-xl">
              <div
                className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-500/10 blur-3xl"
                aria-hidden="true"
              />
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white/80">
                  <Calendar className="h-4 w-4 text-amber-300" />
                  Recent Attendance
                </CardTitle>
              </CardHeader>
              <CardContent className="relative z-10 space-y-2 max-h-80 overflow-y-auto">
                {recentRecords.length > 0 ? (
                  recentRecords.slice(0, 10).map((record, idx) => (
                    <RecentRecordCard key={idx} record={record} />
                  ))
                ) : (
                  <p className="text-xs text-white/50 text-center py-4">No recent records</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Monthly Chart */}
          <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 to-black shadow-lg backdrop-blur-xl">
            <div
              className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-orange-500/10 blur-3xl"
              aria-hidden="true"
            />
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white/80">
                <BarChart3 className="h-4 w-4 text-orange-300" />
                Monthly Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10">
              <MonthlyChart data={monthlyBreakdown} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------------
   Page Export
-------------------------------------------------------------------------------- */
export default function ParentAttendancePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-9 w-64" />
              <Skeleton className="h-4 w-96" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        </div>
      }
    >
      <AttendancePageContent />
    </Suspense>
  );
}
