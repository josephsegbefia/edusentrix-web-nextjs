"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { useAdminMetrics } from "@/hooks/admin/useAdminMetrics";
import { useOnboardingProgress } from "@/hooks/admin/useOnboardingProgress";
import type { SchoolInfo } from "@/hooks/admin/useSchool";
import {
  GraduationCap,
  Users,
  BookOpen,
  Calendar,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Activity,
  DollarSign,
  Settings,
} from "lucide-react";

type SchoolHealthModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  school: SchoolInfo;
  role: string;
  href: string;
};

const CURRICULUM_LABELS: Record<string, string> = {
  ghana_nacca: "NaCCA",
  cambridge: "Cambridge",
  ib_pyp: "IB PYP",
  ib_myp: "IB MYP",
  british_nc: "British NC",
  american: "American",
  hybrid: "Hybrid",
};

function HealthIndicator({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white/3 px-3.5 py-2.5">
      <div className="flex items-center gap-2.5">
        {ok ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-amber-400" />
        )}
        <span className="text-[13px] text-white/70">{label}</span>
      </div>
      {detail && (
        <span
          className={cn(
            "text-xs font-medium",
            ok ? "text-emerald-400/80" : "text-amber-400/80",
          )}
        >
          {detail}
        </span>
      )}
    </div>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  trend,
  accentClassName,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  trend?: { deltaPct: number; direction: "up" | "down" | "flat" };
  accentClassName: string;
}) {
  return (
    <div className="rounded-xl bg-white/3 p-3.5">
      <div className="flex items-center gap-2 mb-2">
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg",
            accentClassName,
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-[11px] font-medium text-white/40 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-xl font-bold text-white">{value}</span>
        {trend && trend.direction !== "flat" && (
          <span
            className={cn(
              "text-[10px] font-semibold",
              trend.direction === "up" ? "text-emerald-400" : "text-red-400",
            )}
          >
            {trend.direction === "up" ? "+" : ""}
            {trend.deltaPct.toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
}

export function SchoolHealthModal({
  open,
  onOpenChange,
  school,
  role,
  href,
}: SchoolHealthModalProps) {
  const { data: metrics } = useAdminMetrics();
  const onboarding = useOnboardingProgress();
  const isAdmin = role === "school_admin";

  const currLabel = CURRICULUM_LABELS[school.curriculumCode] || school.curriculumCode;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={school.name}
      description={school.motto ? `"${school.motto}"` : `${currLabel} · ${school.type}`}
      className="sm:max-w-xl"
    >
      <div className="space-y-5">
        {/* School identity card */}
        <div className="flex items-center gap-4 rounded-2xl bg-white/3 p-4">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-linear-to-br from-slate-800/80 via-slate-900 to-slate-950 ring-1 ring-white/8 shadow-lg shadow-black/30">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/8 via-transparent to-cyan-400/6"
            />
            <Image
              src={school.logo || "/placeholders/school-logo-placeholder.svg"}
              alt={school.name}
              fill
              sizes="64px"
              className="object-contain p-2"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-white">{school.name}</p>
            {school.motto && (
              <p className="mt-0.5 text-xs italic text-white/45">
                &ldquo;{school.motto}&rdquo;
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge
                variant="outline"
                className="rounded-full border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/60"
              >
                {school.type}
              </Badge>
              <Badge
                variant="outline"
                className="rounded-full border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/60"
              >
                {currLabel}
              </Badge>
              {school.gesSchoolCode && (
                <Badge
                  variant="outline"
                  className="rounded-full border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/60"
                >
                  GES {school.gesSchoolCode}
                </Badge>
              )}
              <Badge
                variant="outline"
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px]",
                  school.status === "active"
                    ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
                    : "border-amber-400/20 bg-amber-500/10 text-amber-300",
                )}
              >
                {school.status}
              </Badge>
            </div>
          </div>
        </div>

        {/* Launch Health (onboarding progress) */}
        {isAdmin && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-violet-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40">
                Launch Health
              </h3>
              {onboarding.progressPercentage === 100 && (
                <Badge className="ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 border-0">
                  <Sparkles className="mr-1 h-3 w-3" />
                  Ready
                </Badge>
              )}
            </div>

            {/* Progress bar */}
            <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-linear-to-r from-violet-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${onboarding.progressPercentage}%` }}
              />
            </div>

            <div className="space-y-1.5">
              <HealthIndicator
                label="Academic Period"
                ok={onboarding.hasAcademicPeriod}
                detail={onboarding.hasAcademicPeriod ? "Active" : "Not set"}
              />
              <HealthIndicator
                label="Class Groups"
                ok={onboarding.hasClassGroups}
                detail={onboarding.hasClassGroups ? "Created" : "Needed"}
              />
              <HealthIndicator
                label="Teachers"
                ok={onboarding.hasTeachers}
                detail={
                  metrics?.teachers?.total
                    ? `${metrics.teachers.total} enrolled`
                    : "None yet"
                }
              />
              <HealthIndicator
                label="Students"
                ok={onboarding.hasStudents}
                detail={
                  metrics?.students?.total
                    ? `${metrics.students.total} enrolled`
                    : "None yet"
                }
              />
            </div>
          </div>
        )}

        {/* Quick metrics */}
        {isAdmin && metrics && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-cyan-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40">
                Quick Stats
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MetricTile
                icon={GraduationCap}
                label="Students"
                value={metrics.students?.total ?? 0}
                trend={metrics.students?.trend}
                accentClassName="bg-sky-500/15 text-sky-300"
              />
              <MetricTile
                icon={Users}
                label="Teachers"
                value={metrics.teachers?.total ?? 0}
                trend={metrics.teachers?.trend}
                accentClassName="bg-emerald-500/15 text-emerald-300"
              />
              <MetricTile
                icon={BookOpen}
                label="Subjects"
                value={metrics.subjects?.total ?? 0}
                trend={metrics.subjects?.trend}
                accentClassName="bg-violet-500/15 text-violet-300"
              />
              <MetricTile
                icon={DollarSign}
                label="Collection Rate"
                value={
                  metrics.collections?.rate != null
                    ? `${metrics.collections.rate.toFixed(0)}%`
                    : "—"
                }
                accentClassName="bg-amber-500/15 text-amber-300"
              />
            </div>
          </div>
        )}

        {/* Current period */}
        {isAdmin && metrics?.period && (
          <div className="flex items-center gap-3 rounded-xl bg-white/3 px-3.5 py-3">
            <Calendar className="h-4 w-4 text-violet-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-white">
                {metrics.period.yearLabel} — {metrics.period.term}
              </p>
              <p className="text-[11px] text-white/40">Current academic period</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="gap-1.5 text-white/60 hover:text-white hover:bg-white/5"
          >
            <Link href={href} onClick={() => onOpenChange(false)}>
              Dashboard
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
          {isAdmin && (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="gap-1.5 text-white/60 hover:text-white hover:bg-white/5"
            >
              <Link href="/admin/settings" onClick={() => onOpenChange(false)}>
                <Settings className="h-3.5 w-3.5" />
                Settings
              </Link>
            </Button>
          )}
        </div>
      </div>
    </ResponsiveModal>
  );
}
