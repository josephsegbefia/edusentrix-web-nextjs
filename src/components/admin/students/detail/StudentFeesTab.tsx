/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatMoney } from "@/lib/fees/money";
import { cn } from "@/lib/utils";
import {
  Wallet,
  Receipt,
  AlertCircle,
  Clock,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  Layers,
  FileText,
  Search,
  X,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { premiumSelectContent } from "@/components/ui/premium";

import type { StudentDetailDTO } from "@/hooks/admin/useStudentDetail";
import { useAcademicPeriods } from "@/hooks/admin/useAcademicPeriods";
import { useStudentCreditBalance } from "@/hooks/admin/useStudentCreditBalance";
import { useInvoice } from "@/hooks/admin/useInvoices";
import { useStudentInvoices } from "@/hooks/admin/useStudentInvoices";
import { useStudentFeesLedger } from "@/hooks/admin/useStudentFeesLedger";
import { useStudentFeesSummary } from "@/hooks/admin/useStudentFeesSummary";
import { useStudentFeesSSE } from "@/hooks/admin/useStudentFeesSSE";
import { RecordPaymentModal } from "@/components/admin/fees/payments/RecordPaymentModal";
import { ApplyCreditModal } from "@/components/admin/fees/credits/ApplyCreditModal";

// New UI blocks (from earlier additions)
import { PendingApprovalsCard } from "@/components/admin/fees/payments/PendingApprovalsCard";
import { PaymentDetailsDrawer } from "@/components/admin/fees/payments/PaymentDetailsDrawer";
import { InvoiceList } from "./InvoiceList";
import { PaymentHistory } from "./PaymentHistory";
import { InstallmentSchedule } from "./InstallmentSchedule";
import { FeesCharts } from "./FeesCharts";
import { ExportStatementButton } from "./ExportStatementButton";
import { FeesAIAccountBriefCard } from "./FeesAIAccountBriefCard";

type Props = {
  student: StudentDetailDTO;
  recordPaymentRequestId?: number | null;
  onRecordPaymentRequestHandled?: () => void;
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(d);
}

function fmtSigned(minor: number) {
  if (minor === 0) return formatMoney(0);
  if (minor < 0) return `-${formatMoney(Math.abs(minor))}`;
  return formatMoney(minor);
}

function safeStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v);
}

const ACTIVE_INVOICE_STATUSES = new Set([
  "issued",
  "partially_paid",
  "paid",
  "overdue",
]);

export function StudentFeesTab({
  student,
  recordPaymentRequestId = null,
  onRecordPaymentRequestHandled,
}: Props) {
  const { data: periodsData, isLoading: periodsLoading } = useAcademicPeriods();
  const [recordPaymentModalOpen, setRecordPaymentModalOpen] =
    React.useState(false);
  const [applyCreditModalOpen, setApplyCreditModalOpen] = React.useState(false);
  const periods = React.useMemo(
    () => periodsData?.periods ?? [],
    [periodsData]
  );

  const currentPeriod = React.useMemo(
    () => periods.find((p: any) => p.isCurrent) ?? null,
    [periods]
  );

  // Term selection (affects invoice/summary/installments)
  const [academicPeriodId, setAcademicPeriodId] = React.useState<string | null>(
    null
  );

  // Ledger view mode
  const [ledgerScope, setLedgerScope] = React.useState<"term" | "all">("term");
  const [includePending, setIncludePending] = React.useState<boolean>(false);

  // Search (client-side filter on loaded rows)
  const [query, setQuery] = React.useState("");

  // Payment drawer
  const [activePaymentId, setActivePaymentId] = React.useState<string | null>(
    null
  );
  const [paymentDrawerOpen, setPaymentDrawerOpen] = React.useState(false);
  const recordPaymentHandledRef = React.useRef(onRecordPaymentRequestHandled);

  // Pick default term once periods arrive
  React.useEffect(() => {
    if (academicPeriodId) return;
    if (currentPeriod?._id) setAcademicPeriodId(currentPeriod._id);
    else if (periods[0]?._id) setAcademicPeriodId(periods[0]._id);
  }, [academicPeriodId, currentPeriod?._id, periods]);

  React.useEffect(() => {
    recordPaymentHandledRef.current = onRecordPaymentRequestHandled;
  }, [onRecordPaymentRequestHandled]);

  // Support opening the payment modal from the profile header action.
  React.useEffect(() => {
    if (recordPaymentRequestId === null) return;
    setRecordPaymentModalOpen(true);
    recordPaymentHandledRef.current?.();
  }, [recordPaymentRequestId]);

  // Fetch invoice list for selected term (summary + installments)
  const { data: termInvoicesData, isLoading: termInvoicesLoading } =
    useStudentInvoices(student.id, {
      academicPeriodId: academicPeriodId || undefined,
      page: 1,
      limit: 100,
    });
  const termInvoices = termInvoicesData?.invoices ?? [];
  const primaryInvoice = React.useMemo(() => {
    if (termInvoices.length === 0) return null;

    const priority: Record<string, number> = {
      overdue: 0,
      partially_paid: 1,
      issued: 2,
      paid: 3,
      draft: 4,
      cancelled: 5,
    };

    return [...termInvoices].sort((a: any, b: any) => {
      const aPriority = priority[a.status] ?? 99;
      const bPriority = priority[b.status] ?? 99;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return (
        new Date(b.createdAt || b.issueDate || 0).getTime() -
        new Date(a.createdAt || a.issueDate || 0).getTime()
      );
    })[0];
  }, [termInvoices]);
  const invoiceId = primaryInvoice?._id ?? null;
  const { data: invoiceDetailData, isLoading: invoiceLoading } = useInvoice(
    invoiceId || ""
  );
  const invoiceDetail = invoiceDetailData?.invoice ?? null;

  // Real-time updates for payments/credits/invoices
  useStudentFeesSSE({ studentId: student.id, invoiceId });

  // Credit wallet
  const { data: creditData, isLoading: creditLoading } =
    useStudentCreditBalance(student.id);
  const creditBalance = creditData?.creditBalance ?? null;

  // Enhanced summary
  const {
    data: summaryData,
    isLoading: summaryLoading,
    isError: summaryError,
  } = useStudentFeesSummary(student.id);
  const effectiveCreditBalance =
    creditBalance?.balanceMinor ?? summaryData?.creditBalance ?? 0;

  // Ledger rows always come from API (term vs all-time driven by academicPeriodId param)
  const ledgerAcademicPeriodId: string | "all" =
    ledgerScope === "all" ? "all" : academicPeriodId || "all";

  const termNotReady = ledgerScope === "term" && !academicPeriodId;

  const { data: ledgerData, isLoading: ledgerLoading } = useStudentFeesLedger(
    student.id,
    ledgerAcademicPeriodId,
    includePending
  );

  const apiRows = React.useMemo(() => {
    const d: any = ledgerData;
    // support either { rows } or { ledger } shapes
    const rows = (d?.rows ?? d?.ledger ?? []) as any[];
    return rows.slice().sort((a, b) => {
      const ad = new Date(a.date).getTime();
      const bd = new Date(b.date).getTime();
      return bd - ad;
    });
  }, [ledgerData]);

  const filteredRows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return apiRows;

    return apiRows.filter((r: any) => {
      const haystack = [
        r.kind,
        r.title,
        r.subtitle,
        r.invoiceNumber,
        r.receiptNumber,
        r.paymentMethod,
        r.status,
        r.approvalStatus,
      ]
        .map(safeStr)
        .join(" • ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [apiRows, query]);

  const termLabel = React.useMemo(() => {
    if (!academicPeriodId)
      return student.feesSummary?.currentTermLabel ?? "Current Term";
    const p = periods.find((x: any) => x._id === academicPeriodId);
    return p ? `${p.yearLabel} • ${p.term}` : "Selected Term";
  }, [academicPeriodId, periods, student.feesSummary?.currentTermLabel]);

  const ledgerHeaderLabel =
    ledgerScope === "all"
      ? "All-time statement"
      : `Term statement • ${termLabel}`;

  const openPayment = React.useCallback((paymentId: string) => {
    setActivePaymentId(paymentId);
    setPaymentDrawerOpen(true);
  }, []);

  // Helper: determine how to render each ledger row
  function getRowUI(row: any) {
    const kind = safeStr(row.kind);

    const isInvoice = kind === "invoice_issued";
    const isPayment = kind === "payment";
    const isPaymentPending =
      kind === "payment_pending" || kind === "paymentProof_pending";
    const isCreditAdded = kind === "credit_added";
    const isCreditApplied = kind === "credit_applied";

    const isPendingApproval =
      isPaymentPending ||
      safeStr(row.approvalStatus) === "pending" ||
      safeStr(row.status) === "pending";

    const clickable = isPayment || isPaymentPending;
    const paymentId = row.paymentId || row._id || null;

    const icon = isInvoice ? (
      <Receipt className="h-4 w-4 text-white/70" />
    ) : clickable ? (
      isPendingApproval ? (
        <Clock className="h-4 w-4 text-amber-200/80" />
      ) : (
        <ArrowDownLeft className="h-4 w-4 text-emerald-300/80" />
      )
    ) : isCreditApplied ? (
      <ArrowDownLeft className="h-4 w-4 text-cyan-300/80" />
    ) : isCreditAdded ? (
      <ArrowUpRight className="h-4 w-4 text-cyan-300/80" />
    ) : (
      <ArrowUpRight className="h-4 w-4 text-cyan-300/80" />
    );

    const badge = isPendingApproval ? (
      <Badge
        variant="outline"
        className="border-amber-400/30 bg-amber-500/10 text-amber-100"
      >
        Pending approval
      </Badge>
    ) : isInvoice ? (
      <Badge
        variant="outline"
        className="border-white/10 bg-white/5 text-white/70"
      >
        Invoice
      </Badge>
    ) : clickable ? (
      <Badge
        variant="outline"
        className="border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
      >
        Payment
      </Badge>
    ) : isCreditApplied ? (
      <Badge
        variant="outline"
        className="border-cyan-400/30 bg-cyan-500/10 text-cyan-200"
      >
        Credit Applied
      </Badge>
    ) : isCreditAdded ? (
      <Badge
        variant="outline"
        className="border-cyan-400/30 bg-cyan-500/10 text-cyan-200"
      >
        Credit Added
      </Badge>
    ) : (
      <Badge
        variant="outline"
        className="border-cyan-400/30 bg-cyan-500/10 text-cyan-200"
      >
        Credit
      </Badge>
    );

    // Ledger amount sign convention:
    // - invoices + credit added => positive
    // - payments + credit applied => negative (reduces outstanding)
    const amountMinor = Number(row.amountMinor || 0);
    const amountText = isInvoice
      ? fmtSigned(amountMinor)
      : clickable || isCreditApplied
      ? fmtSigned(-amountMinor)
      : fmtSigned(amountMinor);

    const amountClass = cn(
      "text-sm font-semibold",
      isInvoice
        ? "text-white/85"
        : clickable
        ? isPendingApproval
          ? "text-amber-100"
          : "text-emerald-200"
        : "text-cyan-200"
    );

    const subtitle = row.subtitle ?? null;

    return {
      icon,
      badge,
      clickable,
      paymentId: paymentId ? String(paymentId) : null,
      isPendingApproval,
      amountText,
      amountClass,
      subtitle,
      kind,
    };
  }

  const showInstallments =
    Boolean(invoiceDetail?._id) &&
    invoiceDetail?.lineItems?.some((li: any) => li.installments?.length);

  const summary = summaryData || null;
  const currentPeriodSummary = summary?.currentPeriod;
  const allTimeSummary = summary?.allTime;
  const upcomingInstallments = summary?.upcomingInstallments;
  const hasCurrentPeriodBilled = Number(currentPeriodSummary?.totalBilled || 0) > 0;
  const averagePaymentTimeSampleCount = Number(
    summary?.trends?.averagePaymentTimeSampleCount || 0
  );
  const hasAveragePaymentTime =
    averagePaymentTimeSampleCount > 0 ||
    Number(summary?.trends?.averagePaymentTime || 0) > 0;

  const termActiveInvoices = React.useMemo(
    () =>
      termInvoices.filter((invoice: any) =>
        ACTIVE_INVOICE_STATUSES.has(String(invoice.status))
      ),
    [termInvoices]
  );
  const termSummary = React.useMemo(
    () => ({
      invoiceCount: termInvoices.length,
      activeInvoiceCount: termActiveInvoices.length,
      totalBilled: termActiveInvoices.reduce(
        (sum: number, invoice: any) => sum + Number(invoice.totalAmountMinor || 0),
        0
      ),
      totalPaid: termActiveInvoices.reduce(
        (sum: number, invoice: any) => sum + Number(invoice.totalPaidMinor || 0),
        0
      ),
      totalOutstanding: termActiveInvoices.reduce(
        (sum: number, invoice: any) =>
          sum + Number(invoice.totalOutstandingMinor || 0),
        0
      ),
      nextDueDate:
        termActiveInvoices
          .filter(
            (invoice: any) =>
              Number(invoice.totalOutstandingMinor || 0) > 0 && invoice.dueDate
          )
          .sort(
            (a: any, b: any) =>
              new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
          )[0]?.dueDate ?? null,
    }),
    [termActiveInvoices, termInvoices.length]
  );
  const hasTermInvoices = termInvoices.length > 0;
  const hasActionableInvoice = Boolean(
    invoiceDetail?._id &&
      ACTIVE_INVOICE_STATUSES.has(String(invoiceDetail.status))
  );
  const canApplyCredit = Boolean(
    hasActionableInvoice &&
      effectiveCreditBalance > 0 &&
      Number(invoiceDetail?.totalOutstandingMinor || 0) > 0
  );

  return (
    <div className="space-y-6">
      {summaryError ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
          Fees summary is temporarily unavailable. Summary cards show placeholders
          until data loads again.
        </div>
      ) : null}

      {/* Enhanced Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Billed */}
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-linear-to-br from-teal-500/15 via-cyan-500/10 to-transparent blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-white/50">
                  Total Billed
                </div>
                <div className="mt-1 text-xl font-bold text-white/90">
                  {summaryLoading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-teal-400" />
                  ) : summaryError ? (
                    "--"
                  ) : (
                    formatMoney(allTimeSummary?.totalBilled ?? 0)
                  )}
                </div>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-linear-to-br from-teal-500/20 to-cyan-500/20 shadow-inner shadow-white/5">
                <FileText className="h-5 w-5 text-teal-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Paid */}
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-linear-to-br from-emerald-500/15 via-emerald-500/10 to-transparent blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-white/50">
                  Total Paid
                </div>
                <div className="mt-1 text-xl font-bold text-emerald-200">
                  {summaryLoading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-emerald-400" />
                  ) : summaryError ? (
                    "--"
                  ) : (
                    formatMoney(allTimeSummary?.totalPaid ?? 0)
                  )}
                </div>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/30 bg-linear-to-br from-emerald-500/20 to-emerald-600/20 shadow-inner shadow-white/5">
                <Receipt className="h-5 w-5 text-emerald-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Collection Rate */}
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-linear-to-br from-cyan-500/15 via-cyan-500/10 to-transparent blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-white/50">
                  Collection Rate
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xl font-bold text-white/90">
                    {summaryLoading ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-cyan-400" />
                    ) : summaryError ? (
                      "--"
                    ) : (
                      hasCurrentPeriodBilled
                        ? `${currentPeriodSummary?.collectionRate ?? 0}%`
                        : "--"
                    )}
                  </span>
                  {hasCurrentPeriodBilled &&
                  summary?.trends?.collectionRateTrend === "up" ? (
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                  ) : hasCurrentPeriodBilled &&
                    summary?.trends?.collectionRateTrend === "down" ? (
                    <TrendingDown className="h-4 w-4 text-red-400" />
                  ) : (
                    <Minus className="h-4 w-4 text-white/40" />
                  )}
                </div>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/30 bg-linear-to-br from-cyan-500/20 to-cyan-600/20 shadow-inner shadow-white/5">
                <TrendingUp className="h-5 w-5 text-cyan-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Average Payment Time */}
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-linear-to-br from-violet-500/15 via-violet-500/10 to-transparent blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-white/50">
                  Avg Payment Time
                </div>
                <div className="mt-1 text-xl font-bold text-white/90">
                  {summaryLoading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-violet-400" />
                  ) : summaryError ? (
                    "--"
                  ) : (
                    hasAveragePaymentTime
                      ? `${summary?.trends?.averagePaymentTime ?? 0} days`
                      : "--"
                  )}
                </div>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-500/30 bg-linear-to-br from-violet-500/20 to-violet-600/20 shadow-inner shadow-white/5">
                <Clock className="h-5 w-5 text-violet-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Outstanding */}
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-linear-to-br from-amber-500/15 via-amber-500/10 to-transparent blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-white/50">
                  Outstanding
                </div>
                <div className="mt-1 text-xl font-bold text-amber-200">
                  {summaryLoading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-amber-400" />
                  ) : summaryError ? (
                    "--"
                  ) : (
                    formatMoney(allTimeSummary?.totalOutstanding ?? 0)
                  )}
                </div>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/30 bg-linear-to-br from-amber-500/20 to-amber-600/20 shadow-inner shadow-white/5">
                <AlertCircle className="h-5 w-5 text-amber-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Credit Balance */}
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-linear-to-br from-cyan-500/15 via-teal-500/10 to-transparent blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-white/50">
                  Credit Balance
                </div>
                <div className="mt-1 text-xl font-bold text-cyan-200">
                  {summaryLoading || creditLoading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-cyan-400" />
                  ) : (
                    formatMoney(effectiveCreditBalance)
                  )}
                </div>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/30 bg-linear-to-br from-cyan-500/20 to-teal-500/20 shadow-inner shadow-white/5">
                <Wallet className="h-5 w-5 text-cyan-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Installments */}
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-linear-to-br from-teal-500/15 via-teal-500/10 to-transparent blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-white/50">
                  Upcoming Installments
                </div>
                <div className="mt-1 text-xl font-bold text-white/90">
                  {summaryLoading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-teal-400" />
                  ) : summaryError ? (
                    "--"
                  ) : (
                    <>
                      {upcomingInstallments?.count ?? 0} due •{" "}
                      {formatMoney(upcomingInstallments?.totalAmount ?? 0)}
                    </>
                  )}
                </div>
                {!summaryError && upcomingInstallments?.nextDueDate && (
                  <div className="mt-1 text-[10px] text-white/50">
                    Next: {fmtDate(upcomingInstallments.nextDueDate)}
                  </div>
                )}
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-teal-500/30 bg-linear-to-br from-teal-500/20 to-teal-600/20 shadow-inner shadow-white/5">
                <Layers className="h-5 w-5 text-teal-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <FeesCharts studentId={student.id} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
        {/* Left: Ledger / Statement */}
        <div className="space-y-6">
          <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
            <div
              className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-linear-to-br from-teal-500/15 via-cyan-500/10 to-transparent blur-3xl"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
              aria-hidden="true"
            />

            <CardHeader className="relative z-10 pb-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-linear-to-br from-teal-500/20 to-cyan-500/20 shadow-inner shadow-white/5">
                  <Receipt className="h-5 w-5 text-teal-300" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold tracking-tight text-white">
                    Fees Ledger
                  </CardTitle>
                  <p className="text-xs text-white/50">{ledgerHeaderLabel}</p>
                </div>
              </div>

              {/* All controls on one line */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Record Payment Button */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRecordPaymentModalOpen(true)}
                  disabled={!hasActionableInvoice}
                  title={
                    hasActionableInvoice
                      ? "Record payment"
                      : "No active invoice available for payment"
                  }
                  className="gap-2 rounded-xl border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                >
                  <Receipt className="h-4 w-4" />
                  Record Payment
                </Button>

                {/* Apply Credit Button */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setApplyCreditModalOpen(true)}
                  disabled={!canApplyCredit}
                  title={
                    canApplyCredit
                      ? "Apply available credit"
                      : "Requires credit balance and outstanding amount on the selected invoice"
                  }
                  className="gap-2 rounded-xl border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
                >
                  <Wallet className="h-4 w-4" />
                  Apply Credit
                </Button>

                <div className="h-6 w-px bg-white/10" />

                {/* Term vs All-time toggle */}
                <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setLedgerScope("term")}
                    className={cn(
                      "h-7 rounded-lg px-3 text-xs",
                      ledgerScope === "term"
                        ? "bg-white/10 text-white shadow-sm shadow-black/30"
                        : "text-white/60 hover:text-white"
                    )}
                  >
                    Term
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setLedgerScope("all")}
                    className={cn(
                      "h-7 rounded-lg px-3 text-xs",
                      ledgerScope === "all"
                        ? "bg-white/10 text-white shadow-sm shadow-black/30"
                        : "text-white/60 hover:text-white"
                    )}
                  >
                    All time
                  </Button>
                </div>

                {/* Include pending toggle */}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setIncludePending((v) => !v)}
                  className={cn(
                    "h-8 gap-2 rounded-xl border-white/10 bg-white/5 text-xs",
                    includePending
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                      : "text-white/70 hover:bg-white/10"
                  )}
                >
                  <Clock className="h-3.5 w-3.5" />
                  {includePending ? "Pending On" : "Pending Off"}
                </Button>

                {/* Term selector dropdown */}
                <Select
                  value={academicPeriodId || undefined}
                  onValueChange={(v) => setAcademicPeriodId(v || null)}
                  disabled={periodsLoading || periods.length === 0}
                >
                  <SelectTrigger className="h-8 w-[180px] rounded-xl border-white/10 bg-white/5 text-xs text-white/80">
                    <Calendar className="mr-2 h-3.5 w-3.5 text-white/60" />
                    <SelectValue placeholder="Select Term" />
                  </SelectTrigger>
                  <SelectContent className={premiumSelectContent}>
                    {periods.map((p: any) => (
                      <SelectItem key={p._id} value={p._id}>
                        {p.yearLabel} • {p.term}
                        {p.isCurrent ? " (Current)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="h-6 w-px bg-white/10" />

                {/* Export button */}
                <ExportStatementButton
                  studentId={student.id}
                  studentName={`${student.firstName} ${student.lastName}`}
                  admissionNo={student.admissionNo}
                  academicPeriodId={academicPeriodId}
                />
              </div>
            </CardHeader>

            <CardContent className="relative z-10 space-y-4">
              {/* Search */}
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5">
                <Search className="h-4 w-4 text-white/50" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search receipts, notes, methods…"
                  className="w-full bg-transparent text-sm text-white/80 outline-none placeholder:text-white/35"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="grid size-7 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              {/* Ledger states */}
              {termNotReady ? (
                <div className="flex items-center justify-center gap-3 py-16">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-teal-400" />
                  <p className="text-sm text-white/60">Loading term…</p>
                </div>
              ) : ledgerLoading ? (
                <div className="flex items-center justify-center gap-3 py-16">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-teal-400" />
                  <p className="text-sm text-white/60">Loading ledger…</p>
                </div>
              ) : filteredRows.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/2 p-8">
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-linear-to-br from-teal-500/20 to-cyan-500/20">
                      <Receipt className="h-7 w-7 text-teal-300" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-base font-semibold text-white">
                        No entries found
                      </p>
                      <p className="text-sm text-white/50">
                        Try a different search or enable pending proofs.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredRows.map((row: any) => {
                    const ui = getRowUI(row);

                    // Optional meta if your API includes it later
                    const allocatedMinor = Number(row.allocatedMinor ?? 0);
                    const unallocatedMinor = Number(row.unallocatedMinor ?? 0);

                    return (
                      <div
                        key={safeStr(row.id || row._id)}
                        role={ui.clickable ? "button" : undefined}
                        tabIndex={ui.clickable ? 0 : -1}
                        onClick={() => {
                          if (!ui.clickable || !ui.paymentId) return;
                          openPayment(ui.paymentId);
                        }}
                        onKeyDown={(e) => {
                          if (!ui.clickable || !ui.paymentId) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openPayment(ui.paymentId);
                          }
                        }}
                        className={cn(
                          "group relative overflow-hidden rounded-xl border border-white/10 bg-white/2 p-4 transition-all duration-200 hover:border-teal-500/30 hover:bg-white/5",
                          ui.clickable && "cursor-pointer"
                        )}
                      >
                        {/* Accent bar */}
                        <div
                          className={cn(
                            "absolute inset-y-0 left-0 w-1 bg-linear-to-b",
                            ui.kind === "invoice_issued"
                              ? "from-white/40 to-white/20"
                              : ui.clickable
                              ? ui.isPendingApproval
                                ? "from-amber-500 to-amber-600"
                                : "from-emerald-500 to-emerald-600"
                              : "from-cyan-500 to-teal-500"
                          )}
                          aria-hidden="true"
                        />

                        <div className="flex items-start justify-between gap-4 pl-3">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                              {ui.icon}
                            </div>

                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="truncate text-sm font-semibold text-white">
                                  {safeStr(row.title)}
                                </div>
                                {ui.badge}
                              </div>

                              <div className="mt-1 text-xs text-white/50">
                                {fmtDate(safeStr(row.date))}
                                {ui.subtitle ? (
                                  <span className="text-white/30"> • </span>
                                ) : null}
                                {ui.subtitle ? safeStr(ui.subtitle) : null}
                              </div>

                              {ui.clickable ? (
                                <div className="mt-1 flex items-center gap-2 text-[11px] text-white/40">
                                  <span>View details</span>
                                  <ChevronRight className="h-3.5 w-3.5" />
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className={ui.amountClass}>{ui.amountText}</div>

                            {/* If API provides these later, we show it nicely; otherwise it stays hidden */}
                            {ui.kind === "payment" &&
                            (allocatedMinor > 0 || unallocatedMinor > 0) ? (
                              <div className="mt-1 text-xs text-white/50">
                                Allocated:{" "}
                                <span className="text-white/70">
                                  {formatMoney(allocatedMinor)}
                                </span>
                                {unallocatedMinor > 0 ? (
                                  <>
                                    <span className="text-white/30"> • </span>
                                    Credit:{" "}
                                    <span className="text-cyan-200">
                                      {formatMoney(unallocatedMinor)}
                                    </span>
                                  </>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Installments preview (term-only, based on selected term invoice) */}
          {ledgerScope === "term" && showInstallments && invoiceDetail ? (
            <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-teal-500/5 via-transparent to-transparent"
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
                aria-hidden="true"
              />
              <CardHeader className="relative z-10 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-linear-to-br from-teal-500/20 to-cyan-500/20">
                    <Layers className="h-4 w-4 text-teal-300" />
                  </div>
                  <CardTitle className="text-base font-semibold text-white">
                    Installments
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="relative z-10 space-y-3">
                {invoiceDetail.lineItems
                  .filter((li: any) => li.installments?.length)
                  .map((li: any) => (
                    <div
                      key={li._id}
                      className="rounded-xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Layers className="h-4 w-4 text-teal-300" />
                            <div className="text-sm font-semibold text-white">
                              {li.name}
                            </div>
                          </div>
                          <div className="mt-1 text-xs text-white/50">
                            {li.installments?.length} installments
                          </div>
                        </div>
                        <div className="text-right text-xs text-white/50">
                          Outstanding:{" "}
                          <span className="font-semibold text-white/80">
                            {formatMoney(li.amountOutstandingMinor)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        {li.installments?.map((inst: any) => (
                          <div
                            key={inst._id}
                            className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs"
                          >
                            <div className="text-white/70">
                              #{inst.installmentNumber} • Due{" "}
                              {fmtDate(inst.dueDate)}
                            </div>
                            <div className="font-medium text-white/80">
                              {formatMoney(inst.amountMinor)}{" "}
                              <span className="text-white/30">•</span>{" "}
                              <span className="text-white/50">
                                {safeStr(inst.status).replaceAll("_", " ")}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>
          ) : null}

          {/* Invoice List */}
          <InvoiceList
            studentId={student.id}
            academicPeriodId={academicPeriodId}
          />

          {/* Payment History — all payments for this student, optionally scoped by term */}
          <PaymentHistory
            studentId={student.id}
            academicPeriodId={academicPeriodId}
          />

          {/* Installment Schedule */}
          <InstallmentSchedule studentId={student.id} />
        </div>

        {/* Right: Pending approvals + Summary + Credit */}
        <div className="space-y-6">
          <FeesAIAccountBriefCard
            studentId={student.id}
            periodId={academicPeriodId}
          />

          {/* Pending approvals for bursar/admin review */}
          <PendingApprovalsCard
            studentId={student.id}
            invoiceId={invoiceId}
            academicPeriodId={academicPeriodId}
            onOpenPayment={(pid) => openPayment(pid)}
          />

          {/* Term Summary (always for selected term; even if ledger is All-time) */}
          <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-teal-500/5 via-transparent to-transparent"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
              aria-hidden="true"
            />
            <CardHeader className="relative z-10 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-linear-to-br from-teal-500/20 to-cyan-500/20">
                  <FileText className="h-4 w-4 text-teal-300" />
                </div>
                <CardTitle className="text-base font-semibold text-white">
                  Term Summary
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="relative z-10 space-y-3">
              {!academicPeriodId ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 text-amber-300" />
                    <div>
                      <div className="text-sm font-semibold text-white">
                        Pick a term
                      </div>
                      <p className="mt-1 text-xs text-white/50">
                        Select a term to load the invoice summary and
                        installments.
                      </p>
                    </div>
                  </div>
                </div>
              ) : termInvoicesLoading || invoiceLoading ? (
                <div className="flex items-center justify-center gap-3 py-10">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-teal-400" />
                  <p className="text-sm text-white/60">Loading term invoices…</p>
                </div>
              ) : hasTermInvoices ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {termLabel}
                        </div>
                        <div className="mt-1 text-xs text-white/50">
                          {termSummary.activeInvoiceCount} active invoice
                          {termSummary.activeInvoiceCount === 1 ? "" : "s"} •{" "}
                          {termSummary.invoiceCount} total
                        </div>
                        {primaryInvoice?.invoiceNumber ? (
                          <div className="mt-1 text-xs text-white/50">
                            Primary invoice: {primaryInvoice.invoiceNumber}
                          </div>
                        ) : null}
                      </div>
                      {primaryInvoice ? (
                        <Badge
                          variant="outline"
                          className="border-white/10 bg-white/5 text-white/70"
                        >
                          {safeStr(primaryInvoice.status).replaceAll("_", " ")}
                        </Badge>
                      ) : null}
                    </div>

                    <Separator className="my-3 bg-white/10" />

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-white/50">Total billed</div>
                        <div className="mt-1 font-semibold text-white/85">
                          {formatMoney(termSummary.totalBilled)}
                        </div>
                      </div>
                      <div>
                        <div className="text-white/50">Total paid</div>
                        <div className="mt-1 font-semibold text-emerald-200">
                          {formatMoney(termSummary.totalPaid)}
                        </div>
                      </div>
                      <div>
                        <div className="text-white/50">Outstanding</div>
                        <div className="mt-1 font-semibold text-white/85">
                          {formatMoney(termSummary.totalOutstanding)}
                        </div>
                      </div>
                      <div>
                        <div className="text-white/50">Next due date</div>
                        <div className="mt-1 font-semibold text-white/75">
                          {termSummary.nextDueDate
                            ? fmtDate(termSummary.nextDueDate)
                            : "--"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {termSummary.activeInvoiceCount === 0 ? (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="mt-0.5 h-5 w-5 text-amber-300" />
                        <div>
                          <div className="text-sm font-semibold text-white">
                            No issued invoice in this term yet
                          </div>
                          <p className="mt-1 text-xs text-white/50">
                            Only draft/cancelled invoices are available, so
                            billed and outstanding totals are shown as 0.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2 rounded-xl border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                      onClick={() => setRecordPaymentModalOpen(true)}
                      disabled={!hasActionableInvoice}
                      title={
                        hasActionableInvoice
                          ? "Record payment"
                          : "No active invoice available for payment"
                      }
                    >
                      <Receipt className="h-4 w-4" />
                      Record Payment
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2 rounded-xl border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
                      onClick={() => setApplyCreditModalOpen(true)}
                      disabled={!canApplyCredit}
                      title={
                        canApplyCredit
                          ? "Apply available credit"
                          : "Requires credit balance and outstanding amount on the selected invoice"
                      }
                    >
                      <Wallet className="h-4 w-4" />
                      Apply Credit
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 text-amber-300" />
                    <div>
                      <div className="text-sm font-semibold text-white">
                        No invoice found for {termLabel}
                      </div>
                      <p className="mt-1 text-xs text-white/50">
                        Create and issue an invoice for this term to enable
                        fees tracking and payment actions.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Credit Wallet */}
          <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-cyan-500/5 via-transparent to-transparent"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
              aria-hidden="true"
            />
            <CardHeader className="relative z-10 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-500/30 bg-linear-to-br from-cyan-500/20 to-teal-500/20">
                  <Wallet className="h-4 w-4 text-cyan-300" />
                </div>
                <CardTitle className="text-base font-semibold text-white">
                  Credit Wallet
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="relative z-10 space-y-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-white/50">Available Balance</div>
                  <div className="text-lg font-bold text-cyan-200">
                    {creditLoading ? (
                      <span className="inline-block h-5 w-8 animate-pulse rounded bg-white/20" />
                    ) : (
                      formatMoney(effectiveCreditBalance)
                    )}
                  </div>
                </div>
                <div className="mt-2 text-xs text-white/50">
                  Credit comes from overpayments and can be applied to outstanding invoices.
                </div>
              </div>

              {creditBalance?.entries?.length ? (
                <div className="space-y-2">
                  {creditBalance.entries
                    .slice()
                    .sort(
                      (a: any, b: any) =>
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime()
                    )
                    .slice(0, 6)
                    .map((e: any, index: number) => {
                      // Create unique key using index and entry identifiers
                      const uniqueId = e.sourcePaymentId
                        ? `payment-${e.sourcePaymentId}`
                        : e.appliedToInvoiceId
                        ? `invoice-${e.appliedToInvoiceId}-${
                            e.appliedToLineItemId || ""
                          }`
                        : `entry-${index}`;
                      return (
                        <div
                          key={`credit-${uniqueId}-${e.createdAt}-${e.amountMinor}-${e.type}`}
                          className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs"
                        >
                          <div>
                            <div className="font-medium text-white/80">
                              {e.type === "credit"
                                ? "Credit added"
                                : "Credit applied"}
                            </div>
                            <div className="mt-1 text-white/50">
                              {fmtDate(e.createdAt)}
                              {e.reason ? (
                                <span className="text-white/30"> • </span>
                              ) : null}
                              {e.reason ?? ""}
                            </div>
                          </div>
                          <div className="font-semibold text-cyan-200">
                            {e.type === "credit"
                              ? fmtSigned(e.amountMinor)
                              : fmtSigned(-e.amountMinor)}
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-white/50">
                  No credit activity yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Payment drawer (details + approve/reject/reverse) */}
      <PaymentDetailsDrawer
        open={paymentDrawerOpen}
        onOpenChange={setPaymentDrawerOpen}
        paymentId={activePaymentId}
      />

      <RecordPaymentModal
        open={recordPaymentModalOpen}
        onOpenChange={setRecordPaymentModalOpen}
        studentId={student.id}
        invoice={invoiceDetail}
      />
      <ApplyCreditModal
        open={applyCreditModalOpen}
        onOpenChange={setApplyCreditModalOpen}
        studentId={student.id}
        invoice={invoiceDetail}
        creditBalanceMinor={effectiveCreditBalance}
      />
    </div>
  );
}
