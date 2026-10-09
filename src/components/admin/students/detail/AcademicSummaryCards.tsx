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

const CARD_TONES = {
  emerald: {
    tint: "from-emerald-500/10 via-emerald-500/5 to-transparent",
    well: "border-emerald-500/30 bg-emerald-500/20 text-(--ws-emerald)",
  },
  cyan: {
    tint: "from-cyan-500/10 via-cyan-500/5 to-transparent",
    well: "border-cyan-500/30 bg-cyan-500/20 text-(--ws-cyan)",
  },
  amber: {
    tint: "from-amber-500/10 via-amber-500/5 to-transparent",
    well: "border-amber-500/30 bg-amber-500/20 text-(--ws-amber)",
  },
  violet: {
    tint: "from-violet-500/10 via-violet-500/5 to-transparent",
    well: "border-violet-500/30 bg-violet-500/20 text-(--ws-violet)",
  },
  neutral: {
    tint: "from-slate-500/10 via-slate-500/5 to-transparent",
    well: "border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-70)",
  },
} as const;

const REPORT_STATUS_TONE = {
  released: "emerald",
  in_progress: "amber",
  legacy: "violet",
  neutral: "neutral",
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
  tone,
  icon,
  footer,
}: {
  title: string;
  value: string;
  subtitle: string;
  tone: keyof typeof CARD_TONES;
  icon: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const style = CARD_TONES[tone];

  return (
    <div className="relative overflow-hidden rounded-xl border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) to-(--ws-panel-to) p-4 shadow-[var(--ws-shadow)] backdrop-blur-xl">
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-linear-to-br opacity-60",
          style.tint
        )}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-(--ws-shine) to-transparent"
        aria-hidden="true"
      />
      <div className="relative z-10 space-y-2">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg border",
              style.well
            )}
          >
            {icon}
          </div>
          <span className="text-[10px] font-medium uppercase tracking-widest text-(--ws-fg-70)">
            {title}
          </span>
        </div>
        <div className="text-xl font-bold tracking-tight text-(--ws-fg)">{value}</div>
        <p className="text-[11px] text-(--ws-fg-70)">{subtitle}</p>
        {footer}
      </div>
    </div>
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
        tone="emerald"
        icon={<Percent className="h-4 w-4" />}
        footer={
          <div className="flex items-center gap-1.5 text-[11px] text-(--ws-emerald)">
            <TrendIcon trend={average.trend} />
            <span className="capitalize">{average.trendLabel}</span>
          </div>
        }
      />

      <SummaryCardShell
        title={position.title}
        value={position.value}
        subtitle={position.subtitle}
        tone="cyan"
        icon={<Users className="h-4 w-4" />}
      />

      <SummaryCardShell
        title={attendance.title}
        value={attendance.value}
        subtitle={attendance.subtitle}
        tone="cyan"
        icon={<CalendarCheck className="h-4 w-4" />}
      />

      <SummaryCardShell
        title={reportStatus.title}
        value={reportStatus.value}
        subtitle={reportStatus.subtitle}
        tone={REPORT_STATUS_TONE[reportStatus.statusTone]}
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
          className="border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to)"
        >
          <CardContent className="p-3.5">
            <div className="h-20 animate-pulse rounded-xl bg-(--ws-fill)" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
