// src/components/parent/academics/AcademicSummaryCards.tsx
"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

type TrendDirection = "up" | "down" | "stable";
type RiskLevel = "low" | "medium" | "high";
type PerformanceTier = "top" | "above_average" | "average" | "at_risk";

function TrendIcon({ trend }: { trend: TrendDirection }) {
  if (trend === "up") {
    return <ArrowUpRight className="h-4 w-4 text-emerald-400" />;
  }
  if (trend === "down") {
    return <ArrowDownRight className="h-4 w-4 text-red-400" />;
  }
  return <ArrowRight className="h-4 w-4 text-slate-400" />;
}

type AcademicSummaryCardsProps = {
  summary: {
    overallAverage: number | null;
    classPosition: number | null;
    totalStudents: number | null;
    performanceTier: PerformanceTier | null;
    trend: TrendDirection;
    trendDelta: number | null;
  };
  periodLabel?: string | null;
  riskLevel?: RiskLevel;
  strongestSubject?: { subjectName: string; score: number } | null;
  weakestSubject?: { subjectName: string; score: number } | null;
};

export function AcademicSummaryCards({
  summary,
  periodLabel,
  riskLevel,
  strongestSubject,
  weakestSubject,
}: AcademicSummaryCardsProps) {
  const {
    overallAverage,
    classPosition,
    totalStudents,
    performanceTier,
    trend,
  } = summary;

  const riskColors = {
    low: "from-emerald-500/10 via-emerald-500/5",
    medium: "from-amber-500/10 via-amber-500/5",
    high: "from-red-500/10 via-red-500/5",
  };

  const riskTextColors = {
    low: "text-emerald-200/90",
    medium: "text-amber-200/90",
    high: "text-red-200/90",
  };

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      <Card className="border-white/10 bg-linear-to-br from-emerald-500/10 via-emerald-500/5 to-slate-950/80 shadow-inner shadow-emerald-500/10">
        <CardContent className="flex flex-col gap-1.5 p-3.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-emerald-200/90">
            Overall Average
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-emerald-50">
              {typeof overallAverage === "number"
                ? `${overallAverage.toFixed(1)}%`
                : "--"}
            </span>
            {periodLabel && (
              <span className="text-[11px] text-emerald-200/80">
                {periodLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-100/80">
            <TrendIcon trend={trend} />
            <span className="capitalize">{trend}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-linear-to-br from-sky-500/10 via-sky-500/5 to-slate-950/80">
        <CardContent className="flex flex-col gap-1.5 p-3.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-sky-200/90">
            Class Position
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-sky-50">
              {typeof classPosition === "number" ? `#${classPosition}` : "--"}
            </span>
            <span className="text-[11px] text-sky-200/80">
              {typeof totalStudents === "number" ? `of ${totalStudents}` : ""}
            </span>
          </div>
          <span className="text-[11px] text-sky-100/80">
            Relative to classmates this term
          </span>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-linear-to-br from-amber-500/10 via-amber-500/5 to-slate-950/80">
        <CardContent className="flex flex-col gap-1.5 p-3.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-amber-200/90">
            Performance Tier
          </span>
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-semibold",
                "bg-amber-500/20 text-amber-100 border border-amber-400/40"
              )}
            >
              {performanceTier
                ? performanceTier.replace("_", " ")
                : "Not classified"}
            </span>
          </div>
          <span className="text-[11px] text-amber-100/80">
            Based on term average
          </span>
        </CardContent>
      </Card>

      <Card
        className={cn(
          "border-white/10 bg-linear-to-br to-slate-950/80 shadow-inner",
          riskLevel
            ? riskColors[riskLevel]
            : "from-slate-500/10 via-slate-500/5"
        )}
      >
        <CardContent className="flex flex-col gap-1.5 p-3.5">
          <span
            className={cn(
              "text-[11px] font-medium uppercase tracking-wide",
              riskLevel ? riskTextColors[riskLevel] : "text-slate-200/90"
            )}
          >
            Performance Status
          </span>
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-semibold border",
                riskLevel === "high"
                  ? "bg-red-500/20 text-red-100 border-red-400/40"
                  : riskLevel === "medium"
                  ? "bg-amber-500/20 text-amber-100 border-amber-400/40"
                  : riskLevel === "low"
                  ? "bg-emerald-500/20 text-emerald-100 border-emerald-400/40"
                  : "bg-slate-500/20 text-slate-100 border-slate-400/40"
              )}
            >
              {riskLevel === "low" ? "On Track" : riskLevel === "medium" ? "Needs Support" : riskLevel === "high" ? "At Risk" : "N/A"}
            </span>
          </div>
          <div className="space-y-0.5 text-[10px] text-slate-100/70">
            {strongestSubject && (
              <p>
                Strongest: {strongestSubject.subjectName} (
                {strongestSubject.score.toFixed(1)}%)
              </p>
            )}
            {weakestSubject && (
              <p>
                Needs Focus: {weakestSubject.subjectName} (
                {weakestSubject.score.toFixed(1)}%)
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
