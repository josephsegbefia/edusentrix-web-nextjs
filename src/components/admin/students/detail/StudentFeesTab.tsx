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
import { useInvoices, useInvoice } from "@/hooks/admin/useInvoices";
import { useStudentFeesLedger } from "@/hooks/admin/useStudentFeesLedger";
import { useStudentFeesSummary } from "@/hooks/admin/useStudentFeesSummary";
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

type Props = {
  student: StudentDetailDTO;
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

export function StudentFeesTab({ student }: Props) {
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

  // Pick default term once periods arrive
  React.useEffect(() => {
    if (academicPeriodId) return;
    if (currentPeriod?._id) setAcademicPeriodId(currentPeriod._id);
    else if (periods[0]?._id) setAcademicPeriodId(periods[0]._id);
  }, [academicPeriodId, currentPeriod?._id, periods]);

  // Fetch invoice list for selected term (summary + installments)
  const { data: invoiceListData } = useInvoices(
    academicPeriodId
      ? { studentId: student.id, academicPeriodId, limit: 5, page: 1 }
      : { studentId: student.id, limit: 5, page: 1 }
  );

  const invoiceId = invoiceListData?.invoices?.[0]?._id ?? null;
  const { data: invoiceDetailData, isLoading: invoiceLoading } = useInvoice(
    invoiceId || ""
  );
  const invoiceDetail = invoiceDetailData?.invoice ?? null;

  // Credit wallet
  const { data: creditData } = useStudentCreditBalance(student.id);
  const creditBalance = creditData?.creditBalance ?? null;

  // Enhanced summary
  const { data: summaryData, isLoading: summaryLoading } =
    useStudentFeesSummary(student.id);

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
      <ArrowDownLeft className="h-4 w-4 text-sky-300/80" />
    ) : isCreditAdded ? (
      <ArrowUpRight className="h-4 w-4 text-sky-300/80" />
    ) : (
      <ArrowUpRight className="h-4 w-4 text-sky-300/80" />
    );

    const badge = isPendingApproval ? (
      <Badge
        variant="outline"
        className="border-amber-400/25 bg-amber-500/10 text-amber-100"
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
        className="border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
      >
        Payment
      </Badge>
    ) : isCreditApplied ? (
      <Badge
        variant="outline"
        className="border-sky-400/20 bg-sky-500/10 text-sky-200"
      >
        Credit Applied
      </Badge>
    ) : isCreditAdded ? (
      <Badge
        variant="outline"
        className="border-sky-400/20 bg-sky-500/10 text-sky-200"
      >
        Credit Added
      </Badge>
    ) : (
      <Badge
        variant="outline"
        className="border-sky-400/20 bg-sky-500/10 text-sky-200"
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
        : "text-sky-200"
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

  return (
    <div className="space-y-4">
      {/* Enhanced Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Billed */}
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">
                  Total Billed
                </div>
                <div className="mt-1 text-lg font-semibold text-white/90">
                  {summaryLoading ? (
                    <Clock className="h-4 w-4 animate-spin" />
                  ) : (
                    formatMoney(allTimeSummary?.totalBilled ?? 0)
                  )}
                </div>
              </div>
              <div className="rounded-lg bg-white/5 p-2">
                <FileText className="h-5 w-5 text-white/60" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Paid */}
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Total Paid</div>
                <div className="mt-1 text-lg font-semibold text-emerald-200">
                  {summaryLoading ? (
                    <Clock className="h-4 w-4 animate-spin" />
                  ) : (
                    formatMoney(allTimeSummary?.totalPaid ?? 0)
                  )}
                </div>
              </div>
              <div className="rounded-lg bg-emerald-500/10 p-2">
                <Receipt className="h-5 w-5 text-emerald-300/80" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Collection Rate */}
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">
                  Collection Rate
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-lg font-semibold text-white/90">
                    {summaryLoading ? (
                      <Clock className="h-4 w-4 animate-spin" />
                    ) : (
                      `${currentPeriodSummary?.collectionRate ?? 0}%`
                    )}
                  </span>
                  {summary?.trends?.collectionRateTrend === "up" ? (
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                  ) : summary?.trends?.collectionRateTrend === "down" ? (
                    <TrendingDown className="h-4 w-4 text-red-400" />
                  ) : (
                    <Minus className="h-4 w-4 text-white/40" />
                  )}
                </div>
              </div>
              <div className="rounded-lg bg-blue-500/10 p-2">
                <TrendingUp className="h-5 w-5 text-blue-300/80" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Average Payment Time */}
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">
                  Avg Payment Time
                </div>
                <div className="mt-1 text-lg font-semibold text-white/90">
                  {summaryLoading ? (
                    <Clock className="h-4 w-4 animate-spin" />
                  ) : (
                    `${summary?.trends?.averagePaymentTime ?? 0} days`
                  )}
                </div>
              </div>
              <div className="rounded-lg bg-purple-500/10 p-2">
                <Clock className="h-5 w-5 text-purple-300/80" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Outstanding */}
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Outstanding</div>
                <div className="mt-1 text-lg font-semibold text-amber-200">
                  {summaryLoading ? (
                    <Clock className="h-4 w-4 animate-spin" />
                  ) : (
                    formatMoney(allTimeSummary?.totalOutstanding ?? 0)
                  )}
                </div>
              </div>
              <div className="rounded-lg bg-amber-500/10 p-2">
                <AlertCircle className="h-5 w-5 text-amber-300/80" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Credit Balance */}
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">
                  Credit Balance
                </div>
                <div className="mt-1 text-lg font-semibold text-sky-200">
                  {summaryLoading ? (
                    <Clock className="h-4 w-4 animate-spin" />
                  ) : (
                    formatMoney(summary?.creditBalance ?? 0)
                  )}
                </div>
              </div>
              <div className="rounded-lg bg-sky-500/10 p-2">
                <Wallet className="h-5 w-5 text-sky-300/80" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Installments */}
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">
                  Upcoming Installments
                </div>
                <div className="mt-1 text-lg font-semibold text-white/90">
                  {summaryLoading ? (
                    <Clock className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      {upcomingInstallments?.count ?? 0} due •{" "}
                      {formatMoney(upcomingInstallments?.totalAmount ?? 0)}
                    </>
                  )}
                </div>
                {upcomingInstallments?.nextDueDate && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Next: {fmtDate(upcomingInstallments.nextDueDate)}
                  </div>
                )}
              </div>
              <div className="rounded-lg bg-indigo-500/10 p-2">
                <Layers className="h-5 w-5 text-indigo-300/80" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <FeesCharts studentId={student.id} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
        {/* Left: Ledger / Statement */}
        <div className="space-y-4">
          <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
            <div
              className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/5 via-primary/2 to-transparent"
              aria-hidden="true"
            />

            <CardHeader className="relative z-10 pb-3">
              <div className="mb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-white/80">
                  Fees Ledger
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {ledgerHeaderLabel} (invoices, payments, credits)
                </p>
              </div>

              {/* All controls on one line */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Record Payment Button */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRecordPaymentModalOpen(true)}
                  className="border-emerald-400/30 bg-emerald-500/10 text-xs text-emerald-100 hover:border-emerald-400/50 hover:bg-emerald-500/20"
                >
                  <Receipt className="mr-1.5 h-4 w-4" />
                  Record Payment
                </Button>

                {/* Apply Credit Button */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setApplyCreditModalOpen(true)}
                  className="border-sky-400/30 bg-sky-500/10 text-xs text-sky-100 hover:border-sky-400/50 hover:bg-sky-500/20"
                >
                  <Wallet className="mr-1.5 h-4 w-4" />
                  Apply Credit
                </Button>

                <div className="h-6 w-px bg-white/10" />

                {/* Term vs All-time toggle */}
                <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 p-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setLedgerScope("term")}
                    className={cn(
                      "h-7 px-2 text-xs",
                      ledgerScope === "term"
                        ? "bg-white/10 text-white"
                        : "text-white/60"
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
                      "h-7 px-2 text-xs",
                      ledgerScope === "all"
                        ? "bg-white/10 text-white"
                        : "text-white/60"
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
                    "h-7 border-white/10 bg-white/5 text-xs",
                    includePending
                      ? "border-amber-400/30 bg-amber-500/10 text-amber-100"
                      : "text-white/70"
                  )}
                >
                  <Clock className="mr-1.5 h-3.5 w-3.5" />
                  {includePending ? "Pending On" : "Pending Off"}
                </Button>

                {/* Term selector dropdown */}
                <Select
                  value={academicPeriodId || undefined}
                  onValueChange={(v) => setAcademicPeriodId(v || null)}
                  disabled={periodsLoading || periods.length === 0}
                >
                  <SelectTrigger className="h-7 border-white/10 bg-white/5 text-xs text-white/80 w-[180px]">
                    <Calendar className="h-3.5 w-3.5 text-white/60 mr-2" />
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

            <CardContent className="relative z-10 space-y-3">
              {/* Search */}
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <Search className="h-4 w-4 text-white/50" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search receipts, notes, methods…"
                  className="w-full bg-transparent text-xs text-white/80 outline-none placeholder:text-white/35"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="grid size-7 place-items-center rounded-md border border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              {/* Ledger states */}
              {termNotReady ? (
                <div className="flex items-center justify-center gap-3 py-10 text-sm text-muted-foreground">
                  <Clock className="h-5 w-5 animate-spin" />
                  Loading term…
                </div>
              ) : ledgerLoading ? (
                <div className="flex items-center justify-center gap-3 py-10 text-sm text-muted-foreground">
                  <Clock className="h-5 w-5 animate-spin" />
                  Loading ledger…
                </div>
              ) : filteredRows.length === 0 ? (
                <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
                  <AlertCircle className="mt-0.5 h-5 w-5 text-amber-300/80" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold">
                      No entries found
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Try a different search or enable pending proofs.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
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
                          "group rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition-all duration-200 hover:border-white/15 hover:bg-white/7",
                          ui.clickable && "cursor-pointer"
                        )}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 grid size-8 place-items-center rounded-lg border border-white/10 bg-white/5">
                              {ui.icon}
                            </div>

                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="truncate text-sm font-semibold">
                                  {safeStr(row.title)}
                                </div>
                                {ui.badge}
                              </div>

                              <div className="mt-1 text-xs text-muted-foreground">
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
                            <div className={ui.amountClass}>
                              {ui.amountText}
                            </div>

                            {/* If API provides these later, we show it nicely; otherwise it stays hidden */}
                            {ui.kind === "payment" &&
                            (allocatedMinor > 0 || unallocatedMinor > 0) ? (
                              <div className="mt-1 text-xs text-muted-foreground">
                                Allocated:{" "}
                                <span className="text-white/70">
                                  {formatMoney(allocatedMinor)}
                                </span>
                                {unallocatedMinor > 0 ? (
                                  <>
                                    <span className="text-white/30"> • </span>
                                    Credit:{" "}
                                    <span className="text-sky-200">
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
            <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
              <div
                className="pointer-events-none absolute inset-0 bg-linear-to-br from-muted/10 via-muted/5 to-transparent"
                aria-hidden="true"
              />
              <CardHeader className="relative z-10 pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-white/80">
                  Installments
                </CardTitle>
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
                            <Layers className="h-4 w-4 text-white/60" />
                            <div className="text-sm font-semibold">
                              {li.name}
                            </div>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {li.installments?.length} installments
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
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
                            className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/10 px-3 py-2 text-xs"
                          >
                            <div className="text-white/70">
                              #{inst.installmentNumber} • Due{" "}
                              {fmtDate(inst.dueDate)}
                            </div>
                            <div className="font-medium text-white/80">
                              {formatMoney(inst.amountMinor)}{" "}
                              <span className="text-white/30">•</span>{" "}
                              <span className="text-muted-foreground">
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

          {/* Payment History */}
          <PaymentHistory
            studentId={student.id}
            invoiceId={invoiceDetail?._id}
          />

          {/* Installment Schedule */}
          <InstallmentSchedule studentId={student.id} />
        </div>

        {/* Right: Pending approvals + Summary + Credit */}
        <div className="space-y-4">
          {/* Pending approvals for bursar/admin review */}
          <PendingApprovalsCard
            studentId={student.id}
            invoiceId={invoiceDetail?._id}
            academicPeriodId={academicPeriodId || undefined}
            onOpenPayment={(pid) => openPayment(pid)}
          />

          {/* Term Summary (always for selected term; even if ledger is All-time) */}
          <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
            <div
              className="pointer-events-none absolute inset-0 bg-linear-to-br from-muted/10 via-muted/5 to-transparent"
              aria-hidden="true"
            />
            <CardHeader className="relative z-10 pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-white/80">
                Term Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10 space-y-3">
              {!academicPeriodId ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 text-amber-300/80" />
                    <div>
                      <div className="text-sm font-semibold">Pick a term</div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Select a term to load the invoice summary and
                        installments.
                      </p>
                    </div>
                  </div>
                </div>
              ) : invoiceLoading ? (
                <div className="flex items-center justify-center gap-3 py-10 text-sm text-muted-foreground">
                  <Clock className="h-5 w-5 animate-spin" />
                  Loading invoice…
                </div>
              ) : invoiceDetail ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">
                          {invoiceDetail.invoiceNumber}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {termLabel}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-white/10 bg-white/5 text-white/70"
                      >
                        {safeStr(invoiceDetail.status).replaceAll("_", " ")}
                      </Badge>
                    </div>

                    <Separator className="my-3 bg-white/10" />

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-muted-foreground">
                          Total billed
                        </div>
                        <div className="mt-1 font-semibold text-white/85">
                          {formatMoney(invoiceDetail.totalAmountMinor)}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Total paid</div>
                        <div className="mt-1 font-semibold text-emerald-200">
                          {formatMoney(invoiceDetail.totalPaidMinor)}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Outstanding</div>
                        <div className="mt-1 font-semibold text-white/85">
                          {formatMoney(invoiceDetail.totalOutstandingMinor)}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Due date</div>
                        <div className="mt-1 font-semibold text-white/75">
                          {fmtDate(invoiceDetail.dueDate)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 border-white/20 bg-white/5 text-xs text-white/80 transition-all duration-200 hover:border-emerald-400/50 hover:bg-emerald-500/20 hover:text-emerald-100 hover:shadow-md hover:shadow-emerald-500/20"
                      onClick={() => setRecordPaymentModalOpen(true)}
                    >
                      <Receipt className="mr-1.5 h-4 w-4" />
                      Record Payment
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 border-white/20 bg-white/5 text-xs text-white/80 transition-all duration-200 hover:border-sky-400/50 hover:bg-sky-500/20 hover:text-sky-100 hover:shadow-md hover:shadow-sky-500/20"
                      onClick={() => setApplyCreditModalOpen(true)}
                    >
                      <Wallet className="mr-1.5 h-4 w-4" />
                      Apply Credit
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 text-amber-300/80" />
                    <div>
                      <div className="text-sm font-semibold">
                        No invoice found for {termLabel}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Create/issue an invoice for this term to enable
                        installment tracking.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Credit Wallet */}
          <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
            <div
              className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/5 via-primary/2 to-transparent"
              aria-hidden="true"
            />
            <CardHeader className="relative z-10 pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-white/80">
                Credit Wallet
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10 space-y-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">Balance</div>
                  <div className="text-sm font-semibold text-sky-200">
                    {formatMoney(creditBalance?.balanceMinor ?? 0)}
                  </div>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Credit comes from overpayments and can be applied to invoices.
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
                    .map((e: any) => (
                      <div
                        key={`${e.createdAt}-${e.amountMinor}-${e.type}`}
                        className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs"
                      >
                        <div>
                          <div className="font-medium text-white/80">
                            {e.type === "credit"
                              ? "Credit added"
                              : "Credit applied"}
                          </div>
                          <div className="mt-1 text-muted-foreground">
                            {fmtDate(e.createdAt)}
                            {e.reason ? (
                              <span className="text-white/30"> • </span>
                            ) : null}
                            {e.reason ?? ""}
                          </div>
                        </div>
                        <div className="font-semibold text-sky-200">
                          {e.type === "credit"
                            ? fmtSigned(e.amountMinor)
                            : fmtSigned(-e.amountMinor)}
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-muted-foreground">
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
        creditBalanceMinor={creditBalance?.balanceMinor ?? 0}
      />
    </div>
  );
}
