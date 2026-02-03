// src/app/(app)/parent/academics/page.tsx
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
  GraduationCap,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Award,
  AlertTriangle,
  BookOpen,
  Users,
  ChevronRight,
  BarChart3,
  Target,
  Sparkles,
  Trophy,
  Zap,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useParentAcademics } from "@/hooks/parent/useParentAcademics";
import type { WardAcademicSummary, SubjectPerformance } from "@/hooks/parent/useParentAcademics";

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

function getPerformanceTierLabel(tier: string | null): string {
  if (!tier) return "Not classified";
  const labels: Record<string, string> = {
    top: "Top Performer",
    above_average: "Above Average",
    average: "Average",
    at_risk: "Needs Support",
  };
  return labels[tier] || tier.replace("_", " ");
}

function getPerformanceTierColor(tier: string | null): string {
  if (!tier) return "bg-slate-500/20 text-slate-300 border-slate-500/30";
  const colors: Record<string, string> = {
    top: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    above_average: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    average: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    at_risk: "bg-red-500/20 text-red-300 border-red-500/30",
  };
  return colors[tier] || "bg-slate-500/20 text-slate-300 border-slate-500/30";
}

function getGradeColor(score: number | null): string {
  if (score === null) return "text-white/60";
  if (score >= 80) return "text-emerald-300";
  if (score >= 70) return "text-blue-300";
  if (score >= 60) return "text-amber-300";
  if (score >= 50) return "text-orange-300";
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
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subLabel?: string;
  tone: "emerald" | "blue" | "amber" | "purple" | "cyan" | "red";
  onClick?: () => void;
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
    red: {
      gradient: "from-red-500/15 via-red-500/5 to-transparent",
      iconBg: "bg-red-500/20 border-red-500/30",
      iconColor: "text-red-300",
    },
  };

  const style = tones[tone];
  const Wrapper: React.ElementType = onClick ? "button" : "div";

  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 to-black p-5 shadow-lg shadow-black/30 backdrop-blur-xl transition-all duration-300",
        onClick && "text-left hover:-translate-y-0.5 hover:shadow-xl hover:border-white/20 cursor-pointer"
      )}
    >
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
    </Wrapper>
  );
}

/* --------------------------------------------------------------------------------
   Ward Performance Card
-------------------------------------------------------------------------------- */
function WardPerformanceCard({
  ward,
  onClick,
}: {
  ward: WardAcademicSummary;
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
          <AvatarFallback className="bg-gradient-to-br from-cyan-600/40 to-blue-600/40 text-lg font-bold text-white">
            {initialsFromName(ward.wardName)}
          </AvatarFallback>
        </Avatar>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white truncate">{ward.wardName}</h3>
            {ward.performanceTier === "top" && (
              <Trophy className="h-4 w-4 text-amber-400" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-white/60">{ward.classGroup}</span>
            {ward.grade && (
              <>
                <span className="text-white/40">•</span>
                <span className="text-sm text-white/60">{ward.grade}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Badge
              variant="outline"
              className={cn("text-[10px]", getPerformanceTierColor(ward.performanceTier))}
            >
              {getPerformanceTierLabel(ward.performanceTier)}
            </Badge>
            {ward.classPosition && ward.totalStudents && (
              <span className="text-xs text-white/50">
                #{ward.classPosition} of {ward.totalStudents}
              </span>
            )}
          </div>
        </div>

        {/* Score & Trend */}
        <div className="text-right shrink-0">
          <div className={cn("text-2xl font-bold", getGradeColor(ward.average))}>
            {ward.average !== null ? `${ward.average.toFixed(1)}%` : "--"}
          </div>
          <div className={cn("flex items-center justify-end gap-1 text-xs mt-1", trendColor)}>
            <TrendIcon className="h-3.5 w-3.5" />
            <span className="capitalize">{ward.trend}</span>
          </div>
          <div className="text-[10px] text-white/40 mt-1">
            {ward.passedCount}/{ward.subjectCount} passed
          </div>
        </div>

        <ChevronRight className="h-5 w-5 text-white/40 transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}

/* --------------------------------------------------------------------------------
   Comparison Chart
-------------------------------------------------------------------------------- */
function ComparisonChart({
  data,
}: {
  data: Array<{ wardId: string; wardName: string; average: number | null; color: string }>;
}) {
  const chartData = data
    .filter((d) => d.average !== null)
    .map((d) => ({
      name: d.wardName.split(" ")[0], // First name only
      fullName: d.wardName,
      average: d.average || 0,
      color: d.color,
    }));

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center rounded-xl border border-dashed border-white/15 bg-black/30">
        <p className="text-xs text-white/50">No data available for comparison</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
          axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 500 }}
          axisLine={false}
          tickLine={false}
          width={80}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const data = payload[0].payload;
            return (
              <div className="rounded-lg border border-white/20 bg-slate-950/95 px-3 py-2 shadow-lg">
                <p className="text-xs font-medium text-white">{data.fullName}</p>
                <p className="text-sm font-bold text-primary-200">{data.average.toFixed(1)}%</p>
              </div>
            );
          }}
        />
        <Bar dataKey="average" radius={[0, 6, 6, 0]} maxBarSize={40}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* --------------------------------------------------------------------------------
   Subject Performance Card
-------------------------------------------------------------------------------- */
function SubjectPerformanceCard({
  subject,
  variant,
  onWardClick,
}: {
  subject: SubjectPerformance;
  variant: "top" | "needs_improvement";
  onWardClick: (wardId: string) => void;
}) {
  const isTop = variant === "top";

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border px-3 py-2.5",
        isTop
          ? "border-emerald-500/30 bg-emerald-500/10"
          : "border-amber-500/30 bg-amber-500/10"
      )}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            isTop ? "bg-emerald-500/30" : "bg-amber-500/30"
          )}
        >
          {isTop ? (
            <Award className="h-4 w-4 text-emerald-300" />
          ) : (
            <Target className="h-4 w-4 text-amber-300" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-white truncate">{subject.subjectName}</p>
          <button
            onClick={() => onWardClick(subject.wardId)}
            className={cn(
              "text-[10px] hover:underline",
              isTop ? "text-emerald-300/80" : "text-amber-300/80"
            )}
          >
            {subject.wardName}
          </button>
        </div>
      </div>
      <div className="text-right ml-3">
        <p
          className={cn(
            "text-sm font-bold",
            isTop ? "text-emerald-100" : "text-amber-100"
          )}
        >
          {subject.totalScore?.toFixed(1) ?? "--"}%
        </p>
        {subject.gradeLetter && (
          <p
            className={cn(
              "text-[10px]",
              isTop ? "text-emerald-200/70" : "text-amber-200/70"
            )}
          >
            Grade {subject.gradeLetter}
          </p>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------------
   Main Content
-------------------------------------------------------------------------------- */
function AcademicsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const periodIdParam = searchParams?.get("periodId") ?? null;
  const [selectedPeriodId, setSelectedPeriodId] = React.useState<string | null>(periodIdParam);

  const { data, isLoading, error } = useParentAcademics(selectedPeriodId ?? undefined);

  // Update selectedPeriodId when data loads (ensure we always have a valid value)
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
    router.push(`/parent/wards/${wardId}?tab=academics`);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-48" />
        </div>

        {/* Summary Cards Skeleton */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>

        {/* Content Skeleton */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-linear-to-br from-red-950/40 to-transparent p-8 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-300/60 mb-4" />
          <p className="text-red-200/80">Failed to load academic data. Please try again.</p>
        </Card>
      </div>
    );
  }

  const {
    currentPeriod,
    availablePeriods = [],
    wards = [],
    comparison = [],
    topPerformingSubjects = [],
    needsImprovementSubjects = [],
    overallSummary,
  } = data || {};

  const hasData = wards.length > 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative">
        {/* Decorative blurs */}
        <div
          className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-10 top-10 h-40 w-40 rounded-full bg-purple-500/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="bg-linear-to-r from-cyan-200 via-blue-200 to-purple-300 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent lg:text-4xl">
                Academic Progress
              </h1>
              {hasData && overallSummary?.highestPerformer && (
                <div className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                  <Sparkles className="h-3 w-3" />
                  {overallSummary.highestPerformer.wardName.split(" ")[0]} leading
                </div>
              )}
            </div>
            <p className="text-sm text-white/60">
              Compare academic performance across all your children
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
                icon={<GraduationCap className="h-4 w-4" />}
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
        /* Empty State */
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 to-black shadow-2xl p-12 text-center">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-cyan-500/5 via-transparent to-transparent"
            aria-hidden="true"
          />
          <div className="relative z-10 flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-linear-to-br from-cyan-500/20 to-purple-500/20">
              <GraduationCap className="h-8 w-8 text-cyan-300" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-white">No Academic Data Yet</h3>
              <p className="text-sm text-white/60 max-w-md">
                Academic records will appear here once teachers start recording grades for your children.
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
              label="Average Score"
              value={overallSummary?.averageAcrossWards !== null
                ? `${overallSummary.averageAcrossWards.toFixed(1)}%`
                : "--"}
              subLabel="Across all children"
              tone="cyan"
            />
            <SummaryCard
              icon={Trophy}
              label="Highest Performer"
              value={overallSummary?.highestPerformer?.wardName?.split(" ")[0] || "--"}
              subLabel={
                overallSummary?.highestPerformer && overallSummary.highestPerformer.average != null
                  ? `${overallSummary.highestPerformer.average.toFixed(1)}% average`
                  : undefined
              }
              tone="amber"
              onClick={overallSummary?.highestPerformer
                ? () => handleWardClick(overallSummary.highestPerformer!.wardId)
                : undefined}
            />
            <SummaryCard
              icon={Zap}
              label="Most Improved"
              value={overallSummary?.mostImproved?.wardName?.split(" ")[0] || "--"}
              subLabel={
                overallSummary?.mostImproved
                  ? `+${overallSummary.mostImproved.improvement.toFixed(1)}% improvement`
                  : "No improvement data"
              }
              tone="emerald"
              onClick={overallSummary?.mostImproved
                ? () => handleWardClick(overallSummary.mostImproved!.wardId)
                : undefined}
            />
            <SummaryCard
              icon={BookOpen}
              label="Total Subjects"
              value={String(overallSummary?.totalSubjects || 0)}
              subLabel="Being tracked"
              tone="purple"
            />
          </div>

          {/* Main Grid */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Ward Cards - 2 columns */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Users className="h-5 w-5 text-white/60" />
                  Performance by Child
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
                  <WardPerformanceCard
                    key={ward.wardId}
                    ward={ward}
                    onClick={() => handleWardClick(ward.wardId)}
                  />
                ))}
              </div>
            </div>

            {/* Comparison Chart - 1 column */}
            <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 to-black shadow-lg backdrop-blur-xl">
              <div
                className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-purple-500/10 blur-3xl"
                aria-hidden="true"
              />
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white/80">
                  <BarChart3 className="h-4 w-4 text-purple-300" />
                  Performance Comparison
                </CardTitle>
              </CardHeader>
              <CardContent className="relative z-10">
                <ComparisonChart data={comparison} />
              </CardContent>
            </Card>
          </div>

          {/* Subject Performance */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Top Performing Subjects */}
            <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-emerald-950/30 to-transparent shadow-lg backdrop-blur-xl">
              <div
                className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-emerald-500/10 blur-3xl"
                aria-hidden="true"
              />
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
                  <TrendingUp className="h-4 w-4" />
                  Top Performing Subjects
                </CardTitle>
                <p className="text-xs text-white/50">Highest scores across all children</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {topPerformingSubjects.length > 0 ? (
                  topPerformingSubjects.map((subject) => (
                    <SubjectPerformanceCard
                      key={`${subject.subjectId}-${subject.wardId}`}
                      subject={subject}
                      variant="top"
                      onWardClick={handleWardClick}
                    />
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-white/15 bg-black/30 px-4 py-8 text-center">
                    <p className="text-xs text-white/50">No subject data available</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Needs Improvement */}
            <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-amber-950/30 to-transparent shadow-lg backdrop-blur-xl">
              <div
                className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-500/10 blur-3xl"
                aria-hidden="true"
              />
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-200">
                  <Target className="h-4 w-4" />
                  Areas to Focus On
                </CardTitle>
                <p className="text-xs text-white/50">Subjects scoring below 60%</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {needsImprovementSubjects.length > 0 ? (
                  needsImprovementSubjects.map((subject) => (
                    <SubjectPerformanceCard
                      key={`${subject.subjectId}-${subject.wardId}`}
                      subject={subject}
                      variant="needs_improvement"
                      onWardClick={handleWardClick}
                    />
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-emerald-500/20 bg-emerald-500/5 px-4 py-8 text-center">
                    <Award className="mx-auto h-8 w-8 text-emerald-300/50 mb-2" />
                    <p className="text-xs text-emerald-200/70">All subjects above 60%!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Tips */}
          <Card className="relative overflow-hidden rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/20 border border-cyan-500/30">
                <Sparkles className="h-5 w-5 text-cyan-300" />
              </div>
              <div>
                <h4 className="font-medium text-cyan-200">Tips for Parents</h4>
                <p className="text-sm text-cyan-200/70 mt-1">
                  Click on any child&apos;s card to view their detailed academic breakdown, including
                  subject-by-subject performance, teacher comments, and progress trends over time.
                </p>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------------
   Page Export
-------------------------------------------------------------------------------- */
export default function ParentAcademicsPage() {
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
      <AcademicsPageContent />
    </Suspense>
  );
}
