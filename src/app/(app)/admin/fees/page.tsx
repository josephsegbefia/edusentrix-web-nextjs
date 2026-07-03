/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/(app)/admin/fees/page.tsx
"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Receipt,
  ArrowRight,
  PlusCircle,
  CheckCircle2,
  XCircle,
  Timer,
  Users,
} from "lucide-react";
import { useFeeSummary, type DefaulterItem } from "@/hooks/admin/useFeeSummary";
import { useFeesSSE } from "@/hooks/admin/useFeesSSE";
import { formatMoney } from "@/lib/fees/money";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ResponsiveModal } from "@/components/modals/ResponsiveModal";
import CreateInvoiceModal from "@/components/modals/CreateInvoiceModal";
import BulkCreateInvoiceModal from "@/components/modals/BulkCreateInvoiceModal";
import RecordPaymentModal from "@/components/modals/RecordPaymentModal";
import { useCreateInvoice } from "@/hooks/admin/useInvoices";
import { useRecordPayment } from "@/hooks/admin/usePayments";
import { useBusyToast } from "@/hooks/useBusyToast";
import type { CreateInvoiceInput } from "@/schemas/invoice";
import type { CreatePaymentInput } from "@/schemas/payment";
import type { BulkCreateInvoiceInput } from "@/schemas/bulk-invoice";
import {
  PeriodBlockedAlert,
  useOperationBlocked,
} from "@/components/dashboard/PeriodBlockedAlert";

function MetricCard({
  label,
  value,
  icon: Icon,
  accent,
  subtitle,
  trend,
  onClick,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  subtitle?: string;
  trend?: { deltaPct: number; direction: "up" | "down" | "flat" };
  onClick?: () => void;
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

  return (
    <Wrapper
      onClick={onClick}
      className={[
        "relative w-full overflow-hidden rounded-2xl border border-white/10",
        "bg-linear-to-br from-white/5 to-transparent p-5 lg:p-6",
        "shadow-lg shadow-black/20 backdrop-blur",
        onClick
          ? "text-left transition-transform hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          : "",
      ].join(" ")}
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
  highlighted = false,
  className,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  highlighted?: boolean;
  className?: string;
}) {
  const Inner = (
    <div
      className={`
        group w-full text-left my-3 px-4 py-3.5 rounded-xl border transition-all duration-200
        ${
          disabled
            ? "border-white/5 bg-white/5 opacity-40 cursor-not-allowed"
            : highlighted
            ? "border-white/20 bg-white/10"
            : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
        }
      `}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${accent}`}>
          <Icon className="h-4 w-4 text-white/80" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white mb-1">{title}</div>
          <div className="text-xs text-white/60">{description}</div>
        </div>
        {!disabled && (
          <ArrowRight className="h-4 w-4 text-white/40 group-hover:text-white/60 group-hover:translate-x-1 transition-all" />
        )}
      </div>
    </div>
  );

  if (disabled) {
    return (
      <div
        className={
          className
            ? `w-full cursor-not-allowed ${className}`
            : "w-full cursor-not-allowed"
        }
        title="Complete previous steps first"
      >
        {Inner}
      </div>
    );
  }

  if (href)
    return (
      <Link href={href} className={className}>
        {Inner}
      </Link>
    );
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        className ? `w-full text-left ${className}` : "w-full text-left"
      }
    >
      {Inner}
    </button>
  );
}

export default function FeesPage() {
  const { data, isLoading } = useFeeSummary();
  const busy = useBusyToast();
  const createInvoice = useCreateInvoice();
  const recordPayment = useRecordPayment();
  useFeesSSE();

  const [showCreateInvoiceModal, setShowCreateInvoiceModal] =
    React.useState(false);
  const [showBulkCreateInvoiceModal, setShowBulkCreateInvoiceModal] =
    React.useState(false);
  const [showRecordPaymentModal, setShowRecordPaymentModal] =
    React.useState(false);

  // Check if invoice creation is blocked due to period status
  const { isBlocked: isInvoiceCreationBlocked, message: blockedMessage } =
    useOperationBlocked("invoices");

  const handleCreateInvoice = async (payload: CreateInvoiceInput) => {
    // Fix CreateInvoiceInput so it does not contain any nulls for optional fields that expect undefined
    const fixedPayload = {
      ...payload,
      dueDate: payload.dueDate === null ? undefined : payload.dueDate,
      notes: payload.notes === null ? undefined : payload.notes,
      terms: payload.terms === null ? undefined : payload.terms,
      lineItems: payload.lineItems.map((item) => ({
        ...item,
        feeStructureId:
          item.feeStructureId === null ? undefined : item.feeStructureId,
        description: item.description === null ? undefined : item.description,
        numberOfInstallments:
          item.numberOfInstallments === null
            ? undefined
            : item.numberOfInstallments,
        installmentSchedule:
          item.installmentSchedule === null
            ? undefined
            : item.installmentSchedule,
      })),
    };
    const created = await busy
      .promise(createInvoice.mutateAsync(fixedPayload), {
        loading: "Creating bill...",
        success: "Bill created successfully",
        error: (error) => error.message || "Failed to create bill",
      })
      .catch(() => null);

    if (!created) return;
    setShowCreateInvoiceModal(false);
  };

  const handleRecordPayment = async (payload: CreatePaymentInput) => {
    // Fix CreatePaymentInput so it does not contain any nulls for optional fields that expect undefined
    const fixedPayload = {
      ...payload,
      receiptNumber:
        payload.receiptNumber === null ? undefined : payload.receiptNumber,
      notes: payload.notes === null ? undefined : payload.notes,
      allocations: payload.allocations.map((allocation) => ({
        ...allocation,
        installmentScheduleId:
          allocation.installmentScheduleId === null
            ? undefined
            : allocation.installmentScheduleId,
        installmentNumber:
          allocation.installmentNumber === null
            ? undefined
            : allocation.installmentNumber,
        notes: allocation.notes === null ? undefined : allocation.notes,
      })),
    };
    await busy.promise(recordPayment.mutateAsync(fixedPayload), {
      loading: "Recording payment...",
      success: "Payment recorded successfully",
      error: "Failed to record payment",
    });
    setShowRecordPaymentModal(false);
  };

  const handleBulkCreateInvoice = async (payload: BulkCreateInvoiceInput) => {
    await busy.promise(
      fetch("/api/admin/fees/invoices/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(async (res) => {
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Failed to create bulk bills");
        }
        return res.json();
      }),
      {
        loading: `Creating ${payload.studentIds.length} bills...`,
        success: `Successfully created ${payload.studentIds.length} bills`,
        error: "Failed to create bulk bills",
      }
    );
    setShowBulkCreateInvoiceModal(false);
  };

  const summary = data?.summary;
  const statusCounts = data?.statusCounts;
  const upcomingDue = data?.upcomingDue || [];
  const defaulters = data?.defaulters || [];
  const recentPayments = data?.recentPayments || [];

  if (!data && !isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Fees & Payments</h1>
          <p className="text-muted-foreground">
            Manage fee structures and payment records
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load fee data</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Finance
          </p>
          <h1 className="text-3xl font-bold">Fees &amp; Payments</h1>
          <p className="text-muted-foreground">
            Issue bills, track collections, and stay ahead of defaulters.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => {
              if (isInvoiceCreationBlocked) {
                busy.error(
                  blockedMessage ||
                    "Cannot create bills without an active academic period"
                );
                return;
              }
              setShowCreateInvoiceModal(true);
            }}
            className={`bg-brand hover:bg-brand/90 text-white shadow-lg shadow-brand/20 hover:shadow-brand/30 transition-all ${
              isInvoiceCreationBlocked ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            Create Bill
          </Button>
          <button
            type="button"
            onClick={() => {
              if (isInvoiceCreationBlocked) {
                busy.error(
                  blockedMessage ||
                    "Cannot create bills without an active academic period"
                );
                return;
              }
              setShowBulkCreateInvoiceModal(true);
            }}
            className={`group relative flex items-center gap-2 px-4 py-2 rounded-lg border border-white/20 bg-gradient-to-br from-purple-500/20 via-purple-500/10 to-transparent backdrop-blur-sm text-white font-medium transition-all duration-200 hover:from-purple-500/30 hover:via-purple-500/20 hover:to-transparent hover:border-white/30 hover:shadow-lg hover:shadow-purple-500/20 ${
              isInvoiceCreationBlocked ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <PlusCircle className="h-4 w-4 transition-transform group-hover:scale-110" />
            <span>Bulk Create Bills</span>
          </button>
          <button
            type="button"
            onClick={() => setShowRecordPaymentModal(true)}
            className="group relative flex items-center gap-2 px-4 py-2 rounded-lg border border-white/20 bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-transparent backdrop-blur-sm text-white font-medium transition-all duration-200 hover:from-emerald-500/30 hover:via-emerald-500/20 hover:to-transparent hover:border-white/30 hover:shadow-lg hover:shadow-emerald-500/20"
          >
            <Receipt className="h-4 w-4 transition-transform group-hover:scale-110" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* Period Warning Alert */}
      <PeriodBlockedAlert operation="invoices" />

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </>
        ) : (
          <>
            <MetricCard
              label="Total Revenue"
              value={summary ? formatMoney(summary.totalRevenueMinor) : "—"}
              icon={DollarSign}
              accent="from-emerald-500/10 via-emerald-500/5 to-transparent"
            />
            <MetricCard
              label="Monthly Revenue"
              value={summary ? formatMoney(summary.monthlyRevenueMinor) : "—"}
              icon={TrendingUp}
              accent="from-blue-500/10 via-blue-500/5 to-transparent"
            />
            <MetricCard
              label="Outstanding"
              value={summary ? formatMoney(summary.totalOutstandingMinor) : "—"}
              icon={AlertCircle}
              accent="from-orange-500/10 via-orange-500/5 to-transparent"
            />
            <MetricCard
              label="Collection Rate"
              value={summary ? `${summary.collectionRate.toFixed(1)}%` : "—"}
              icon={Receipt}
              accent="from-purple-500/10 via-purple-500/5 to-transparent"
            />
          </>
        )}
      </div>

      {/* Status overview */}
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-blue-500/5 via-blue-500/2 to-transparent"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10 flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-white">Bill Status</CardTitle>
            <p className="text-sm text-white/60">
              Append-only bill model with clear status counts.
            </p>
          </div>
          <Link href="/admin/fees/invoices">
            <Button
              variant="ghost"
              size="sm"
              className="text-white/80 hover:text-white"
            >
              View bills
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="relative z-10">
          {isLoading ? (
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton key={idx} className="h-20" />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
              {[
                {
                  label: "Draft",
                  value: statusCounts?.draft ?? 0,
                  icon: Timer,
                  accent: "from-slate-500/20 via-slate-500/10 to-transparent",
                },
                {
                  label: "Issued",
                  value: statusCounts?.issued ?? 0,
                  icon: Receipt,
                  accent: "from-blue-500/20 via-blue-500/10 to-transparent",
                },
                {
                  label: "Partially Paid",
                  value: statusCounts?.partially_paid ?? 0,
                  icon: DollarSign,
                  accent: "from-amber-500/20 via-amber-500/10 to-transparent",
                },
                {
                  label: "Paid",
                  value: statusCounts?.paid ?? 0,
                  icon: CheckCircle2,
                  accent:
                    "from-emerald-500/20 via-emerald-500/10 to-transparent",
                },
                {
                  label: "Overdue",
                  value: statusCounts?.overdue ?? 0,
                  icon: AlertCircle,
                  accent: "from-red-500/20 via-red-500/10 to-transparent",
                },
                {
                  label: "Cancelled",
                  value: statusCounts?.cancelled ?? 0,
                  icon: XCircle,
                  accent: "from-gray-500/20 via-gray-500/10 to-transparent",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="relative overflow-hidden rounded-xl border border-white/10 bg-linear-to-br from-white/5 to-transparent p-4 shadow-md backdrop-blur"
                >
                  <div
                    className={`pointer-events-none absolute inset-0 bg-linear-to-br ${item.accent}`}
                    aria-hidden="true"
                  />
                  <div className="relative z-10 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-white/60">
                        {item.label}
                      </p>
                      <p className="text-2xl font-semibold text-white drop-shadow-sm">
                        {item.value}
                      </p>
                    </div>
                    <item.icon className="h-5 w-5 text-white/40" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming dues & defaulters */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-amber-500/5 via-amber-500/2 to-transparent"
            aria-hidden="true"
          />
          <CardHeader className="relative z-10 flex items-center justify-between">
            <CardTitle className="text-white">
              Upcoming Due (next 14 days)
            </CardTitle>
            <Badge
              variant="secondary"
              className="bg-amber-500/20 text-amber-300 border-amber-500/30"
            >
              {upcomingDue.length}
            </Badge>
          </CardHeader>
          <CardContent className="relative z-10">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ) : upcomingDue.length === 0 ? (
              <p className="text-sm text-white/60 text-center py-6">
                Nothing due in the next two weeks.
              </p>
            ) : (
              <div className="space-y-3">
                {upcomingDue.map((invoice) => (
                  <Link
                    key={invoice._id}
                    href={`/admin/fees/invoices/${invoice._id}`}
                    className="group block rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:bg-white/10 hover:border-white/20"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-white">
                          {invoice.invoiceNumber}
                        </p>
                        <p className="text-sm text-white/70">
                          {invoice.studentId?.firstName}{" "}
                          {invoice.studentId?.lastName}
                          {invoice.studentId?.admissionNo &&
                            ` • ${invoice.studentId.admissionNo}`}
                        </p>
                        <p className="text-xs text-white/50">
                          {invoice.academicPeriodId?.yearLabel} •{" "}
                          {invoice.academicPeriodId?.term}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-white">
                          {formatMoney(invoice.totalOutstandingMinor)}
                        </p>
                        <p className="text-xs text-white/50">
                          Due {new Date(invoice.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-red-500/5 via-red-500/2 to-transparent"
            aria-hidden="true"
          />
          <CardHeader className="relative z-10 flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-white">Top Defaulters</CardTitle>
              <p className="text-sm text-white/60">
                Highest outstanding balances across bills.
              </p>
            </div>
            <Badge
              variant="outline"
              className="gap-1 bg-red-500/20 text-red-300 border-red-500/30"
            >
              <Users className="h-4 w-4" />
              {defaulters.length}
            </Badge>
          </CardHeader>
          <CardContent className="relative z-10">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ) : defaulters.length === 0 ? (
              <p className="text-sm text-white/60 text-center py-6">
                No outstanding balances recorded.
              </p>
            ) : (
              <div className="space-y-3">
                {defaulters.map((item: DefaulterItem) => (
                  <div
                    key={item.studentId}
                    className="rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:bg-white/10 hover:border-white/20"
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="font-medium text-white">
                          {item.firstName} {item.lastName}
                        </p>
                        <p className="text-xs text-white/60">
                          {item.admissionNo || "—"} • {item.invoiceCount}{" "}
                          bill
                          {item.invoiceCount !== 1 ? "s" : ""}
                        </p>
                        {item.latestDueDate && (
                          <p className="text-xs text-white/50">
                            Latest due{" "}
                            {new Date(item.latestDueDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-white">
                          {formatMoney(item.totalOutstandingMinor)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Payments & Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Payments */}
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-emerald-500/5 via-emerald-500/2 to-transparent"
            aria-hidden="true"
          />
          <CardHeader className="relative z-10">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white">Recent Payments</CardTitle>
              <Link href="/admin/fees/payments">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/80 hover:text-white"
                >
                  View All
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ) : recentPayments.length === 0 ? (
              <p className="text-sm text-white/60 text-center py-4">
                No recent payments
              </p>
            ) : (
              <div className="space-y-3">
                {recentPayments.map((payment: any) => (
                  <div
                    key={payment._id}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:bg-white/10 hover:border-white/20"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-white">
                        {payment.studentId?.firstName}{" "}
                        {payment.studentId?.lastName}
                      </p>
                      <p className="text-sm text-white/70">
                        {payment.invoiceId?.invoiceNumber} •{" "}
                        {payment.paymentMethod}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-white">
                        {formatMoney(payment.amountMinor)}
                      </p>
                      <p className="text-xs text-white/50">
                        {new Date(payment.paymentDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-blue-500/5 via-blue-500/2 to-transparent"
            aria-hidden="true"
          />
          <CardHeader className="relative z-10">
            <CardTitle className="text-white">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="relative z-10 space-y-3">
            <QuickAction
              title="Manage Fee Structures"
              description="Create and manage fee type templates"
              icon={DollarSign}
              accent="bg-blue-500/20"
              href="/admin/fees/structures"
            />
            <QuickAction
              title="View All Bills"
              description="Browse and manage all student bills"
              icon={Receipt}
              accent="bg-purple-500/20"
              href="/admin/fees/invoices"
            />
            {summary && summary.overdueCount > 0 && (
              <QuickAction
                title={`${summary.overdueCount} Overdue Bill${
                  summary.overdueCount !== 1 ? "s" : ""
                }`}
                description="Review bills that require immediate attention"
                icon={AlertCircle}
                accent="bg-orange-500/20"
                href="/admin/fees/invoices?status=overdue"
                highlighted={true}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <ResponsiveModal
        open={showCreateInvoiceModal}
        onClose={() => setShowCreateInvoiceModal(false)}
        title="Create Bill"
        widthClass="max-w-4xl"
      >
        <CreateInvoiceModal
          onClose={() => setShowCreateInvoiceModal(false)}
          onSubmit={handleCreateInvoice}
          isLoading={createInvoice.isPending}
        />
      </ResponsiveModal>

      <ResponsiveModal
        open={showBulkCreateInvoiceModal}
        onClose={() => setShowBulkCreateInvoiceModal(false)}
        title="Bulk Create Bills"
        widthClass="max-w-4xl"
      >
        <BulkCreateInvoiceModal
          onClose={() => setShowBulkCreateInvoiceModal(false)}
          onSubmit={handleBulkCreateInvoice}
          isLoading={false}
        />
      </ResponsiveModal>

      <ResponsiveModal
        open={showRecordPaymentModal}
        onClose={() => setShowRecordPaymentModal(false)}
        title="Record Payment"
        widthClass="max-w-4xl"
      >
        <RecordPaymentModal
          onClose={() => setShowRecordPaymentModal(false)}
          onSubmit={handleRecordPayment}
          isLoading={recordPayment.isPending}
        />
      </ResponsiveModal>
    </div>
  );
}
