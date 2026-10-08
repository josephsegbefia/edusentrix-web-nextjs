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
  Send,
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
import { useInvoice, useIssueInvoice } from "@/hooks/admin/useInvoices";
import { useStudentInvoices } from "@/hooks/admin/useStudentInvoices";
import { useStudentFeesLedger } from "@/hooks/admin/useStudentFeesLedger";
import { useStudentFeesSummary } from "@/hooks/admin/useStudentFeesSummary";
import { useStudentFeesSSE } from "@/hooks/admin/useStudentFeesSSE";
import { RecordPaymentModal } from "@/components/admin/fees/payments/RecordPaymentModal";
import { ApplyCreditModal } from "@/components/admin/fees/credits/ApplyCreditModal";
import { useBusyToast } from "@/hooks/useBusyToast";

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
const PARENT_VISIBLE_INVOICE_STATUSES = new Set([
  "issued",
  "partially_paid",
  "overdue",
]);

export function StudentFeesTab({
  student,
  recordPaymentRequestId = null,
  onRecordPaymentRequestHandled,
}: Props) {
  const { data: periodsData, isLoading: periodsLoading } = useAcademicPeriods();
  const busy = useBusyToast();
  const issueInvoice = useIssueInvoice();
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

  const handleIssuePrimaryInvoice = React.useCallback(async () => {
    if (!primaryInvoice?._id) return;

    await busy.promise(issueInvoice.mutateAsync(String(primaryInvoice._id)), {
      loading: "Issuing bill...",
      success: "Bill issued. It is now visible to parents for payment.",
      error: (err) => err.message || "Failed to issue bill",
    });
  }, [busy, issueInvoice, primaryInvoice?._id]);

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
      <Receipt className="h-4 w-4 text-(--ws-fg-70)" />
    ) : clickable ? (
      isPendingApproval ? (
        <Clock className="h-4 w-4 text-(--ws-amber)" />
      ) : (
        <ArrowDownLeft className="h-4 w-4 text-(--ws-emerald)" />
      )
    ) : isCreditApplied ? (
      <ArrowDownLeft className="h-4 w-4 text-(--ws-cyan)" />
    ) : isCreditAdded ? (
      <ArrowUpRight className="h-4 w-4 text-(--ws-cyan)" />
    ) : (
      <ArrowUpRight className="h-4 w-4 text-(--ws-cyan)" />
    );

    const badge = isPendingApproval ? (
      <Badge
        variant="outline"
        className="border-amber-400/30 bg-amber-500/10 text-(--ws-amber)"
      >
        Pending approval
      </Badge>
    ) : isInvoice ? (
      <Badge
        variant="outline"
        className="border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-70)"
      >
        Bill
      </Badge>
    ) : clickable ? (
      <Badge
        variant="outline"
        className="border-emerald-400/30 bg-emerald-500/10 text-(--ws-emerald)"
      >
        Payment
      </Badge>
    ) : isCreditApplied ? (
      <Badge
        variant="outline"
        className="border-cyan-400/30 bg-cyan-500/10 text-(--ws-cyan)"
      >
        Credit Applied
      </Badge>
    ) : isCreditAdded ? (
      <Badge
        variant="outline"
        className="border-cyan-400/30 bg-cyan-500/10 text-(--ws-cyan)"
      >
        Credit Added
      </Badge>
    ) : (
      <Badge
        variant="outline"
        className="border-cyan-400/30 bg-cyan-500/10 text-(--ws-cyan)"
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
        ? "text-(--ws-fg-80)"
        : clickable
        ? isPendingApproval
          ? "text-(--ws-amber)"
          : "text-(--ws-emerald)"
        : "text-(--ws-cyan)"
    );

    const title = isInvoice
      ? safeStr(row.title).replace(/^Invoice Issued\b/, "Bill Issued")
      : row.title;
    const subtitle = row.subtitle ?? null;

    return {
      icon,
      badge,
      title,
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
  const termDraftInvoices = React.useMemo(
    () =>
      termInvoices.filter(
        (invoice: any) => String(invoice.status || "draft") === "draft"
      ),
    [termInvoices]
  );
  const termSummary = React.useMemo(
    () => ({
      invoiceCount: termInvoices.length,
      activeInvoiceCount: termActiveInvoices.length,
      draftInvoiceCount: termDraftInvoices.length,
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
      draftBilled: termDraftInvoices.reduce(
        (sum: number, invoice: any) => sum + Number(invoice.totalAmountMinor || 0),
        0
      ),
      draftOutstanding: termDraftInvoices.reduce(
        (sum: number, invoice: any) =>
          sum + Number(invoice.totalOutstandingMinor || 0),
        0
      ),
    }),
    [termActiveInvoices, termDraftInvoices, termInvoices.length]
  );
  const hasTermInvoices = termInvoices.length > 0;
  const hasActionableInvoice = Boolean(
    invoiceDetail?._id &&
      ACTIVE_INVOICE_STATUSES.has(String(invoiceDetail.status))
  );
  const primaryInvoiceStatus = safeStr(primaryInvoice?.status || "");
  const canIssuePrimaryInvoice = Boolean(
    primaryInvoice?._id && primaryInvoiceStatus === "draft"
  );
  const parentCanSeePrimaryInvoice = PARENT_VISIBLE_INVOICE_STATUSES.has(
    primaryInvoiceStatus
  );
  const canApplyCredit = Boolean(
    hasActionableInvoice &&
      effectiveCreditBalance > 0 &&
      Number(invoiceDetail?.totalOutstandingMinor || 0) > 0
  );

  return (
    <div className="space-y-6">
      {summaryError ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-(--ws-amber)">
          Fees summary is temporarily unavailable. Summary cards show placeholders
          until data loads again.
        </div>
      ) : null}

      {/* Enhanced Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Billed */}
        <Card className="relative overflow-hidden rounded-2xl border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) shadow-[var(--ws-shadow)] backdrop-blur-xl">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-linear-to-br from-teal-500/15 via-cyan-500/10 to-transparent blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-(--ws-shine-strong) to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-(--ws-fg-50)">
                  Total Billed
                </div>
                <div className="mt-1 text-xl font-bold text-(--ws-fg-90)">
                  {summaryLoading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-(--ws-line) border-t-teal-400" />
                  ) : summaryError ? (
                    "--"
                  ) : (
                    formatMoney(allTimeSummary?.totalBilled ?? 0)
                  )}
                </div>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-(--ws-line) bg-linear-to-br from-teal-500/20 to-cyan-500/20 shadow-inner shadow-white/5">
                <FileText className="h-5 w-5 text-(--ws-teal)" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Paid */}
        <Card className="relative overflow-hidden rounded-2xl border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) shadow-[var(--ws-shadow)] backdrop-blur-xl">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-linear-to-br from-emerald-500/15 via-emerald-500/10 to-transparent blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-(--ws-shine-strong) to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-(--ws-fg-50)">
                  Total Paid
                </div>
                <div className="mt-1 text-xl font-bold text-(--ws-emerald)">
                  {summaryLoading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-(--ws-line) border-t-emerald-400" />
                  ) : summaryError ? (
                    "--"
                  ) : (
                    formatMoney(allTimeSummary?.totalPaid ?? 0)
                  )}
                </div>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/30 bg-linear-to-br from-emerald-500/20 to-emerald-600/20 shadow-inner shadow-white/5">
                <Receipt className="h-5 w-5 text-(--ws-emerald)" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Collection Rate */}
        <Card className="relative overflow-hidden rounded-2xl border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) shadow-[var(--ws-shadow)] backdrop-blur-xl">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-linear-to-br from-cyan-500/15 via-cyan-500/10 to-transparent blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-(--ws-shine-strong) to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-(--ws-fg-50)">
                  Collection Rate
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xl font-bold text-(--ws-fg-90)">
                    {summaryLoading ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-(--ws-line) border-t-cyan-400" />
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
                    <Minus className="h-4 w-4 text-(--ws-fg-40)" />
                  )}
                </div>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/30 bg-linear-to-br from-cyan-500/20 to-cyan-600/20 shadow-inner shadow-white/5">
                <TrendingUp className="h-5 w-5 text-(--ws-cyan)" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Average Payment Time */}
        <Card className="relative overflow-hidden rounded-2xl border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) shadow-[var(--ws-shadow)] backdrop-blur-xl">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-linear-to-br from-violet-500/15 via-violet-500/10 to-transparent blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-(--ws-shine-strong) to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-(--ws-fg-50)">
                  Avg Payment Time
                </div>
                <div className="mt-1 text-xl font-bold text-(--ws-fg-90)">
                  {summaryLoading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-(--ws-line) border-t-violet-400" />
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
                <Clock className="h-5 w-5 text-(--ws-violet)" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Outstanding */}
        <Card className="relative overflow-hidden rounded-2xl border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) shadow-[var(--ws-shadow)] backdrop-blur-xl">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-linear-to-br from-amber-500/15 via-amber-500/10 to-transparent blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-(--ws-shine-strong) to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-(--ws-fg-50)">
                  Outstanding
                </div>
                <div className="mt-1 text-xl font-bold text-(--ws-amber)">
                  {summaryLoading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-(--ws-line) border-t-amber-400" />
                  ) : summaryError ? (
                    "--"
                  ) : (
                    formatMoney(allTimeSummary?.totalOutstanding ?? 0)
                  )}
                </div>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/30 bg-linear-to-br from-amber-500/20 to-amber-600/20 shadow-inner shadow-white/5">
                <AlertCircle className="h-5 w-5 text-(--ws-amber)" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Credit Balance */}
        <Card className="relative overflow-hidden rounded-2xl border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) shadow-[var(--ws-shadow)] backdrop-blur-xl">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-linear-to-br from-cyan-500/15 via-teal-500/10 to-transparent blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-(--ws-shine-strong) to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-(--ws-fg-50)">
                  Credit Balance
                </div>
                <div className="mt-1 text-xl font-bold text-(--ws-cyan)">
                  {summaryLoading || creditLoading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-(--ws-line) border-t-cyan-400" />
                  ) : (
                    formatMoney(effectiveCreditBalance)
                  )}
                </div>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/30 bg-linear-to-br from-cyan-500/20 to-teal-500/20 shadow-inner shadow-white/5">
                <Wallet className="h-5 w-5 text-(--ws-cyan)" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Installments */}
        <Card className="relative overflow-hidden rounded-2xl border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) shadow-[var(--ws-shadow)] backdrop-blur-xl">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-linear-to-br from-teal-500/15 via-teal-500/10 to-transparent blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-(--ws-shine-strong) to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-(--ws-fg-50)">
                  Upcoming Installments
                </div>
                <div className="mt-1 text-xl font-bold text-(--ws-fg-90)">
                  {summaryLoading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-(--ws-line) border-t-teal-400" />
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
                  <div className="mt-1 text-[10px] text-(--ws-fg-50)">
                    Next: {fmtDate(upcomingInstallments.nextDueDate)}
                  </div>
                )}
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-teal-500/30 bg-linear-to-br from-teal-500/20 to-teal-600/20 shadow-inner shadow-white/5">
                <Layers className="h-5 w-5 text-(--ws-teal)" />
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
          <Card className="relative overflow-hidden rounded-2xl border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) shadow-[var(--ws-shadow)] backdrop-blur-xl">
            <div
              className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-linear-to-br from-teal-500/15 via-cyan-500/10 to-transparent blur-3xl"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-(--ws-shine-strong) to-transparent"
              aria-hidden="true"
            />

            <CardHeader className="relative z-10 pb-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-(--ws-line) bg-linear-to-br from-teal-500/20 to-cyan-500/20 shadow-inner shadow-white/5">
                  <Receipt className="h-5 w-5 text-(--ws-teal)" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold tracking-tight text-(--ws-fg)">
                    Fees Ledger
                  </CardTitle>
                  <p className="text-xs text-(--ws-fg-50)">{ledgerHeaderLabel}</p>
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
                      : "No active bill available for payment"
                  }
                  className="gap-2 rounded-xl border-emerald-500/30 bg-emerald-500/10 text-(--ws-emerald) hover:bg-emerald-500/20"
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
                      : "Requires credit balance and outstanding amount on the selected bill"
                  }
                  className="gap-2 rounded-xl border-cyan-500/30 bg-cyan-500/10 text-(--ws-cyan) hover:bg-cyan-500/20"
                >
                  <Wallet className="h-4 w-4" />
                  Apply Credit
                </Button>

                <div className="h-6 w-px bg-(--ws-fill-strong)" />

                {/* Term vs All-time toggle */}
                <div className="flex items-center gap-1 rounded-xl border border-(--ws-line) bg-(--ws-fill) p-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setLedgerScope("term")}
                    className={cn(
                      "h-7 rounded-lg px-3 text-xs",
                      ledgerScope === "term"
                        ? "bg-(--ws-fill-strong) text-(--ws-fg) shadow-sm shadow-black/30"
                        : "text-(--ws-fg-60) hover:text-(--ws-fg)"
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
                        ? "bg-(--ws-fill-strong) text-(--ws-fg) shadow-sm shadow-black/30"
                        : "text-(--ws-fg-60) hover:text-(--ws-fg)"
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
                    "h-8 gap-2 rounded-xl border-(--ws-line) bg-(--ws-fill) text-xs",
                    includePending
                      ? "border-amber-500/30 bg-amber-500/10 text-(--ws-amber)"
                      : "text-(--ws-fg-70) hover:bg-(--ws-fill-strong)"
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
                  <SelectTrigger className="h-8 w-[180px] rounded-xl border-(--ws-line) bg-(--ws-fill) text-xs text-(--ws-fg-80)">
                    <Calendar className="mr-2 h-3.5 w-3.5 text-(--ws-fg-60)" />
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

                <div className="h-6 w-px bg-(--ws-fill-strong)" />

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
              <div className="flex items-center gap-2 rounded-xl border border-(--ws-line) bg-(--ws-fill) px-4 py-2.5">
                <Search className="h-4 w-4 text-(--ws-fg-50)" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search receipts, notes, methods…"
                  className="w-full bg-transparent text-sm text-(--ws-fg-80) outline-none placeholder:text-(--ws-fg-40)"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="grid size-7 place-items-center rounded-lg border border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-60) hover:bg-(--ws-fill-strong)"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              {/* Ledger states */}
              {termNotReady ? (
                <div className="flex items-center justify-center gap-3 py-16">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-(--ws-line) border-t-teal-400" />
                  <p className="text-sm text-(--ws-fg-60)">Loading term…</p>
                </div>
              ) : ledgerLoading ? (
                <div className="flex items-center justify-center gap-3 py-16">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-(--ws-line) border-t-teal-400" />
                  <p className="text-sm text-(--ws-fg-60)">Loading ledger…</p>
                </div>
              ) : filteredRows.length === 0 ? (
                <div className="rounded-2xl border border-(--ws-line) bg-(--ws-fill) p-8">
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-(--ws-line) bg-linear-to-br from-teal-500/20 to-cyan-500/20">
                      <Receipt className="h-7 w-7 text-(--ws-teal)" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-base font-semibold text-(--ws-fg)">
                        No entries found
                      </p>
                      <p className="text-sm text-(--ws-fg-50)">
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
                          "group relative overflow-hidden rounded-xl border border-(--ws-line) bg-(--ws-fill) p-4 transition-all duration-200 hover:border-teal-500/30 hover:bg-(--ws-fill)",
                          ui.clickable && "cursor-pointer"
                        )}
                      >
                        {/* Accent bar */}
                        <div
                          className={cn(
                            "absolute inset-y-0 left-0 w-1 bg-linear-to-b",
                            ui.kind === "invoice_issued"
                              ? "from-(--ws-fill-strong) to-(--ws-fill)"
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
                            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-(--ws-line) bg-(--ws-fill)">
                              {ui.icon}
                            </div>

                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="truncate text-sm font-semibold text-(--ws-fg)">
                                  {safeStr(ui.title)}
                                </div>
                                {ui.badge}
                              </div>

                              <div className="mt-1 text-xs text-(--ws-fg-50)">
                                {fmtDate(safeStr(row.date))}
                                {ui.subtitle ? (
                                  <span className="text-(--ws-fg-40)"> • </span>
                                ) : null}
                                {ui.subtitle ? safeStr(ui.subtitle) : null}
                              </div>

                              {ui.clickable ? (
                                <div className="mt-1 flex items-center gap-2 text-[11px] text-(--ws-fg-40)">
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
                              <div className="mt-1 text-xs text-(--ws-fg-50)">
                                Allocated:{" "}
                                <span className="text-(--ws-fg-70)">
                                  {formatMoney(allocatedMinor)}
                                </span>
                                {unallocatedMinor > 0 ? (
                                  <>
                                    <span className="text-(--ws-fg-40)"> • </span>
                                    Credit:{" "}
                                    <span className="text-(--ws-cyan)">
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

          {/* Installments preview (term-only, based on selected term bill) */}
          {ledgerScope === "term" && showInstallments && invoiceDetail ? (
            <Card className="relative overflow-hidden rounded-2xl border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) shadow-[var(--ws-shadow)] backdrop-blur-xl">
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-teal-500/5 via-transparent to-transparent"
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-(--ws-shine) to-transparent"
                aria-hidden="true"
              />
              <CardHeader className="relative z-10 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-(--ws-line) bg-linear-to-br from-teal-500/20 to-cyan-500/20">
                    <Layers className="h-4 w-4 text-(--ws-teal)" />
                  </div>
                  <CardTitle className="text-base font-semibold text-(--ws-fg)">
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
                      className="rounded-xl border border-(--ws-line) bg-(--ws-fill) p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Layers className="h-4 w-4 text-(--ws-teal)" />
                            <div className="text-sm font-semibold text-(--ws-fg)">
                              {li.name}
                            </div>
                          </div>
                          <div className="mt-1 text-xs text-(--ws-fg-50)">
                            {li.installments?.length} installments
                          </div>
                        </div>
                        <div className="text-right text-xs text-(--ws-fg-50)">
                          Outstanding:{" "}
                          <span className="font-semibold text-(--ws-fg-80)">
                            {formatMoney(li.amountOutstandingMinor)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        {li.installments?.map((inst: any) => (
                          <div
                            key={inst._id}
                            className="flex items-center justify-between gap-3 rounded-lg border border-(--ws-line) bg-(--ws-fill) px-3 py-2 text-xs"
                          >
                            <div className="text-(--ws-fg-70)">
                              #{inst.installmentNumber} • Due{" "}
                              {fmtDate(inst.dueDate)}
                            </div>
                            <div className="font-medium text-(--ws-fg-80)">
                              {formatMoney(inst.amountMinor)}{" "}
                              <span className="text-(--ws-fg-40)">•</span>{" "}
                              <span className="text-(--ws-fg-50)">
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

          {/* Bill List */}
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
          <Card className="relative overflow-hidden rounded-2xl border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) shadow-[var(--ws-shadow)] backdrop-blur-xl">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-teal-500/5 via-transparent to-transparent"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-(--ws-shine) to-transparent"
              aria-hidden="true"
            />
            <CardHeader className="relative z-10 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-(--ws-line) bg-linear-to-br from-teal-500/20 to-cyan-500/20">
                  <FileText className="h-4 w-4 text-(--ws-teal)" />
                </div>
                <CardTitle className="text-base font-semibold text-(--ws-fg)">
                  Term Summary
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="relative z-10 space-y-3">
              {!academicPeriodId ? (
                <div className="rounded-xl border border-(--ws-line) bg-(--ws-fill) p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 text-(--ws-amber)" />
                    <div>
                      <div className="text-sm font-semibold text-(--ws-fg)">
                        Pick a term
                      </div>
                      <p className="mt-1 text-xs text-(--ws-fg-50)">
                        Select a term to load the bill summary and
                        installments.
                      </p>
                    </div>
                  </div>
                </div>
              ) : termInvoicesLoading || invoiceLoading ? (
                <div className="flex items-center justify-center gap-3 py-10">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-(--ws-line) border-t-teal-400" />
                  <p className="text-sm text-(--ws-fg-60)">Loading term bills...</p>
                </div>
              ) : hasTermInvoices ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-(--ws-line) bg-(--ws-fill) p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-(--ws-fg)">
                          {termLabel}
                        </div>
                        <div className="mt-1 text-xs text-(--ws-fg-50)">
                          {termSummary.activeInvoiceCount} active bill
                          {termSummary.activeInvoiceCount === 1 ? "" : "s"} •{" "}
                          {termSummary.draftInvoiceCount} draft •{" "}
                          {termSummary.invoiceCount} total
                        </div>
                        {primaryInvoice?.invoiceNumber ? (
                          <div className="mt-1 text-xs text-(--ws-fg-50)">
                            Primary bill: {primaryInvoice.invoiceNumber}
                          </div>
                        ) : null}
                      </div>
                      {primaryInvoice ? (
                        <Badge
                          variant="outline"
                          className="border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-70)"
                        >
                          {safeStr(primaryInvoice.status).replaceAll("_", " ")}
                        </Badge>
                      ) : null}
                    </div>

                    <Separator className="my-3 bg-(--ws-fill-strong)" />

                    {primaryInvoice ? (
                      <div className="mb-3 rounded-xl border border-(--ws-line) bg-(--ws-fill) p-3 text-xs">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="font-medium text-(--ws-fg-80)">
                              Parent visibility
                            </div>
                            <p className="mt-1 text-(--ws-fg-50)">
                              {parentCanSeePrimaryInvoice
                                ? "This bill is issued and can appear in the parent fees account."
                                : "Draft bills are admin-only. Issue this bill before parents can see or pay it."}
                            </p>
                          </div>
                          {canIssuePrimaryInvoice ? (
                            <Button
                              type="button"
                              size="sm"
                              className="gap-2 rounded-xl bg-teal-500 text-slate-950 hover:bg-teal-400"
                              onClick={handleIssuePrimaryInvoice}
                              disabled={issueInvoice.isPending}
                            >
                              <Send className="h-4 w-4" />
                              Issue Bill
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-(--ws-fg-50)">Issued bill total</div>
                        <div className="mt-1 font-semibold text-(--ws-fg-80)">
                          {formatMoney(termSummary.totalBilled)}
                        </div>
                      </div>
                      <div>
                        <div className="text-(--ws-fg-50)">Total paid</div>
                        <div className="mt-1 font-semibold text-(--ws-emerald)">
                          {formatMoney(termSummary.totalPaid)}
                        </div>
                      </div>
                      <div>
                        <div className="text-(--ws-fg-50)">Issued outstanding</div>
                        <div className="mt-1 font-semibold text-(--ws-fg-80)">
                          {formatMoney(termSummary.totalOutstanding)}
                        </div>
                      </div>
                      <div>
                        <div className="text-(--ws-fg-50)">Next due date</div>
                        <div className="mt-1 font-semibold text-(--ws-fg-70)">
                          {termSummary.nextDueDate
                            ? fmtDate(termSummary.nextDueDate)
                            : "--"}
                        </div>
                      </div>
                      {termSummary.draftInvoiceCount > 0 ? (
                        <>
                          <div>
                            <div className="text-(--ws-fg-50)">Draft billed</div>
                            <div className="mt-1 font-semibold text-(--ws-amber)">
                              {formatMoney(termSummary.draftBilled)}
                            </div>
                          </div>
                          <div>
                            <div className="text-(--ws-fg-50)">Draft outstanding</div>
                            <div className="mt-1 font-semibold text-(--ws-amber)">
                              {formatMoney(termSummary.draftOutstanding)}
                            </div>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {termSummary.activeInvoiceCount === 0 ? (
                    <div className="rounded-xl border border-(--ws-line) bg-(--ws-fill) p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="mt-0.5 h-5 w-5 text-(--ws-amber)" />
                        <div>
                          <div className="text-sm font-semibold text-(--ws-fg)">
                            No issued bill in this term yet
                          </div>
                          <p className="mt-1 text-xs text-(--ws-fg-50)">
                            {termSummary.draftInvoiceCount > 0
                              ? `This term has ${termSummary.draftInvoiceCount} draft bill${
                                  termSummary.draftInvoiceCount === 1 ? "" : "s"
                                } with ${formatMoney(
                                  termSummary.draftOutstanding
                                )} draft outstanding. Issue the bill to include it in issued totals, parent fees, and payment actions.`
                              : "Only withdrawn bills are available for this term, so there is no active bill to show."}
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
                      className="flex-1 gap-2 rounded-xl border-emerald-500/30 bg-emerald-500/10 text-(--ws-emerald) hover:bg-emerald-500/20"
                      onClick={() => setRecordPaymentModalOpen(true)}
                      disabled={!hasActionableInvoice}
                      title={
                        hasActionableInvoice
                          ? "Record payment"
                          : "No active bill available for payment"
                      }
                    >
                      <Receipt className="h-4 w-4" />
                      Record Payment
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2 rounded-xl border-cyan-500/30 bg-cyan-500/10 text-(--ws-cyan) hover:bg-cyan-500/20"
                      onClick={() => setApplyCreditModalOpen(true)}
                      disabled={!canApplyCredit}
                      title={
                        canApplyCredit
                          ? "Apply available credit"
                          : "Requires credit balance and outstanding amount on the selected bill"
                      }
                    >
                      <Wallet className="h-4 w-4" />
                      Apply Credit
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-(--ws-line) bg-(--ws-fill) p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 text-(--ws-amber)" />
                    <div>
                      <div className="text-sm font-semibold text-(--ws-fg)">
                        No bill found for {termLabel}
                      </div>
                      <p className="mt-1 text-xs text-(--ws-fg-50)">
                        Create and issue a bill for this term to enable
                        fees tracking and payment actions.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Credit Wallet */}
          <Card className="relative overflow-hidden rounded-2xl border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) shadow-[var(--ws-shadow)] backdrop-blur-xl">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-cyan-500/5 via-transparent to-transparent"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-(--ws-shine) to-transparent"
              aria-hidden="true"
            />
            <CardHeader className="relative z-10 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-500/30 bg-linear-to-br from-cyan-500/20 to-teal-500/20">
                  <Wallet className="h-4 w-4 text-(--ws-cyan)" />
                </div>
                <CardTitle className="text-base font-semibold text-(--ws-fg)">
                  Credit Wallet
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="relative z-10 space-y-3">
              <div className="rounded-xl border border-(--ws-line) bg-(--ws-fill) p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-(--ws-fg-50)">Available Balance</div>
                  <div className="text-lg font-bold text-(--ws-cyan)">
                    {creditLoading ? (
                      <span className="inline-block h-5 w-8 animate-pulse rounded bg-(--ws-fill)0" />
                    ) : (
                      formatMoney(effectiveCreditBalance)
                    )}
                  </div>
                </div>
                <div className="mt-2 text-xs text-(--ws-fg-50)">
                  Credit comes from overpayments and can be applied to outstanding bills.
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
                          className="flex items-start justify-between gap-3 rounded-xl border border-(--ws-line) bg-(--ws-fill) px-4 py-3 text-xs"
                        >
                          <div>
                            <div className="font-medium text-(--ws-fg-80)">
                              {e.type === "credit"
                                ? "Credit added"
                                : "Credit applied"}
                            </div>
                            <div className="mt-1 text-(--ws-fg-50)">
                              {fmtDate(e.createdAt)}
                              {e.reason ? (
                                <span className="text-(--ws-fg-40)"> • </span>
                              ) : null}
                              {e.reason ?? ""}
                            </div>
                          </div>
                          <div className="font-semibold text-(--ws-cyan)">
                            {e.type === "credit"
                              ? fmtSigned(e.amountMinor)
                              : fmtSigned(-e.amountMinor)}
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="rounded-xl border border-(--ws-line) bg-(--ws-fill) p-4 text-xs text-(--ws-fg-50)">
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
