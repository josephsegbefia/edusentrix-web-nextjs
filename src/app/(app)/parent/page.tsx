// src/app/(app)/parent/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  DollarSign,
  TrendingUp,
  TrendingDown,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useParentDashboard, FeeStatus } from "@/hooks/parent/useParentDashboard";
import { cn } from "@/lib/utils";
import { formatCurrencyFromMajor } from "@/lib/fees/money";

/* --------------------------------------------------------------------------------
   Types
-------------------------------------------------------------------------------- */
type Trend = { deltaPct: number; direction: "up" | "down" | "stable" };

/* --------------------------------------------------------------------------------
   Reusable UI Blocks
-------------------------------------------------------------------------------- */

function MetricCard({
  label,
  value,
  accent,
  subtitle,
  trend,
  onClick,
  icon: Icon,
  loading = false,
}: {
  label: string;
  value: string | number;
  accent: string;
  subtitle?: string;
  trend?: Trend;
  onClick?: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  loading?: boolean;
}) {
  const TrendIcon =
    trend?.direction === "up"
      ? TrendingUp
      : trend?.direction === "down"
      ? TrendingDown
      : null;

  const trendColor =
    trend?.direction === "up"
      ? "text-emerald-300"
      : trend?.direction === "down"
      ? "text-rose-300"
      : "text-white/60";

  const Wrapper: React.ElementType = onClick ? "button" : "div";

  if (loading) {
    return (
      <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-white/5 to-transparent p-5 lg:p-6 shadow-lg shadow-black/20 backdrop-blur">
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    );
  }

  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        "relative w-full overflow-hidden rounded-2xl border border-white/10",
        "bg-linear-to-br from-white/5 to-transparent p-5 lg:p-6",
        "shadow-lg shadow-black/20 backdrop-blur",
        onClick &&
          "text-left transition-transform hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      )}
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-linear-to-br ${accent}`}
        aria-hidden="true"
      />
      <div className="relative z-10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
            {label}
          </div>
          {Icon && (
            <Icon className="h-4 w-4 text-white/40" aria-hidden="true" />
          )}
        </div>
        <div className="text-3xl font-semibold text-white drop-shadow-sm">
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
        {(subtitle || trend) && (
          <div className="flex items-center gap-2 text-xs text-white/60">
            {trend && TrendIcon && (
              <span className={`inline-flex items-center gap-1 ${trendColor}`}>
                <TrendIcon className="h-3 w-3" />
                {Math.abs(trend.deltaPct)}%
              </span>
            )}
            {subtitle && <span>{subtitle}</span>}
          </div>
        )}
        <div className="h-[3px] w-12 rounded-full bg-white/30" />
      </div>
    </Wrapper>
  );
}

function QuickAction({
  title,
  description,
  icon: Icon,
  accent,
  href,
  onClick,
  disabled = false,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const Wrapper: React.ElementType = href ? Link : "button";
  const wrapperProps = href
    ? { href, className: disabled ? "pointer-events-none" : "" }
    : { onClick, disabled };

  return (
    <Wrapper
      {...wrapperProps}
      className={cn(
        "group relative flex w-full items-start gap-4 rounded-xl border border-white/10 p-4",
        "bg-gradient-to-br from-white/5 to-transparent backdrop-blur",
        "transition-all duration-200 hover:border-white/20 hover:shadow-lg",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          accent
        )}
      >
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="flex-1 text-left">
        <h3 className="text-sm font-medium text-white">{title}</h3>
        <p className="mt-0.5 text-xs text-white/60">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 self-center text-white/40 transition-transform group-hover:translate-x-0.5" />
    </Wrapper>
  );
}

function FeeStatusBadge({ status }: { status: FeeStatus }) {
  const config: Record<FeeStatus, { icon: React.ElementType; label: string; className: string }> = {
    clear: {
      icon: CheckCircle2,
      label: "Fees Clear",
      className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    },
    partial: {
      icon: Clock,
      label: "Partial",
      className: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    },
    owing: {
      icon: AlertCircle,
      label: "Owing",
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
      className="group relative flex w-full items-center gap-4 rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-4 text-left transition-all duration-200 hover:border-white/20 hover:shadow-lg hover:scale-[1.01]"
    >
      {/* Avatar */}
      <div className="relative h-12 w-12 shrink-0">
        {ward.photoUrl ? (
          <img
            src={ward.photoUrl}
            alt={ward.name}
            className="h-12 w-12 rounded-full object-cover border-2 border-white/10"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/20 text-brand font-semibold text-lg border-2 border-brand/30">
            {initials}
          </div>
        )}
        {ward.isPrimary && (
          <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-brand flex items-center justify-center">
            <CheckCircle2 className="h-3 w-3 text-white" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-white truncate">{ward.name}</h3>
          <span className="text-xs text-white/40">({ward.relationship})</span>
        </div>
        <p className="text-sm text-white/60 truncate">{ward.classGroup || "No class assigned"}</p>
      </div>

      {/* Fee Status */}
      <div className="shrink-0 flex flex-col items-end gap-1">
        <FeeStatusBadge status={ward.feeStatus} />
        {ward.outstandingAmount > 0 && (
          <span className="text-xs text-rose-300">
            GH₵ {ward.outstandingAmount.toLocaleString()}
          </span>
        )}
      </div>

      <ChevronRight className="h-4 w-4 text-white/40 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

function WardCardSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-4">
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-6 w-20 rounded-full" />
    </div>
  );
}

/* --------------------------------------------------------------------------------
   Main Component
-------------------------------------------------------------------------------- */

export default function ParentDashboardPage() {
  const router = useRouter();
  const { data, isLoading, error } = useParentDashboard();

  const { wards = [], summary } = data || {};
  const totalWards = summary?.totalWards || 0;
  const totalOutstanding = summary?.totalOutstanding || 0;
  const upcomingPayments = summary?.upcomingPayments || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Parent Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here&apos;s an overview of your children&apos;s progress.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link href="/parent/notifications">
            <Bell className="h-4 w-4" />
            Notifications
          </Link>
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            <span>Failed to load dashboard data. Please try again.</span>
          </div>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="My Children"
          value={totalWards}
          accent="from-blue-500/25 via-blue-500/10 to-transparent"
          subtitle="Wards enrolled"
          icon={Users}
          loading={isLoading}
          onClick={() => router.push("/parent/wards")}
        />
        <MetricCard
          label="Outstanding Fees"
          value={formatCurrencyFromMajor(totalOutstanding, { compact: totalOutstanding >= 1000 })}
          accent={totalOutstanding > 0 ? "from-rose-500/25 via-rose-500/10 to-transparent" : "from-emerald-500/25 via-emerald-500/10 to-transparent"}
          subtitle={totalOutstanding > 0 ? `${upcomingPayments} pending invoices` : "All fees paid"}
          icon={DollarSign}
          loading={isLoading}
          onClick={() => router.push("/parent/fees")}
        />
        <MetricCard
          label="Academic Progress"
          value="View"
          accent="from-purple-500/25 via-purple-500/10 to-transparent"
          subtitle="Grades & performance"
          icon={GraduationCap}
          loading={isLoading}
          onClick={() => router.push("/parent/academics")}
        />
        <MetricCard
          label="Attendance"
          value="View"
          accent="from-amber-500/25 via-amber-500/10 to-transparent"
          subtitle="Attendance records"
          icon={ClipboardCheck}
          loading={isLoading}
          onClick={() => router.push("/parent/attendance")}
        />
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Ward Cards - 2 columns */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">My Children</h2>
            <Button asChild variant="ghost" size="sm" className="gap-1 text-brand">
              <Link href="/parent/wards">
                View All
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              <WardCardSkeleton />
              <WardCardSkeleton />
            </div>
          ) : wards.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
              <Users className="mx-auto h-12 w-12 text-white/40 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No Wards Linked</h3>
              <p className="text-sm text-white/60 mb-4">
                You don&apos;t have any children linked to your account yet.
              </p>
              <p className="text-xs text-white/40">
                Please contact the school administration to link your children.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
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

        {/* Quick Actions - 1 column */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Quick Actions</h2>
          <div className="space-y-3">
            <QuickAction
              title="Pay Fees"
              description="Make a payment for school fees"
              icon={CreditCard}
              accent="bg-emerald-500/20"
              href="/parent/fees"
            />
            <QuickAction
              title="View Reports"
              description="Download academic reports"
              icon={FileText}
              accent="bg-purple-500/20"
              href="/parent/reports"
            />
            <QuickAction
              title="Academic Progress"
              description="Check grades and performance"
              icon={GraduationCap}
              accent="bg-blue-500/20"
              href="/parent/academics"
            />
            <QuickAction
              title="School Calendar"
              description="View upcoming events"
              icon={Calendar}
              accent="bg-amber-500/20"
              href="/parent/calendar"
            />
          </div>
        </div>
      </div>

      {/* Info Banner */}
      {!isLoading && totalOutstanding > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-400 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-amber-300">Outstanding Fees</h4>
              <p className="text-sm text-amber-300/80 mt-1">
                You have outstanding fees of{" "}
                <span className="font-semibold">GH₵ {totalOutstanding.toLocaleString()}</span>.
                Please make a payment to avoid any disruptions.
              </p>
            </div>
            <Button asChild size="sm" className="bg-amber-500 hover:bg-amber-600 text-black">
              <Link href="/parent/fees">Pay Now</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
