// src/components/admin/subjects/SubjectsQuickStatsSection.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { BookText, Info, School, Users, TrendingUp } from "lucide-react";
import { useSubjectOfferings } from "@/hooks/admin/useSubjectOfferings";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import CountUp from "react-countup";

type StatTone = "amber" | "teal" | "sky" | "rose";

type StatCardProps = {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: StatTone;
  loading?: boolean;
  subtitle?: string;
  onInfoClick?: () => void;
};

const toneConfig: Record<
  StatTone,
  {
    border: string;
    bg: string;
    iconBg: string;
    iconColor: string;
    valueColor: string;
    glow: string;
  }
> = {
  amber: {
    border: "border-amber-400/15",
    bg: "from-amber-950/50 via-slate-900/40 to-transparent",
    iconBg: "from-amber-300/18 to-orange-300/10",
    iconColor: "text-amber-100",
    valueColor: "text-amber-50",
    glow: "bg-amber-300/18",
  },
  teal: {
    border: "border-teal-400/15",
    bg: "from-teal-950/50 via-slate-900/40 to-transparent",
    iconBg: "from-teal-300/18 to-cyan-300/10",
    iconColor: "text-teal-100",
    valueColor: "text-teal-50",
    glow: "bg-teal-300/18",
  },
  sky: {
    border: "border-sky-400/15",
    bg: "from-sky-950/50 via-slate-900/40 to-transparent",
    iconBg: "from-sky-300/18 to-blue-300/10",
    iconColor: "text-sky-100",
    valueColor: "text-sky-50",
    glow: "bg-sky-300/18",
  },
  rose: {
    border: "border-rose-400/15",
    bg: "from-rose-950/50 via-slate-900/40 to-transparent",
    iconBg: "from-rose-300/18 to-pink-300/10",
    iconColor: "text-rose-100",
    valueColor: "text-rose-50",
    glow: "bg-rose-300/18",
  },
};

function StatCard({
  label,
  value,
  icon,
  tone,
  loading,
  subtitle,
  onInfoClick,
}: StatCardProps) {
  const config = toneConfig[tone];

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 shadow-xl shadow-black/30 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl",
        config.border,
        config.bg
      )}
    >
      {/* Glow effect */}
      <div
        className={cn(
          "pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl transition-opacity duration-300 group-hover:opacity-100",
          config.glow,
          "opacity-50"
        )}
        aria-hidden="true"
      />

      {/* Top shine */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
        aria-hidden="true"
      />

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-white/50">
              {label}
            </p>
            {onInfoClick ? (
              <button
                type="button"
                onClick={onInfoClick}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/45 transition hover:border-white/20 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                aria-label={`Explain ${label}`}
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <div className="flex items-baseline gap-2">
            <p
              className={cn(
                "text-3xl font-bold tracking-tight tabular-nums",
                config.valueColor
              )}
            >
              {loading ? (
                <span className="inline-block h-8 w-12 animate-pulse rounded bg-white/10" />
              ) : (
                <CountUp end={value} duration={1.5} separator="," />
              )}
            </p>
          </div>
          {subtitle && (
            <p className="text-[11px] text-white/40">{subtitle}</p>
          )}
        </div>

        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br shadow-inner shadow-white/5 transition-transform duration-300 group-hover:scale-110",
            config.iconBg
          )}
        >
          <span className={config.iconColor}>{icon}</span>
        </div>
      </div>
    </div>
  );
}

export function SubjectsQuickStatsSection() {
  const [classLinksInfoOpen, setClassLinksInfoOpen] = React.useState(false);
  const { data, isLoading } = useSubjectOfferings({ isActive: true });

  const subjects = (data?.data || []).filter(
    (offering) => offering.gradeBand !== "preschool"
  );

  const stats = React.useMemo(() => {
    const total = subjects.length;
    const active = total;
    const totalClasses = subjects.reduce((sum, s) => sum + s.assignedClassGroupCount, 0);
    const totalTeachers = subjects.reduce((sum, s) => sum + s.assignedTeacherCount, 0);

    return {
      total,
      active,
      totalClasses,
      totalTeachers,
    };
  }, [subjects]);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Offerings"
          value={stats.total}
          icon={<BookText className="h-5 w-5" />}
          tone="amber"
          loading={isLoading}
        />
        <StatCard
          label="Active Offerings"
          value={stats.active}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="teal"
          loading={isLoading}
          subtitle={`${stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}% of total`}
        />
        <StatCard
          label="Class Offering Links"
          value={stats.totalClasses}
          icon={<School className="h-5 w-5" />}
          tone="sky"
          loading={isLoading}
          subtitle="Offerings assigned to class groups"
          onInfoClick={() => setClassLinksInfoOpen(true)}
        />
        <StatCard
          label="Teachers Assigned"
          value={stats.totalTeachers}
          icon={<Users className="h-5 w-5" />}
          tone="rose"
          loading={isLoading}
          subtitle="Teaching subjects"
        />
      </div>

      <ResponsiveModal
        open={classLinksInfoOpen}
        onOpenChange={setClassLinksInfoOpen}
        title="Class Offering Links"
        description="This metric counts subject-offering-to-class-group links, not unique classes."
      >
        <div className="space-y-4 text-sm leading-relaxed text-white/70">
          <p>
            A class offering link is created when one subject offering is attached to one class group.
            The total adds up every active non-preschool subject offering across every class group it
            has been assigned to.
          </p>

          <div className="rounded-xl border border-sky-400/20 bg-sky-400/10 p-4 text-sky-50">
            <p className="font-semibold">Example</p>
            <p className="mt-2 text-sky-50/80">
              If Mathematics, English, Science, and Social Studies are each assigned to JHS 1A,
              JHS 1B, and JHS 1C, that is 4 offerings x 3 class groups = 12 class offering links.
            </p>
          </div>

          <p>
            This is why the number can be higher than the number of classes. It is measuring coverage
            of offerings across class groups, not the count of class groups themselves.
          </p>
        </div>
      </ResponsiveModal>
    </>
  );
}
