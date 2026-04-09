// src/app/(app)/parent/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  DollarSign,
  GraduationCap,
  ClipboardCheck,
  Calendar,
  Bell,
  ChevronRight,
  CreditCard,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Heart,
  School,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useParentDashboard, type FeeStatus } from "@/hooks/parent/useParentDashboard";
import { cn } from "@/lib/utils";
import { formatCurrencyFromMajor } from "@/lib/fees/money";

/* ──────────────────────────────────────────────────────────────────
   Stat Cards (matching teacher DashboardStats pattern)
   ────────────────────────────────────────────────────────────────── */

type StatTone = "blue" | "rose" | "purple" | "amber" | "emerald";

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
  blue: {
    border: "border-blue-500/30",
    bg: "from-blue-500/10 via-blue-500/5 to-transparent",
    iconBg: "from-blue-500/20 to-blue-600/20",
    iconColor: "text-blue-300",
    valueColor: "text-blue-100",
    glow: "bg-blue-500/20",
  },
  rose: {
    border: "border-rose-500/30",
    bg: "from-rose-500/10 via-rose-500/5 to-transparent",
    iconBg: "from-rose-500/20 to-rose-600/20",
    iconColor: "text-rose-300",
    valueColor: "text-rose-100",
    glow: "bg-rose-500/20",
  },
  emerald: {
    border: "border-emerald-500/30",
    bg: "from-emerald-500/10 via-emerald-500/5 to-transparent",
    iconBg: "from-emerald-500/20 to-emerald-600/20",
    iconColor: "text-emerald-300",
    valueColor: "text-emerald-100",
    glow: "bg-emerald-500/20",
  },
  purple: {
    border: "border-purple-500/30",
    bg: "from-purple-500/10 via-purple-500/5 to-transparent",
    iconBg: "from-purple-500/20 to-purple-600/20",
    iconColor: "text-purple-300",
    valueColor: "text-purple-100",
    glow: "bg-purple-500/20",
  },
  amber: {
    border: "border-amber-500/30",
    bg: "from-amber-500/10 via-amber-500/5 to-transparent",
    iconBg: "from-amber-500/20 to-amber-600/20",
    iconColor: "text-amber-300",
    valueColor: "text-amber-100",
    glow: "bg-amber-500/20",
  },
};

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  loading,
  subtitle,
  onClick,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  tone: StatTone;
  loading?: boolean;
  subtitle?: string;
  onClick?: () => void;
}) {
  const config = toneConfig[tone];
  const Wrapper: React.ElementType = onClick ? "button" : "div";

  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-linear-to-br p-5 shadow-xl shadow-black/30 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl",
        config.border,
        config.bg,
        onClick && "text-left cursor-pointer"
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl transition-opacity duration-300 group-hover:opacity-100 opacity-50",
          config.glow
        )}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent" aria-hidden />

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-white/50">
            {label}
          </p>
          <p className={cn("text-3xl font-bold tracking-tight", config.valueColor)}>
            {loading ? (
              <span className="inline-block h-8 w-16 animate-pulse rounded bg-white/10" />
            ) : (
              typeof value === "number" ? value.toLocaleString() : value
            )}
          </p>
          {subtitle && <p className="text-[11px] text-white/40">{subtitle}</p>}
        </div>

        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-linear-to-br shadow-inner shadow-white/5 transition-transform duration-300 group-hover:scale-110",
            config.iconBg
          )}
        >
          <Icon className={cn("h-5 w-5", config.iconColor)} />
        </div>
      </div>
    </Wrapper>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Fee Status Badge
   ────────────────────────────────────────────────────────────────── */

function FeeStatusBadge({ status }: { status: FeeStatus }) {
  const config: Record<FeeStatus, { icon: React.ElementType; label: string; className: string }> = {
    clear: {
      icon: CheckCircle2,
      label: "Fees Clear",
      className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    },
    partial: {
      icon: Clock,
      label: "Partial",
      className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    },
    owing: {
      icon: AlertCircle,
      label: "Owing",
      className: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    },
  };

  const { icon: StatusIcon, label, className } = config[status];

  return (
    <Badge variant="outline" className={cn("gap-1 text-[10px]", className)}>
      <StatusIcon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Ward Card
   ────────────────────────────────────────────────────────────────── */

function WardCard({
  ward,
  onClick,
}: {
  ward: {
    id: string;
    name: string;
    firstName: string;
    lastName: string;
    photoUrl: string | null;
    classGroup: string;
    relationship: string;
    feeStatus: FeeStatus;
    outstandingAmount: number;
    isPrimary: boolean;
  };
  onClick?: () => void;
}) {
  const initials = `${ward.firstName?.[0] || ""}${ward.lastName?.[0] || ""}`.toUpperCase();

  return (
    <button
      onClick={onClick}
      className="group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-white/5 to-transparent p-4 text-left shadow-lg shadow-black/20 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-xl"
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-brand/10 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-50"
        aria-hidden
      />

      {/* Avatar */}
      <div className="relative h-12 w-12 shrink-0">
        {ward.photoUrl ? (
          <img
            src={ward.photoUrl}
            alt={ward.name}
            className="h-12 w-12 rounded-full border-2 border-white/10 object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-brand/30 bg-brand/20 text-lg font-semibold text-brand">
            {initials}
          </div>
        )}
        {ward.isPrimary && (
          <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand">
            <CheckCircle2 className="h-3 w-3 text-white" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-semibold text-white">{ward.name}</h3>
          <span className="text-[11px] text-white/35">({ward.relationship})</span>
        </div>
        <p className="truncate text-sm text-white/50">{ward.classGroup || "No class assigned"}</p>
      </div>

      {/* Fee Status */}
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <FeeStatusBadge status={ward.feeStatus} />
        {ward.outstandingAmount > 0 && (
          <span className="text-[11px] font-medium text-rose-300">
            GH₵ {ward.outstandingAmount.toLocaleString()}
          </span>
        )}
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-white/30 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

function WardCardSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-linear-to-br from-white/5 to-transparent p-4 shadow-lg shadow-black/20 backdrop-blur">
      <div className="h-12 w-12 animate-pulse rounded-full bg-white/10" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-32 animate-pulse rounded bg-white/10" />
        <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
      </div>
      <div className="h-6 w-20 animate-pulse rounded-full bg-white/10" />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Quick Actions (teacher-style)
   ────────────────────────────────────────────────────────────────── */

const quickActionTones: Record<string, { border: string; bg: string; iconBg: string; icon: string; glow: string }> = {
  emerald: { border: "border-emerald-500/25", bg: "from-emerald-500/8", iconBg: "bg-emerald-500/20", icon: "text-emerald-300", glow: "bg-emerald-500/20" },
  purple: { border: "border-purple-500/25", bg: "from-purple-500/8", iconBg: "bg-purple-500/20", icon: "text-purple-300", glow: "bg-purple-500/20" },
  blue: { border: "border-blue-500/25", bg: "from-blue-500/8", iconBg: "bg-blue-500/20", icon: "text-blue-300", glow: "bg-blue-500/20" },
  amber: { border: "border-amber-500/25", bg: "from-amber-500/8", iconBg: "bg-amber-500/20", icon: "text-amber-300", glow: "bg-amber-500/20" },
};

function QuickAction({
  title,
  description,
  icon: Icon,
  tone = "blue",
  href,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  tone?: string;
  href: string;
}) {
  const styles = quickActionTones[tone] || quickActionTones.blue;

  return (
    <Link
      href={href}
      className={cn(
        "group relative flex items-center gap-4 overflow-hidden rounded-2xl border bg-linear-to-r to-transparent p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/20",
        styles.border,
        styles.bg
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-30 blur-2xl transition-opacity duration-300 group-hover:opacity-60",
          styles.glow
        )}
        aria-hidden
      />

      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", styles.iconBg)}>
        <Icon className={cn("h-5 w-5", styles.icon)} />
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="mt-0.5 text-[11px] text-white/40">{description}</p>
      </div>

      <div className="flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/40 transition-all duration-200 group-hover:border-white/20 group-hover:bg-white/10 group-hover:text-white/60">
        Open
        <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Main Page
   ────────────────────────────────────────────────────────────────── */

export default function ParentDashboardPage() {
  const router = useRouter();
  const { data, isLoading, error } = useParentDashboard();

  const { wards = [], summary } = data || {};
  const totalWards = summary?.totalWards || 0;
  const totalOutstanding = summary?.totalOutstanding || 0;
  const upcomingPayments = summary?.upcomingPayments || 0;

  return (
    <div className="space-y-6">
      {/* Header (matching TeacherHeader style) */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-white/5 via-white/5 to-transparent p-6 shadow-2xl shadow-black/30 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-blue-500/15 via-blue-500/5 to-transparent"
          aria-hidden
        />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-inner">
              <Heart className="h-7 w-7 text-blue-300" />
            </div>
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/50">
                Parent Portal
              </p>
              <div className="text-2xl font-semibold text-white sm:text-3xl">
                {isLoading ? (
                  <span className="inline-block h-8 w-56 animate-pulse rounded-xl bg-white/10" />
                ) : (
                  <>Parent Dashboard</>
                )}
              </div>
              <p className="text-sm text-white/55">
                Here&apos;s an overview of your children&apos;s progress and school activity.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              asChild
              className="border border-white/10 bg-white/10 text-white hover:bg-white/20"
            >
              <Link href="/parent/notifications">
                <Bell className="mr-2 h-4 w-4" />
                Notifications
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-300">
          <AlertCircle className="h-5 w-5 shrink-0" />
          Failed to load dashboard data. Please try again.
        </div>
      )}

      {/* Stat cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="My Children"
          value={totalWards}
          icon={Users}
          tone="blue"
          loading={isLoading}
          subtitle="Wards enrolled"
          onClick={() => router.push("/parent/wards")}
        />
        <StatCard
          label="Outstanding Fees"
          value={isLoading ? "" : formatCurrencyFromMajor(totalOutstanding, { compact: totalOutstanding >= 1000 })}
          icon={DollarSign}
          tone={totalOutstanding > 0 ? "rose" : "emerald"}
          loading={isLoading}
          subtitle={totalOutstanding > 0 ? `${upcomingPayments} pending invoices` : "All fees paid"}
          onClick={() => router.push("/parent/fees")}
        />
        <StatCard
          label="Academic Progress"
          value="View"
          icon={GraduationCap}
          tone="purple"
          loading={isLoading}
          subtitle="Grades & performance"
          onClick={() => router.push("/parent/academics")}
        />
        <StatCard
          label="Attendance"
          value="View"
          icon={ClipboardCheck}
          tone="amber"
          loading={isLoading}
          subtitle="Attendance records"
          onClick={() => router.push("/parent/attendance")}
        />
      </section>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* Ward cards */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-blue-500/10 via-blue-500/5 to-transparent"
            aria-hidden
          />

          {/* Header */}
          <div className="relative z-10 flex items-center justify-between border-b border-white/8 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-blue-500/20">
                <School className="h-4 w-4 text-blue-200" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">My Children</h3>
                <p className="text-[11px] text-white/40">Linked wards and their status</p>
              </div>
            </div>

            {!isLoading && wards.length > 0 && (
              <Button asChild variant="ghost" size="sm" className="gap-1 text-[11px] text-brand hover:text-brand">
                <Link href="/parent/wards">
                  View All
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </Button>
            )}
          </div>

          {/* Body */}
          <div className="relative z-10 p-4">
            {isLoading ? (
              <div className="space-y-3">
                <WardCardSkeleton />
                <WardCardSkeleton />
              </div>
            ) : wards.length === 0 ? (
              <div className="rounded-2xl border border-white/8 bg-white/5 p-8 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                  <Users className="h-6 w-6 text-white/25" />
                </div>
                <p className="text-sm font-medium text-white/50">No wards linked</p>
                <p className="mt-1 text-xs text-white/30">
                  Contact your school admin to link your children to your account.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {wards.map((ward) => (
                  <WardCard
                    key={ward.id}
                    ward={ward}
                    onClick={() => router.push(`/parent/wards/${ward.id}`)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {!isLoading && wards.length > 0 && (
            <div className="relative z-10 border-t border-white/6 px-5 py-3">
              <div className="flex items-center justify-between text-[11px] text-white/30">
                <span>{wards.length} ward{wards.length !== 1 ? "s" : ""} linked</span>
                <span>Click a ward for details</span>
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-violet-500/10 via-violet-500/5 to-transparent"
            aria-hidden
          />

          {/* Header */}
          <div className="relative z-10 flex items-center justify-between border-b border-white/8 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-violet-500/20">
                <Zap className="h-4 w-4 text-violet-200" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Quick Actions</h3>
                <p className="text-[11px] text-white/40">Frequently used actions</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="relative z-10 space-y-2.5 p-4">
            <QuickAction
              title="Pay Fees"
              description="Make a payment for school fees"
              icon={CreditCard}
              tone="emerald"
              href="/parent/fees"
            />
            <QuickAction
              title="View Reports"
              description="Download academic reports"
              icon={FileText}
              tone="purple"
              href="/parent/reports"
            />
            <QuickAction
              title="Academic Progress"
              description="Check grades and performance"
              icon={GraduationCap}
              tone="blue"
              href="/parent/academics"
            />
            <QuickAction
              title="School Calendar"
              description="View upcoming events"
              icon={Calendar}
              tone="amber"
              href="/parent/calendar"
            />
          </div>

          {/* Footer */}
          <div className="relative z-10 border-t border-white/6 px-5 py-3">
            <div className="text-[11px] text-white/30">
              4 actions available
            </div>
          </div>
        </div>
      </div>

      {/* Outstanding fees banner */}
      {!isLoading && totalOutstanding > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-linear-to-r from-amber-500/10 via-amber-500/5 to-transparent p-5">
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-500/15 blur-2xl"
            aria-hidden
          />
          <div className="relative flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20">
              <AlertCircle className="h-5 w-5 text-amber-400" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-amber-200">Outstanding Fees</h4>
              <p className="mt-1 text-sm text-amber-300/70">
                You have outstanding fees of{" "}
                <span className="font-semibold text-amber-200">
                  GH₵ {totalOutstanding.toLocaleString()}
                </span>
                . Please make a payment to avoid any disruptions.
              </p>
            </div>
            <Button asChild size="sm" className="shrink-0 bg-amber-500 text-black hover:bg-amber-400">
              <Link href="/parent/fees">Pay Now</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
