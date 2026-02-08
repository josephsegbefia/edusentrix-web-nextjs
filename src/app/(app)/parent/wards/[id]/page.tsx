// src/app/(app)/parent/wards/[id]/page.tsx
"use client";

import * as React from "react";
import { Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  GraduationCap,
  DollarSign,
  ClipboardCheck,
  TrendingUp,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  BookOpen,
  Award,
  CreditCard,
  Wallet,
  Sparkles,
  Hash,
  Users,
  UserCircle2,
  LayoutDashboard,
} from "lucide-react";
import { useWardDetail, useWardAcademics, useWardFees, useWardAttendance } from "@/hooks/parent";
import type { FeeStatus, TrendDirection } from "@/hooks/parent/useParentDashboard";
import {
  AcademicSummaryCards,
  TermSelector,
  SubjectPerformanceTable,
  SubjectStrengthsOverview,
  OverallPerformanceTrend,
  SubjectPerformanceOverTime,
  TeacherCommentsSection,
} from "@/components/parent/academics";

/* --------------------------------------------------------------------------------
   Types
-------------------------------------------------------------------------------- */
type WardDetailTabId = "overview" | "academics" | "fees" | "attendance";

type TabConfig = {
  id: WardDetailTabId;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  colors: {
    active: string;
    icon: string;
  };
};

/* --------------------------------------------------------------------------------
   Constants
-------------------------------------------------------------------------------- */
const TABS: TabConfig[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    colors: {
      active: "border-teal-500/40 bg-teal-500/15 text-teal-200 shadow-teal-500/20",
      icon: "bg-teal-500/20 text-teal-300 border-teal-500/30",
    },
  },
  {
    id: "academics",
    label: "Academics",
    icon: GraduationCap,
    colors: {
      active: "border-cyan-500/40 bg-cyan-500/15 text-cyan-200 shadow-cyan-500/20",
      icon: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    },
  },
  {
    id: "fees",
    label: "Fees & Payments",
    icon: Wallet,
    colors: {
      active: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200 shadow-emerald-500/20",
      icon: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    },
  },
  {
    id: "attendance",
    label: "Attendance",
    icon: ClipboardCheck,
    colors: {
      active: "border-amber-500/40 bg-amber-500/15 text-amber-200 shadow-amber-500/20",
      icon: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    },
  },
];

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

function getInitialTab(sp: URLSearchParams | null): WardDetailTabId {
  if (!sp) return "overview";
  const raw = sp.get("tab");
  if (raw === "overview" || raw === "academics" || raw === "fees" || raw === "attendance") {
    return raw;
  }
  return "overview";
}

/* --------------------------------------------------------------------------------
   Metric Stat Card (matching admin style)
-------------------------------------------------------------------------------- */
function MetricStatCard({
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
  tone: "teal" | "cyan" | "emerald" | "amber" | "red" | "purple" | "blue";
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
    red: {
      gradient: "from-red-500/10 via-red-500/5 to-transparent",
      iconBg: "bg-red-500/20 border-red-500/30",
      iconColor: "text-red-300",
    },
    purple: {
      gradient: "from-purple-500/10 via-purple-500/5 to-transparent",
      iconBg: "bg-purple-500/20 border-purple-500/30",
      iconColor: "text-purple-300",
    },
    blue: {
      gradient: "from-blue-500/10 via-blue-500/5 to-transparent",
      iconBg: "bg-blue-500/20 border-blue-500/30",
      iconColor: "text-blue-300",
    },
  };

  const style = tones[tone];

  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-linear-to-br from-slate-900/80 to-black p-4 shadow-lg shadow-black/30 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl">
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-linear-to-br opacity-60 transition-opacity duration-300 group-hover:opacity-100",
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
          <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-white/50">
            {label}
          </span>
        </div>
        <div className="text-xl font-bold tracking-tight text-white">
          {value}
        </div>
        {subLabel && <p className="text-[10px] text-white/40">{subLabel}</p>}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------------
   Ward Detail Header (matching admin StudentDetailHeader)
-------------------------------------------------------------------------------- */
function WardDetailHeader({
  ward,
  academics,
  fees,
}: {
  ward: {
    name: string;
    firstName: string;
    lastName: string;
    classGroup: { id: string; name: string } | null;
    grade: string | null;
    admissionNo: string | null;
    status: string;
    photoUrl: string | null;
    relationship: string;
    isPrimary: boolean;
  };
  academics?: {
    overallAverage: number | null;
    performanceTier: string | null;
    trend: TrendDirection;
    latestTermLabel?: string | null;
  } | null;
  fees?: {
    status: FeeStatus;
    totalOutstanding: number;
  } | null;
}) {
  const performanceTier = academics?.performanceTier ?? null;
  const feesStatus = fees?.status ?? null;

  return (
    <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-teal-950/40 to-transparent shadow-2xl shadow-black/40 backdrop-blur-xl">
      {/* Decorative elements */}
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
        {/* Left: Avatar + basic info */}
        <div className="flex flex-1 flex-col items-center gap-5 min-w-0 sm:flex-row sm:items-start">
          <div className="relative shrink-0">
            <Avatar className="size-24 rounded-full border-2 border-white/20 shadow-xl shadow-black/50 ring-2 ring-teal-500/20">
              {ward.photoUrl ? <AvatarImage src={ward.photoUrl} alt={ward.name} /> : null}
              <AvatarFallback className="bg-linear-to-br from-teal-600/40 to-cyan-600/40 text-2xl font-bold text-white">
                {initialsFromName(ward.name)}
              </AvatarFallback>
            </Avatar>
            {ward.status === "active" && (
              <div className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-slate-900 bg-emerald-500 shadow-lg shadow-emerald-500/30">
                <Sparkles className="h-3 w-3 text-white" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 space-y-3 text-center sm:text-left">
            {/* Name and badges */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                  {ward.name}
                </h1>
                {performanceTier === "top" && (
                  <Badge
                    variant="outline"
                    className="gap-1 rounded-lg border-amber-400/50 bg-amber-500/20 text-[10px] font-semibold text-amber-200"
                  >
                    <GraduationCap className="h-3 w-3" />
                    Top Performer
                  </Badge>
                )}
                {feesStatus === "owing" && (
                  <Badge
                    variant="outline"
                    className="gap-1 rounded-lg border-red-400/50 bg-red-500/20 text-[10px] font-semibold text-red-200"
                  >
                    <Wallet className="h-3 w-3" />
                    Owing Fees
                  </Badge>
                )}
                {ward.isPrimary && (
                  <Badge
                    variant="outline"
                    className="gap-1 rounded-lg border-cyan-400/50 bg-cyan-500/20 text-[10px] font-semibold text-cyan-200"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Primary Guardian
                  </Badge>
                )}
              </div>

              {/* Info badges */}
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                {ward.grade && (
                  <Badge className="rounded-lg border border-teal-400/30 bg-teal-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-teal-100">
                    {ward.grade}
                  </Badge>
                )}
                {ward.classGroup && (
                  <Badge
                    variant="outline"
                    className="rounded-lg border-cyan-400/30 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-cyan-100"
                  >
                    {ward.classGroup.name}
                  </Badge>
                )}
                {ward.admissionNo && (
                  <span className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/40 px-2.5 py-1 text-[10px] font-medium text-white/60">
                    <Hash className="h-3 w-3" />
                    {ward.admissionNo}
                  </span>
                )}
                <Badge
                  variant="outline"
                  className="rounded-lg border-purple-400/30 bg-purple-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-purple-200"
                >
                  <Users className="h-3 w-3 mr-1" />
                  {ward.relationship}
                </Badge>
                <span
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-[10px] font-semibold",
                    ward.status === "active" &&
                      "border-emerald-400/50 bg-emerald-500/20 text-emerald-200",
                    ward.status === "inactive" &&
                      "border-slate-400/50 bg-slate-500/20 text-slate-200",
                    ward.status === "withdrawn" &&
                      "border-red-400/50 bg-red-500/20 text-red-200"
                  )}
                >
                  {ward.status.charAt(0).toUpperCase() + ward.status.slice(1)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: quick stats */}
        <div className="flex flex-col items-stretch gap-4 lg:w-[380px]">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <MetricStatCard
              icon={UserCircle2}
              label="Academic"
              value={
                academics?.overallAverage != null
                  ? `${academics.overallAverage.toFixed(1)}%`
                  : "--"
              }
              subLabel={academics?.latestTermLabel ?? "No term data"}
              tone="teal"
            />
            <MetricStatCard
              icon={Wallet}
              label="Fees"
              value={
                fees
                  ? `GH₵ ${fees.totalOutstanding.toLocaleString()}`
                  : "--"
              }
              subLabel={
                feesStatus === "clear"
                  ? "All fees cleared"
                  : feesStatus === "partial"
                    ? "Partially paid"
                    : feesStatus === "owing"
                      ? "Outstanding balance"
                      : "No fee data"
              }
              tone={
                feesStatus === "clear"
                  ? "emerald"
                  : feesStatus === "owing"
                    ? "red"
                    : "amber"
              }
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* --------------------------------------------------------------------------------
   Ward Detail Tabs (matching admin style)
-------------------------------------------------------------------------------- */
function WardDetailTabs({
  value,
  onChange,
}: {
  value: WardDetailTabId;
  onChange: (tab: WardDetailTabId) => void;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active = tab.id === value;
        const colors = tab.colors;

        return (
          <button
            type="button"
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "group relative inline-flex items-center gap-2.5 whitespace-nowrap rounded-xl border px-4 py-2.5 text-xs font-medium transition-all duration-200",
              active
                ? cn("shadow-lg", colors.active)
                : "border-white/10 bg-white/5 text-white/60 hover:border-white/15 hover:bg-white/8 hover:text-white/80"
            )}
            aria-pressed={active}
          >
            {/* Active indicator dot */}
            {active && (
              <span className="absolute -top-0.5 left-1/2 h-1 w-6 -translate-x-1/2 rounded-full bg-current opacity-60" />
            )}

            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg border transition-all duration-200",
                active
                  ? colors.icon
                  : "border-white/10 bg-white/5 text-white/50 group-hover:border-white/15 group-hover:bg-white/8 group-hover:text-white/70"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="font-medium">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------------------------
   Fee Status Badge
-------------------------------------------------------------------------------- */
function FeeStatusBadge({ status }: { status: FeeStatus }) {
  const config: Record<FeeStatus, { icon: React.ElementType; label: string; className: string }> = {
    clear: {
      icon: CheckCircle2,
      label: "Paid",
      className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    },
    partial: {
      icon: Clock,
      label: "Partial",
      className: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    },
    owing: {
      icon: AlertCircle,
      label: "Pending",
      className: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    },
  };

  const { icon: StatusIcon, label, className } = config[status];

  return (
    <Badge variant="outline" className={cn("gap-1", className)}>
      <StatusIcon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

/* --------------------------------------------------------------------------------
   Attendance Status Badge
-------------------------------------------------------------------------------- */
function AttendanceStatusBadge({ status }: { status: string }) {
  const config: Record<string, { className: string; label: string }> = {
    present: { className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", label: "Present" },
    absent: { className: "bg-rose-500/20 text-rose-300 border-rose-500/30", label: "Absent" },
    late: { className: "bg-amber-500/20 text-amber-300 border-amber-500/30", label: "Late" },
    excused: { className: "bg-blue-500/20 text-blue-300 border-blue-500/30", label: "Excused" },
  };
  const { className, label } = config[status] || { className: "bg-white/10 text-white/60 border-white/10", label: status };
  return <Badge variant="outline" className={cn("gap-1", className)}>{label}</Badge>;
}

/* --------------------------------------------------------------------------------
   Overview Tab
-------------------------------------------------------------------------------- */
function OverviewTab({ wardId }: { wardId: string }) {
  const { data: academics, isLoading: loadingAcademics } = useWardAcademics(wardId);
  const { data: fees, isLoading: loadingFees } = useWardFees(wardId);
  const { data: attendance, isLoading: loadingAttendance } = useWardAttendance(wardId);

  const isLoading = loadingAcademics || loadingFees || loadingAttendance;

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
    );
  }

  const termAverage = academics?.summary.overallAverage ?? 0;
  const attendanceRate = attendance?.rate ?? 0;
  const feesProgress = fees?.paymentProgress ?? 0;

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricStatCard
          icon={Award}
          label="Term Average"
          value={termAverage ? `${termAverage.toFixed(1)}%` : "N/A"}
          subLabel={academics?.summary.performanceTier || "No data"}
          tone="purple"
        />
        <MetricStatCard
          icon={TrendingUp}
          label="Class Rank"
          value={academics?.summary.classPosition ? `#${academics.summary.classPosition}` : "N/A"}
          subLabel={academics?.summary.totalStudents ? `of ${academics.summary.totalStudents}` : undefined}
          tone="blue"
        />
        <MetricStatCard
          icon={ClipboardCheck}
          label="Attendance"
          value={`${attendanceRate.toFixed(1)}%`}
          subLabel={`${attendance?.daysPresent ?? 0} of ${attendance?.totalDays ?? 0} days`}
          tone={attendanceRate >= 90 ? "emerald" : attendanceRate >= 75 ? "amber" : "red"}
        />
        <MetricStatCard
          icon={Wallet}
          label="Fees Paid"
          value={`${feesProgress}%`}
          subLabel={fees ? `GH₵ ${fees.balanceDue.toLocaleString()} due` : "No fee data"}
          tone={feesProgress >= 100 ? "emerald" : feesProgress >= 50 ? "amber" : "red"}
        />
      </div>

      {/* Strongest/Weakest Subjects */}
      {(academics?.strongestSubject || academics?.weakestSubject) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {academics.strongestSubject && (
            <Card className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-linear-to-br from-emerald-950/40 to-transparent shadow-lg">
              <CardContent className="p-4">
                <h4 className="text-xs font-medium uppercase tracking-wider text-emerald-300/70 mb-2 flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  Strongest Subject
                </h4>
                <p className="font-semibold text-lg text-emerald-300">{academics.strongestSubject.subjectName}</p>
                <p className="text-sm text-emerald-300/80">{academics.strongestSubject.score.toFixed(1)}%</p>
              </CardContent>
            </Card>
          )}
          {academics.weakestSubject && (
            <Card className="relative overflow-hidden rounded-xl border border-amber-500/20 bg-linear-to-br from-amber-950/40 to-transparent shadow-lg">
              <CardContent className="p-4">
                <h4 className="text-xs font-medium uppercase tracking-wider text-amber-300/70 mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Needs Improvement
                </h4>
                <p className="font-semibold text-lg text-amber-300">{academics.weakestSubject.subjectName}</p>
                <p className="text-sm text-amber-300/80">{academics.weakestSubject.score.toFixed(1)}%</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Recent Attendance */}
      {attendance && attendance.recentRecords.length > 0 && (
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-white/60" />
              Recent Attendance
            </h3>
            <div className="space-y-2">
              {attendance.recentRecords.slice(0, 5).map((record, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/5"
                >
                  <span className="text-white">
                    {new Date(record.date).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <AttendanceStatusBadge status={record.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------------
   Academics Tab
-------------------------------------------------------------------------------- */
function AcademicsTab({ wardId }: { wardId: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const termIdParam = searchParams?.get("termId") ?? null;
  const [selectedTermId, setSelectedTermId] = React.useState<string | null>(termIdParam);

  const { data: academics, isLoading, error } = useWardAcademics(wardId, selectedTermId ?? undefined);

  // Sync selectedTermId with URL param
  React.useEffect(() => {
    const termId = searchParams?.get("termId");
    if (termId && termId !== selectedTermId) {
      setSelectedTermId(termId);
    } else if (!termId && academics?.selectedTermId) {
      setSelectedTermId(academics.selectedTermId);
    }
  }, [searchParams, academics?.selectedTermId, selectedTermId]);

  // Set initial term from DTO if not set
  React.useEffect(() => {
    if (!selectedTermId && academics?.selectedTermId) {
      setSelectedTermId(academics.selectedTermId);
    }
  }, [academics?.selectedTermId, selectedTermId]);

  const handleTermChange = React.useCallback(
    (termId: string) => {
      setSelectedTermId(termId);
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("termId", termId);
      params.set("tab", "academics");
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card
              key={i}
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl"
            >
              <CardContent className="p-4">
                <div className="h-20 animate-pulse rounded-xl bg-white/5" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !academics) {
    return (
      <div className="space-y-6">
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-cyan-500/5 via-transparent to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 px-4 py-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-linear-to-br from-cyan-500/20 to-teal-500/20">
                <BookOpen className="h-7 w-7 text-cyan-300" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold text-white">
                  Unable to load academic data
                </p>
                <p className="text-sm text-white/50">
                  Please try again later or contact the school.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const {
    summary,
    term: terms,
    subjects,
    comments,
    selectedTermLabel,
    multiTermHistory,
    subjectHistory,
    riskLevel,
    strongestSubject,
    weakestSubject,
  } = academics;

  const hasAcademicData =
    summary.overallAverage != null ||
    terms.length > 0 ||
    subjects.length > 0 ||
    comments.length > 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <AcademicSummaryCards
        summary={summary}
        periodLabel={selectedTermLabel}
        riskLevel={riskLevel}
        strongestSubject={strongestSubject}
        weakestSubject={weakestSubject}
      />

      {/* Charts Section */}
      {hasAcademicData && (
        <div className="grid gap-6 lg:grid-cols-2">
          <SubjectStrengthsOverview subjects={subjects} />
          {multiTermHistory && multiTermHistory.length > 0 && (
            <OverallPerformanceTrend history={multiTermHistory} />
          )}
        </div>
      )}

      {/* Subject Performance Over Time */}
      {hasAcademicData && subjects.length > 0 && subjectHistory && (
        <SubjectPerformanceOverTime
          subjects={subjects}
          subjectHistory={subjectHistory}
          terms={terms}
        />
      )}

      {/* Main Academic Performance Card */}
      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-linear-to-br from-cyan-500/15 via-teal-500/10 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
          aria-hidden="true"
        />

        <CardHeader className="relative z-10 flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-linear-to-br from-cyan-500/20 to-teal-500/20 shadow-inner shadow-white/5">
              <GraduationCap className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="space-y-0.5">
              <CardTitle className="text-lg font-semibold tracking-tight text-white">
                Academic Performance
              </CardTitle>
              <p className="text-xs text-white/50">
                {selectedTermLabel || "Current term"}
              </p>
            </div>
          </div>
          <TermSelector
            terms={terms}
            currentTermId={selectedTermId}
            onChange={handleTermChange}
          />
        </CardHeader>

        <CardContent className="relative z-10 space-y-4">
          {!hasAcademicData ? (
            <div className="rounded-2xl border border-white/10 bg-white/2 p-8">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-linear-to-br from-cyan-500/20 to-teal-500/20">
                  <BookOpen className="h-7 w-7 text-cyan-300" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-white">
                    No academic records yet
                  </p>
                  <p className="text-sm text-white/50">
                    Once teachers start recording grades and term results,
                    they&apos;ll appear here.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <SubjectPerformanceTable
              subjects={subjects}
              termId={selectedTermId}
            />
          )}
        </CardContent>
      </Card>

      {/* Teacher Comments */}
      <TeacherCommentsSection comments={comments} />
    </div>
  );
}

/* --------------------------------------------------------------------------------
   Fees Tab
-------------------------------------------------------------------------------- */
function FeesTab({ wardId }: { wardId: string }) {
  const { data, isLoading, error } = useWardFees(wardId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-linear-to-br from-red-950/40 to-transparent p-8 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-red-300/60 mb-4" />
        <p className="text-red-200/80">Unable to load fees data</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricStatCard
          icon={DollarSign}
          label="Total Fees"
          value={`GH₵ ${data.totalFees.toLocaleString()}`}
          tone="blue"
        />
        <MetricStatCard
          icon={CheckCircle2}
          label="Amount Paid"
          value={`GH₵ ${data.amountPaid.toLocaleString()}`}
          tone="emerald"
        />
        <MetricStatCard
          icon={AlertCircle}
          label="Balance Due"
          value={`GH₵ ${data.balanceDue.toLocaleString()}`}
          tone={data.balanceDue > 0 ? "red" : "emerald"}
        />
        <MetricStatCard
          icon={TrendingUp}
          label="Progress"
          value={`${data.paymentProgress}%`}
          tone="purple"
        />
      </div>

      {/* Payment Progress */}
      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-white/60">Payment Progress</span>
            <span className="text-sm font-medium text-white">{data.paymentProgress}%</span>
          </div>
          <Progress value={data.paymentProgress} className="h-3" />
          {data.nextDueDate && (
            <p className="text-xs text-white/50 mt-3 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              Next payment due: {new Date(data.nextDueDate).toLocaleDateString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Pending Invoices */}
      {data.invoices.length > 0 && (
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Wallet className="h-5 w-5 text-white/60" />
              Invoices
            </h3>
            <div className="space-y-2">
              {data.invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/5"
                >
                  <div>
                    <h4 className="font-medium text-white">{invoice.title}</h4>
                    <p className="text-xs text-white/50 flex items-center gap-1.5 mt-1">
                      <Clock className="h-3 w-3" />
                      Due: {new Date(invoice.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-white">
                      GH₵ {invoice.balanceDue.toLocaleString()}
                    </span>
                    <div className="mt-1">
                      <FeeStatusBadge status={invoice.status === "paid" ? "clear" : invoice.status === "partial" ? "partial" : "owing"} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Payments */}
      {data.payments.length > 0 && (
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-white/60" />
              Recent Payments
            </h3>
            <div className="space-y-2">
              {data.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/5"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-500/30">
                      <CreditCard className="h-5 w-5 text-emerald-300" />
                    </div>
                    <div>
                      <h4 className="font-medium text-white">GH₵ {payment.amount.toLocaleString()}</h4>
                      <p className="text-xs text-white/50">{payment.method} • {payment.reference}</p>
                    </div>
                  </div>
                  <span className="text-sm text-white/60">
                    {new Date(payment.date).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------------
   Attendance Tab
-------------------------------------------------------------------------------- */
function AttendanceTab({ wardId }: { wardId: string }) {
  const { data, isLoading, error } = useWardAttendance(wardId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-linear-to-br from-red-950/40 to-transparent p-8 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-red-300/60 mb-4" />
        <p className="text-red-200/80">Unable to load attendance data</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricStatCard
          icon={ClipboardCheck}
          label="Attendance Rate"
          value={`${data.rate.toFixed(1)}%`}
          tone={data.rate >= 90 ? "emerald" : data.rate >= 75 ? "amber" : "red"}
        />
        <MetricStatCard
          icon={CheckCircle2}
          label="Days Present"
          value={String(data.daysPresent)}
          subLabel={`of ${data.totalDays} days`}
          tone="emerald"
        />
        <MetricStatCard
          icon={AlertCircle}
          label="Days Absent"
          value={String(data.daysAbsent)}
          tone="red"
        />
        <MetricStatCard
          icon={Clock}
          label="Days Late"
          value={String(data.daysLate)}
          tone="amber"
        />
      </div>

      {/* Recent Records */}
      {data.recentRecords.length > 0 && (
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-white/60" />
              Recent Attendance
            </h3>
            <div className="space-y-2">
              {data.recentRecords.map((record, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/5"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-white/40" />
                    <span className="text-white">
                      {new Date(record.date).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {record.notes && (
                      <span className="text-xs text-white/50">{record.notes}</span>
                    )}
                    <AttendanceStatusBadge status={record.status} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly Breakdown */}
      {data.monthlyBreakdown.length > 0 && (
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Monthly Breakdown</h3>
            <div className="rounded-xl border border-white/10 overflow-hidden">
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr>
                    <th className="text-left p-3 text-xs font-medium uppercase text-white/50">Month</th>
                    <th className="text-center p-3 text-xs font-medium uppercase text-white/50">Present</th>
                    <th className="text-center p-3 text-xs font-medium uppercase text-white/50">Absent</th>
                    <th className="text-center p-3 text-xs font-medium uppercase text-white/50">Late</th>
                    <th className="text-right p-3 text-xs font-medium uppercase text-white/50">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.monthlyBreakdown.map((month, idx) => (
                    <tr key={idx} className="border-t border-white/10">
                      <td className="p-3 text-white">{month.month}</td>
                      <td className="p-3 text-center text-emerald-300">{month.present}</td>
                      <td className="p-3 text-center text-rose-300">{month.absent}</td>
                      <td className="p-3 text-center text-amber-300">{month.late}</td>
                      <td className="p-3 text-right text-white">
                        {month.total > 0 ? Math.round((month.present / month.total) * 100) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------------
   Main Content
-------------------------------------------------------------------------------- */
function WardDetailContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const wardId = params?.id;
  const [activeTab, setActiveTab] = React.useState<WardDetailTabId>(() =>
    getInitialTab(searchParams)
  );

  const { data: ward, isLoading, isError } = useWardDetail(wardId || "");
  const { data: academics } = useWardAcademics(wardId || "");
  const { data: fees } = useWardFees(wardId || "");

  // Sync tab → URL
  React.useEffect(() => {
    if (!wardId) return;
    const current = new URLSearchParams(searchParams?.toString() || "");
    current.set("tab", activeTab);
    const qs = current.toString();
    router.replace(qs ? `/parent/wards/${encodeURIComponent(wardId)}?${qs}` : `/parent/wards/${encodeURIComponent(wardId)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, wardId]);

  function handleTabChange(tab: WardDetailTabId) {
    setActiveTab(tab);
  }

  if (!wardId) {
    return (
      <div className="space-y-6">
        <Card className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-linear-to-br from-red-950/40 to-transparent shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-red-500/15 via-red-500/5 to-transparent" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-red-500/30 to-transparent" aria-hidden="true" />
          <CardContent className="relative z-10 flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/20">
                <AlertTriangle className="h-5 w-5 text-red-300" />
              </div>
              <div>
                <div className="font-semibold text-red-100">Missing ward identifier</div>
                <p className="text-xs text-red-200/70">The ward ID was not provided in the URL.</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push("/parent/wards")}
              className="gap-2 rounded-xl border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to My Children
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Page Header Skeleton */}
        <div className="relative">
          <div className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-teal-500/10 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -right-10 top-10 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl" aria-hidden="true" />
          <div className="relative z-10 flex items-start gap-4">
            <div className="h-10 w-10 animate-pulse rounded-xl border border-white/10 bg-white/5" />
            <div className="space-y-2">
              <div className="h-9 w-64 animate-pulse rounded-lg bg-white/10" />
              <div className="h-4 w-96 animate-pulse rounded bg-white/5" />
            </div>
          </div>
        </div>

        {/* Header Card Skeleton */}
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-teal-950/40 to-transparent shadow-2xl shadow-black/40 backdrop-blur-xl">
          <CardContent className="flex animate-pulse flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 items-center gap-4">
              <div className="size-24 rounded-full bg-white/10" />
              <div className="space-y-3">
                <div className="h-6 w-48 rounded bg-white/15" />
                <div className="flex gap-2">
                  <div className="h-5 w-20 rounded-full bg-white/10" />
                  <div className="h-5 w-24 rounded-full bg-white/10" />
                </div>
              </div>
            </div>
            <div className="hidden w-80 space-y-3 md:block">
              <div className="grid grid-cols-2 gap-3">
                <div className="h-24 rounded-xl bg-white/10" />
                <div className="h-24 rounded-xl bg-white/10" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs Skeleton */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-9 w-28 shrink-0 animate-pulse rounded-xl bg-white/10" />
          ))}
        </div>

        {/* Content Skeleton */}
        <div className="grid gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !ward) {
    return (
      <div className="space-y-6">
        <Card className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-linear-to-br from-red-950/40 to-transparent shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-red-500/15 via-red-500/5 to-transparent" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-red-500/30 to-transparent" aria-hidden="true" />
          <CardContent className="relative z-10 flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/20">
                <AlertTriangle className="h-5 w-5 text-red-300" />
              </div>
              <div>
                <div className="font-semibold text-red-100">Unable to load ward details</div>
                <p className="text-xs text-red-200/70">The ward might not exist or you might not have access.</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push("/parent/wards")}
              className="gap-2 rounded-xl border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to My Children
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative">
        {/* Decorative blurs */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-teal-500/10 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-10 top-10 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl" aria-hidden="true" />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => router.push("/parent/wards")}
              className="h-10 w-10 shrink-0 rounded-xl border border-white/10 bg-white/5 transition-all duration-200 hover:border-teal-500/30 hover:bg-teal-500/10 hover:text-teal-300"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="bg-linear-to-r from-teal-200 via-cyan-200 to-sky-300 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent lg:text-4xl">
                  My Child
                </h1>
                {ward.status === "active" && (
                  <div className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                    <Sparkles className="h-3 w-3" />
                    Active
                  </div>
                )}
              </div>
              <p className="text-sm text-white/60">
                View {ward.firstName}&apos;s academic progress, fees, and attendance
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:mt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/parent/wards")}
              className="gap-2 rounded-xl border-white/10 bg-white/5 text-xs text-white/70 hover:bg-white/10 hover:text-white"
            >
              <Users className="h-3.5 w-3.5" />
              All Children
            </Button>
          </div>
        </div>
      </div>

      {/* Ward Header */}
      <WardDetailHeader
        ward={ward}
        academics={academics ? {
          overallAverage: academics.summary.overallAverage,
          performanceTier: academics.summary.performanceTier,
          trend: academics.summary.trend,
          latestTermLabel: academics.selectedTermLabel,
        } : null}
        fees={fees ? {
          status: fees.status,
          totalOutstanding: fees.balanceDue,
        } : null}
      />

      {/* Tabs Navigation */}
      <WardDetailTabs value={activeTab} onChange={handleTabChange} />

      {/* Tab Content */}
      <div>
        {activeTab === "overview" ? (
          <OverviewTab wardId={wardId} />
        ) : activeTab === "academics" ? (
          <AcademicsTab wardId={wardId} />
        ) : activeTab === "fees" ? (
          <FeesTab wardId={wardId} />
        ) : activeTab === "attendance" ? (
          <AttendanceTab wardId={wardId} />
        ) : null}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------------
   Page Export
-------------------------------------------------------------------------------- */
export default function WardDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="relative">
            <div className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-teal-500/10 blur-3xl" aria-hidden="true" />
            <div className="relative z-10 flex items-start gap-4">
              <div className="h-10 w-10 animate-pulse rounded-xl border border-white/10 bg-white/5" />
              <div className="space-y-2">
                <div className="h-9 w-64 animate-pulse rounded-lg bg-white/10" />
                <div className="h-4 w-96 animate-pulse rounded bg-white/5" />
              </div>
            </div>
          </div>
        </div>
      }
    >
      <WardDetailContent />
    </Suspense>
  );
}
