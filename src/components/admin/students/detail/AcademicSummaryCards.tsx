"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarCheck,
  ClipboardList,
  Percent,
  Users,
} from "lucide-react";
import {
  buildAcademicSummaryCardsFromLegacySummary,
  buildAcademicSummaryCardsFromProfile,
  type AcademicSummaryCardsModel,
} from "@/lib/academics/profile/academic-summary-cards-utils";
import { buildLearnerAcademicSummaryCardsFromProfile } from "@/lib/academics/profile/learner-academic-profile-utils";
import type { StudentAcademicProfileDTO } from "@/types/academics/student-academic-profile";
import type { StudentAcademicsSummaryDTO, StudentTermTrend } from "@/types/admin/student-academics";
import { cn } from "@/lib/utils";

function TrendIcon({ trend }: { trend: StudentTermTrend }) {
  if (trend === "up") {
    return <ArrowUpRight className="h-4 w-4 text-emerald-400" />;
  }
  if (trend === "down") {
    return <ArrowDownRight className="h-4 w-4 text-red-400" />;
  }
  return <ArrowRight className="h-4 w-4 text-slate-400" />;
}

const REPORT_STATUS_STYLES = {
  released: "from-emerald-500/10 via-emerald-500/5",
  in_progress: "from-amber-500/10 via-amber-500/5",
  legacy: "from-violet-500/10 via-violet-500/5",
  neutral: "from-slate-500/10 via-slate-500/5",
} as const;

type AcademicSummaryCardsProps = {
  profile?: StudentAcademicProfileDTO | null;
  /** Legacy fallback when profile API is unavailable. */
  legacySummary?: StudentAcademicsSummaryDTO | null;
  periodLabel?: string | null;
  /** Use simpler copy for parent/student surfaces. */
  audience?: "staff" | "learner";
};

function SummaryCardShell({
  title,
  value,
  subtitle,
  gradient,
  icon,
  footer,
}: {
  title: string;
  value: string;
  subtitle: string;
  gradient: string;
  icon: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Card
      className={cn(
        "border-white/10 bg-linear-to-br to-slate-950/80 shadow-inner",
        gradient
      )}
    >
      <CardContent className="flex flex-col gap-1.5 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-white/70">
            {title}
          </span>
          <span className="text-white/35">{icon}</span>
        </div>
        <span className="text-2xl font-semibold text-white">{value}</span>
        <span className="text-[11px] text-white/55">{subtitle}</span>
        {footer}
      </CardContent>
    </Card>
  );
}

export function AcademicSummaryCards({
  profile,
  legacySummary,
  periodLabel,
  audience = "staff",
}: AcademicSummaryCardsProps) {
  const model: AcademicSummaryCardsModel | null = React.useMemo(() => {
    if (profile) {
      const useLearnerCopy =
        audience === "learner" ||
        profile.visibilityMode === "parent" ||
        profile.visibilityMode === "student";
      return useLearnerCopy
        ? buildLearnerAcademicSummaryCardsFromProfile(profile)
        : buildAcademicSummaryCardsFromProfile(profile);
    }
    if (legacySummary) {
      return buildAcademicSummaryCardsFromLegacySummary({
        summary: legacySummary,
        periodLabel,
      });
    }
    return null;
  }, [profile, legacySummary, periodLabel, audience]);

  if (!model) {
    return null;
  }

  const { average, position, attendance, reportStatus } = model;

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      <SummaryCardShell
        title={average.title}
        value={average.value}
        subtitle={average.subtitle}
        gradient="from-emerald-500/10 via-emerald-500/5 shadow-emerald-500/10"
        icon={<Percent className="h-4 w-4" />}
        footer={
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-100/80">
            <TrendIcon trend={average.trend} />
            <span className="capitalize">{average.trendLabel}</span>
          </div>
        }
      />

      <SummaryCardShell
        title={position.title}
        value={position.value}
        subtitle={position.subtitle}
        gradient="from-sky-500/10 via-sky-500/5"
        icon={<Users className="h-4 w-4" />}
      />

      <SummaryCardShell
        title={attendance.title}
        value={attendance.value}
        subtitle={attendance.subtitle}
        gradient="from-cyan-500/10 via-cyan-500/5"
        icon={<CalendarCheck className="h-4 w-4" />}
      />

      <SummaryCardShell
        title={reportStatus.title}
        value={reportStatus.value}
        subtitle={reportStatus.subtitle}
        gradient={cn(REPORT_STATUS_STYLES[reportStatus.statusTone], "shadow-black/20")}
        icon={<ClipboardList className="h-4 w-4" />}
      />
    </div>
  );
}

export function AcademicSummaryCardsSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map((key) => (
        <Card
          key={key}
          className="border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black"
        >
          <CardContent className="p-3.5">
            <div className="h-20 animate-pulse rounded-xl bg-white/5" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
