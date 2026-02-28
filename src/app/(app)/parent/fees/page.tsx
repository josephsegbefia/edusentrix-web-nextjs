// src/app/(app)/parent/fees/page.tsx
"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  DollarSign,
  AlertTriangle,
  Users,
  ChevronRight,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  Wallet,
  Receipt,
  TrendingUp,
} from "lucide-react";
import { useParentFees } from "@/hooks/parent/useParentFees";
import type { WardFeeSummary, PendingInvoice, RecentPayment, FeeStatus } from "@/hooks/parent/useParentFees";
import { format, parseISO } from "date-fns";

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

import { formatCurrencyFromMajor } from "@/lib/fees/money";

function getStatusColor(status: FeeStatus): string {
  const colors: Record<FeeStatus, string> = {
    clear: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    partial: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    owing: "bg-red-500/20 text-red-300 border-red-500/30",
  };
  return colors[status];
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
  tone: "emerald" | "blue" | "amber" | "red" | "purple" | "cyan";
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
    red: {
      gradient: "from-red-500/15 via-red-500/5 to-transparent",
      iconBg: "bg-red-500/20 border-red-500/30",
      iconColor: "text-red-300",
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
  };

  const style = tones[tone];
  const Wrapper: React.ElementType = onClick ? "button" : "div";

  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 to-black p-5 shadow-lg shadow-black/30 backdrop-blur-xl",
        onClick && "text-left cursor-pointer hover:-translate-y-0.5 hover:shadow-xl transition-all duration-200"
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-linear-to-br opacity-60",
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
          <span className="text-xs font-medium uppercase tracking-widest text-white/50">
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
   Ward Fee Card
-------------------------------------------------------------------------------- */
function WardFeeCard({
  ward,
  onClick,
}: {
  ward: WardFeeSummary;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative w-full overflow-hidden rounded-xl border border-white/10 bg-linear-to-br from-white/5 to-transparent p-4 text-left transition-all duration-200 hover:border-white/20 hover:shadow-lg hover:scale-[1.01]"
    >
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <Avatar className="h-14 w-14 border-2 border-white/20">
          {ward.photoUrl ? (
            <AvatarImage src={ward.photoUrl} alt={ward.wardName} />
          ) : null}
          <AvatarFallback className="bg-linear-to-br from-emerald-600/40 to-teal-600/40 text-lg font-bold text-white">
            {initialsFromName(ward.wardName)}
          </AvatarFallback>
        </Avatar>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white truncate">{ward.wardName}</h3>
            {ward.status === "clear" && (
              <Sparkles className="h-4 w-4 text-emerald-400" />
            )}
          </div>
          <p className="text-sm text-white/60">{ward.classGroup}</p>
          <div className="flex items-center gap-3 mt-2">
            <Badge variant="outline" className={getStatusColor(ward.status)}>
              {ward.status === "clear" ? (
                <CheckCircle2 className="h-3 w-3 mr-1" />
              ) : ward.status === "partial" ? (
                <Clock className="h-3 w-3 mr-1" />
              ) : (
                <AlertCircle className="h-3 w-3 mr-1" />
              )}
              {ward.status === "clear" ? "Paid" : ward.status === "partial" ? "Partial" : "Owing"}
            </Badge>
            {ward.overdueInvoices > 0 && (
              <span className="flex items-center gap-1 text-xs text-red-300">
                <AlertCircle className="h-3 w-3" />
                {ward.overdueInvoices} overdue
              </span>
            )}
          </div>
        </div>

        {/* Amount & Progress */}
        <div className="text-right shrink-0">
          <div className={cn("text-xl font-bold", ward.balanceDue > 0 ? "text-red-300" : "text-emerald-300")}>
            {formatCurrencyFromMajor(ward.balanceDue)}
          </div>
          <p className="text-xs text-white/50 mt-1">
            of {formatCurrencyFromMajor(ward.totalFees)}
          </p>
          <div className="mt-2 w-24">
            <Progress value={ward.paymentProgress} className="h-1.5" />
          </div>
        </div>

        <ChevronRight className="h-5 w-5 text-white/40 transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}

/* --------------------------------------------------------------------------------
   Pending Invoice Card
-------------------------------------------------------------------------------- */
function InvoiceCard({ invoice, onClick }: { invoice: PendingInvoice; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between rounded-lg border px-3 py-3 text-left transition-all hover:shadow-md",
        invoice.isOverdue
          ? "border-red-500/30 bg-red-500/10 hover:bg-red-500/15"
          : "border-white/10 bg-white/5 hover:bg-white/10"
      )}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            invoice.isOverdue ? "bg-red-500/30" : "bg-amber-500/20"
          )}
        >
          <Receipt className={cn("h-5 w-5", invoice.isOverdue ? "text-red-300" : "text-amber-300")} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{invoice.title}</p>
          <p className="text-xs text-white/50 truncate">{invoice.wardName}</p>
          <p className={cn("text-xs mt-0.5", invoice.isOverdue ? "text-red-300" : "text-white/50")}>
            Due: {format(parseISO(invoice.dueDate), "MMM d, yyyy")}
            {invoice.isOverdue && " (Overdue)"}
          </p>
        </div>
      </div>
      <div className="text-right ml-3">
        <p className={cn("text-lg font-bold", invoice.isOverdue ? "text-red-200" : "text-white")}>
          {formatCurrencyFromMajor(invoice.balanceDue)}
        </p>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] mt-1",
            invoice.isOverdue
              ? "border-red-500/50 bg-red-500/20 text-red-200"
              : invoice.status === "partial"
              ? "border-amber-500/50 bg-amber-500/20 text-amber-200"
              : "border-blue-500/50 bg-blue-500/20 text-blue-200"
          )}
        >
          {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
        </Badge>
      </div>
    </button>
  );
}

/* --------------------------------------------------------------------------------
   Recent Payment Card
-------------------------------------------------------------------------------- */
function PaymentCard({ payment }: { payment: RecentPayment }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20">
          <CreditCard className="h-4 w-4 text-emerald-300" />
        </div>
        <div>
          <p className="text-sm font-medium text-white">{formatCurrencyFromMajor(payment.amount)}</p>
          <p className="text-xs text-white/50">{payment.wardName}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-xs text-white/60">
          {format(parseISO(payment.date), "MMM d")}
        </p>
        <p className="text-[10px] text-white/40 capitalize">{payment.method}</p>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------------
   Main Content
-------------------------------------------------------------------------------- */
function FeesPageContent() {
  const router = useRouter();
  const { data, isLoading, error } = useParentFees();

  const handleWardClick = (wardId: string) => {
    router.push(`/parent/wards/${wardId}?tab=fees`);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-linear-to-br from-red-950/40 to-transparent p-8 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-300/60 mb-4" />
        <p className="text-red-200/80">Failed to load fees data. Please try again.</p>
      </Card>
    );
  }

  const {
    wards = [],
    pendingInvoices = [],
    overallSummary,
    recentPayments = [],
  } = data || {};

  const hasData = wards.length > 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative">
        <div
          className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-10 top-10 h-40 w-40 rounded-full bg-teal-500/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="bg-linear-to-r from-emerald-200 via-teal-200 to-cyan-300 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent lg:text-4xl">
                Fees & Payments
              </h1>
              {hasData && overallSummary?.totalBalance === 0 && (
                <div className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                  <Sparkles className="h-3 w-3" />
                  All Clear
                </div>
              )}
            </div>
            <p className="text-sm text-white/60">
              Manage school fees and view payment history
            </p>
          </div>

          <Button asChild className="gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700">
            <Link href="/parent/payments">
              <Receipt className="h-4 w-4" />
              Payment History
            </Link>
          </Button>
        </div>
      </div>

      {!hasData ? (
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 to-black shadow-2xl p-12 text-center">
          <div className="relative z-10 flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-linear-to-br from-emerald-500/20 to-teal-500/20">
              <Wallet className="h-8 w-8 text-emerald-300" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-white">No Fee Records Yet</h3>
              <p className="text-sm text-white/60 max-w-md">
                Fee information will appear here once the school creates invoices for your children.
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
              icon={DollarSign}
              label="Total Fees"
              value={formatCurrencyFromMajor(overallSummary?.totalFees || 0)}
              subLabel="Across all children"
              tone="blue"
            />
            <SummaryCard
              icon={CheckCircle2}
              label="Total Paid"
              value={formatCurrencyFromMajor(overallSummary?.totalPaid || 0)}
              subLabel={`${overallSummary?.paymentProgress?.toFixed(0) || 0}% complete`}
              tone="emerald"
            />
            <SummaryCard
              icon={Wallet}
              label="Outstanding"
              value={formatCurrencyFromMajor(overallSummary?.totalBalance || 0)}
              subLabel={`${overallSummary?.pendingCount || 0} pending invoices`}
              tone={overallSummary?.totalBalance && overallSummary.totalBalance > 0 ? "red" : "emerald"}
            />
            <SummaryCard
              icon={AlertCircle}
              label="Overdue"
              value={String(overallSummary?.overdueCount || 0)}
              subLabel="Require attention"
              tone={overallSummary?.overdueCount && overallSummary.overdueCount > 0 ? "red" : "emerald"}
            />
          </div>

          {/* Overall Progress */}
          <Card className="relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white/60 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Overall Payment Progress
              </span>
              <span className="text-sm font-medium text-white">
                {overallSummary?.paymentProgress?.toFixed(1) || 0}%
              </span>
            </div>
            <Progress value={overallSummary?.paymentProgress || 0} className="h-2" />
          </Card>

          {/* Main Grid */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Ward Cards & Pending Invoices */}
            <div className="lg:col-span-2 space-y-6">
              {/* Ward Fee Cards */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Users className="h-5 w-5 text-white/60" />
                    Fees by Child
                  </h2>
                </div>

                <div className="space-y-3">
                  {wards.map((ward) => (
                    <WardFeeCard
                      key={ward.wardId}
                      ward={ward}
                      onClick={() => handleWardClick(ward.wardId)}
                    />
                  ))}
                </div>
              </div>

              {/* Pending Invoices */}
              {pendingInvoices.length > 0 && (
                <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 to-black shadow-lg">
                  <div
                    className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-amber-500/10 blur-3xl"
                    aria-hidden="true"
                  />
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white/80">
                      <Receipt className="h-4 w-4 text-amber-300" />
                      Pending Invoices
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative z-10 space-y-2">
                    {pendingInvoices.map((invoice) => (
                      <InvoiceCard
                        key={invoice.id}
                        invoice={invoice}
                        onClick={() => handleWardClick(invoice.wardId)}
                      />
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Recent Payments */}
            <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 to-black shadow-lg backdrop-blur-xl h-fit">
              <div
                className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-500/10 blur-3xl"
                aria-hidden="true"
              />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white/80">
                    <CreditCard className="h-4 w-4 text-emerald-300" />
                    Recent Payments
                  </CardTitle>
                  <Button asChild variant="ghost" size="sm" className="gap-1 text-xs text-brand">
                    <Link href="/parent/payments">
                      View All
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="relative z-10 space-y-2">
                {recentPayments.length > 0 ? (
                  recentPayments.map((payment) => (
                    <PaymentCard key={payment.id} payment={payment} />
                  ))
                ) : (
                  <p className="text-xs text-white/50 text-center py-4">No recent payments</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Payment Info Banner */}
          {overallSummary?.totalBalance && overallSummary.totalBalance > 0 && (
            <Card className="relative overflow-hidden rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/30">
                  <AlertCircle className="h-5 w-5 text-amber-300" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-amber-200">Outstanding Balance</h4>
                  <p className="text-sm text-amber-200/70 mt-1">
                    You have an outstanding balance of <span className="font-semibold">{formatCurrencyFromMajor(overallSummary.totalBalance)}</span>.
                    Please contact the school for payment options.
                  </p>
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------------
   Page Export
-------------------------------------------------------------------------------- */
export default function ParentFeesPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        </div>
      }
    >
      <FeesPageContent />
    </Suspense>
  );
}
