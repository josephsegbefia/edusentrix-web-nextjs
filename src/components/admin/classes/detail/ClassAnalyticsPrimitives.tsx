"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LeoIcon } from "@/components/icons/LeoIcon";
import { cn } from "@/lib/utils";

type Tone = "emerald" | "blue" | "amber" | "rose" | "violet" | "teal";

const toneMap: Record<
  Tone,
  {
    iconBg: string;
    iconText: string;
    glow: string;
    border: string;
    softBg: string;
  }
> = {
  emerald: {
    iconBg: "bg-emerald-500/15",
    iconText: "text-emerald-300",
    glow: "from-emerald-500/12 via-transparent to-transparent",
    border: "border-emerald-500/25",
    softBg: "bg-emerald-500/10",
  },
  blue: {
    iconBg: "bg-blue-500/15",
    iconText: "text-blue-300",
    glow: "from-blue-500/12 via-transparent to-transparent",
    border: "border-blue-500/25",
    softBg: "bg-blue-500/10",
  },
  amber: {
    iconBg: "bg-amber-500/15",
    iconText: "text-amber-300",
    glow: "from-amber-500/12 via-transparent to-transparent",
    border: "border-amber-500/25",
    softBg: "bg-amber-500/10",
  },
  rose: {
    iconBg: "bg-rose-500/15",
    iconText: "text-rose-300",
    glow: "from-rose-500/12 via-transparent to-transparent",
    border: "border-rose-500/25",
    softBg: "bg-rose-500/10",
  },
  violet: {
    iconBg: "bg-violet-500/15",
    iconText: "text-violet-300",
    glow: "from-violet-500/12 via-transparent to-transparent",
    border: "border-violet-500/25",
    softBg: "bg-violet-500/10",
  },
  teal: {
    iconBg: "bg-teal-500/15",
    iconText: "text-teal-300",
    glow: "from-teal-500/12 via-transparent to-transparent",
    border: "border-teal-500/25",
    softBg: "bg-teal-500/10",
  },
};

export function AnalyticsStatCard({
  label,
  value,
  subLabel,
  icon: Icon,
  tone = "emerald",
}: {
  label: string;
  value: string | number;
  subLabel?: string;
  icon: React.ElementType;
  tone?: Tone;
}) {
  const styles = toneMap[tone];

  return (
    <Card className={cn("relative overflow-hidden border border-white/10 bg-linear-to-br from-slate-900/80 to-black backdrop-blur-xl", styles.border)}>
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,var(--tw-gradient-stops))] opacity-90",
          styles.glow
        )}
        aria-hidden="true"
      />
      <CardContent className="relative flex items-start justify-between gap-3 p-5">
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">
            {label}
          </p>
          <p className="text-2xl font-bold tracking-tight text-white">{value}</p>
          {subLabel ? <p className="text-xs text-white/45">{subLabel}</p> : null}
        </div>
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10",
            styles.iconBg,
            styles.iconText
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export function LeoSignalsCard({
  title = "Leo Signals",
  leo,
}: {
  title?: string;
  leo: {
    riskLevel: "low" | "medium" | "high";
    headline: string;
    summary: string;
    insights: string[];
    predictions: string[];
  };
}) {
  const riskTone =
    leo.riskLevel === "high"
      ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
      : leo.riskLevel === "medium"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";

  return (
    <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-slate-900/90 via-slate-950/95 to-black shadow-xl shadow-black/30 backdrop-blur-xl">
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-cyan-500/18 via-sky-500/8 to-transparent blur-3xl"
        aria-hidden="true"
      />
      <CardHeader className="relative z-10 border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-500/25 bg-cyan-500/12 text-cyan-200">
            <LeoIcon className="h-5 w-5" />
          </div>
          <div className="space-y-0.5">
            <CardTitle className="text-base font-semibold text-white">{title}</CardTitle>
            <p className="text-xs text-white/50">{leo.headline}</p>
          </div>
          <Badge className={cn("ml-auto rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]", riskTone)}>
            {leo.riskLevel} risk
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="relative z-10 space-y-4 p-5">
        <p className="text-sm leading-6 text-white/75">{leo.summary}</p>
        <div className="space-y-2">
          {leo.insights.map((insight) => (
            <div
              key={insight}
              className="rounded-2xl border border-white/8 bg-white/4 px-3.5 py-3 text-sm text-white/70"
            >
              {insight}
            </div>
          ))}
        </div>
        {leo.predictions.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
              Forecasts
            </p>
            {leo.predictions.map((prediction) => (
              <div
                key={prediction}
                className="rounded-2xl border border-cyan-500/20 bg-cyan-500/8 px-3.5 py-3 text-sm text-cyan-100/85"
              >
                {prediction}
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function StudentIdentity({
  fullName,
  photoUrl,
  secondary,
}: {
  fullName: string;
  photoUrl?: string | null;
  secondary?: string | null;
}) {
  const initials =
    fullName
      .split(" ")
      .map((part) => part.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="h-10 w-10 border border-white/15">
        <AvatarImage src={photoUrl || ""} alt={fullName} />
        <AvatarFallback className="bg-linear-to-br from-slate-700 to-slate-900 text-xs font-semibold text-white">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate font-medium text-white">{fullName}</p>
        {secondary ? <p className="truncate text-xs text-white/45">{secondary}</p> : null}
      </div>
    </div>
  );
}

export function EmptyAnalyticsState({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
}) {
  return (
    <Card className="border border-white/10 bg-linear-to-br from-slate-900/80 to-black backdrop-blur-xl">
      <CardContent className="flex flex-col items-center justify-center gap-4 py-14 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/45">
          <Icon className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-semibold text-white">{title}</p>
          <p className="max-w-lg text-sm text-white/55">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function prettyDate(iso: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
