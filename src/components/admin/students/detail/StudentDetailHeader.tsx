"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  GraduationCap,
  UserCircle2,
  PhoneCall,
  Mail,
  Wallet,
  Sparkles,
  Calendar,
  Hash,
} from "lucide-react";
import type { StudentDetailDTO } from "@/hooks/admin/useStudentDetail";

type StudentDetailHeaderProps = {
  student: StudentDetailDTO;
};

function initialsFromName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0]!.charAt(0)?.toUpperCase() ?? "";
  return (
    (parts[0]?.charAt(0)?.toUpperCase() ?? "") +
    (parts[parts.length - 1]?.charAt(0)?.toUpperCase() ?? "")
  );
}

// Stat Card Component
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
  tone: "teal" | "cyan" | "emerald" | "amber" | "red";
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

export function StudentDetailHeader({ student }: StudentDetailHeaderProps) {
  const {
    fullName,
    classGroup,
    grade,
    admissionNo,
    status,
    photoUrl,
    ageYears,
    academicSummary,
    feesSummary,
  } = student;

  const performanceTier = academicSummary?.performanceTier ?? null;
  const feesStatus = feesSummary?.status ?? null;

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
              {photoUrl ? <AvatarImage src={photoUrl} alt={fullName} /> : null}
              <AvatarFallback className="bg-linear-to-br from-teal-600/40 to-cyan-600/40 text-2xl font-bold text-white">
                {initialsFromName(fullName)}
              </AvatarFallback>
            </Avatar>
            {status === "active" && (
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
                  {fullName}
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
              </div>

              {/* Info badges */}
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                {grade && (
                  <Badge className="rounded-lg border border-teal-400/30 bg-teal-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-teal-100">
                    {grade.label}
                  </Badge>
                )}
                {classGroup && (
                  <Badge
                    variant="outline"
                    className="rounded-lg border-cyan-400/30 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-cyan-100"
                  >
                    {classGroup.label}
                  </Badge>
                )}
                {admissionNo && (
                  <span className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/40 px-2.5 py-1 text-[10px] font-medium text-white/60">
                    <Hash className="h-3 w-3" />
                    {admissionNo}
                  </span>
                )}
                {typeof ageYears === "number" && ageYears >= 0 && (
                  <span className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/40 px-2.5 py-1 text-[10px] font-medium text-white/60">
                    <Calendar className="h-3 w-3" />
                    {ageYears} years old
                  </span>
                )}
                <span
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-[10px] font-semibold",
                    status === "active" &&
                      "border-emerald-400/50 bg-emerald-500/20 text-emerald-200",
                    status === "inactive" &&
                      "border-slate-400/50 bg-slate-500/20 text-slate-200",
                    status === "withdrawn" &&
                      "border-red-400/50 bg-red-500/20 text-red-200"
                  )}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: quick stats + actions */}
        <div className="flex flex-col items-stretch gap-4 lg:w-[380px]">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <MetricStatCard
              icon={UserCircle2}
              label="Academic"
              value={
                academicSummary?.overallAverage != null
                  ? `${academicSummary.overallAverage.toFixed(1)}%`
                  : "--"
              }
              subLabel={academicSummary?.latestTermLabel ?? "No term data"}
              tone="teal"
            />
            <MetricStatCard
              icon={Wallet}
              label="Fees"
              value={
                feesSummary
                  ? `${feesSummary.currency} ${feesSummary.totalOutstanding.toLocaleString()}`
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

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl border-white/15 bg-white/5 text-white/60 transition-all hover:border-teal-500/30 hover:bg-teal-500/10 hover:text-teal-300"
            >
              <PhoneCall className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl border-white/15 bg-white/5 text-white/60 transition-all hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-300"
            >
              <Mail className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 rounded-xl border-teal-500/30 bg-teal-500/10 text-xs font-medium text-teal-200 transition-all hover:bg-teal-500/20"
            >
              <Wallet className="h-3.5 w-3.5" />
              Record Payment
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
