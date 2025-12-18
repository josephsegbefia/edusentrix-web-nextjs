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
} from "lucide-react";
import { useStudentFeesLedger } from "@/hooks/admin/useStudentFeesLedger";

import type { StudentDetailDTO } from "@/hooks/admin/useStudentDetail";
import { useAcademicPeriods } from "@/hooks/admin/useAcademicPeriods";
import { useStudentCreditBalance } from "@/hooks/admin/useStudentCreditBalance";
import {
  useInvoices,
  useInvoice,
  type InvoiceDetail,
} from "@/hooks/admin/useInvoices";

type Props = {
  student: StudentDetailDTO;
};

type LedgerRow =
  | {
      id: string;
      kind: "invoice_issued";
      date: string;
      title: string;
      subtitle?: string | null;
      amountMinor: number; // billed
      invoiceId: string;
      invoiceNumber?: string;
    }
  | {
      id: string;
      kind: "payment";
      date: string;
      title: string;
      subtitle?: string | null;
      amountMinor: number; // paid (full payment amount)
      invoiceId: string;
      payment: NonNullable<InvoiceDetail["payments"]>[number];
      allocatedMinor: number; // sum allocations
      unallocatedMinor: number; // payment - allocated (typically becomes credit)
    }
  | {
      id: string;
      kind: "credit_added";
      date: string;
      title: string;
      subtitle?: string | null;
      amountMinor: number; // credit increased
      sourcePaymentId?: string | null;
    }
  | {
      id: string;
      kind: "credit_applied";
      date: string;
      title: string;
      subtitle?: string | null;
      amountMinor: number; // credit applied to invoice (reduces outstanding)
      appliedToLineItemName?: string | null;
      appliedToLineItemId?: string | null;
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

export function StudentFeesTab({ student }: Props) {
  const { data: periodsData, isLoading: periodsLoading } = useAcademicPeriods();
  const periods = React.useMemo(
    () => periodsData?.periods ?? [],
    [periodsData?.periods]
  );

  const currentPeriod = React.useMemo(
    () => periods.find((p) => p.isCurrent) ?? null,
    [periods]
  );

  const [academicPeriodId, setAcademicPeriodId] = React.useState<string | null>(
    null
  );

  const [ledgerScope, setLedgerScope] = React.useState<"term" | "all">("term");
  const [includePending, setIncludePending] = React.useState<boolean>(false);

  // Pick default term once periods arrive
  React.useEffect(() => {
    if (academicPeriodId) return;
    if (currentPeriod?._id) setAcademicPeriodId(currentPeriod._id);
    else if (periods[0]?._id) setAcademicPeriodId(periods[0]._id);
  }, [academicPeriodId, currentPeriod?._id, periods]);

  const { data: invoiceListData } = useInvoices(
    academicPeriodId
      ? { studentId: student.id, academicPeriodId, limit: 5, page: 1 }
      : { studentId: student.id, limit: 5, page: 1 }
  );

  // With “1 invoice per student per term”, we’ll display the first one in that term.
  const invoiceId = invoiceListData?.invoices?.[0]?._id ?? null;

  const { data: ledgerData, isLoading: ledgerLoading } = useStudentFeesLedger({
    studentId: student.id,
    scope: ledgerScope,
    includePending,
    invoiceId: ledgerScope === "term" ? invoiceId : null,
    academicPeriodId: ledgerScope === "term" ? academicPeriodId : null,
  });

  // const ledgerRows = (ledgerData?.ledger ?? []) as any[];

  const { data: invoiceDetailData, isLoading: invoiceLoading } = useInvoice(
    invoiceId || ""
  );

  const invoiceDetail = invoiceDetailData?.invoice ?? null;

  const { data: creditData } = useStudentCreditBalance(student.id);
  const creditBalance = creditData?.creditBalance ?? null;

  const termLabel = React.useMemo(() => {
    if (!academicPeriodId)
      return student.feesSummary?.currentTermLabel ?? "Current Term";
    const p = periods.find((x) => x._id === academicPeriodId);
    return p ? `${p.yearLabel} • ${p.term}` : "Selected Term";
  }, [academicPeriodId, periods, student.feesSummary?.currentTermLabel]);

  const ledgerRows: LedgerRow[] = React.useMemo(() => {
    if (!invoiceDetail) {
      // fallback to your existing stub timeline if no invoice found for the selection
      const fallback = (student.feeTimeline ?? []).map((t) => {
        if (t.type === "invoice") {
          return {
            id: `fallback-inv-${t.id}`,
            kind: "invoice_issued",
            date: t.date,
            title: t.label,
            subtitle: t.termLabel ?? null,
            amountMinor: Math.round(t.amount * 100),
            invoiceId: "unknown",
            invoiceNumber: undefined,
          } satisfies LedgerRow;
        }
        return {
          id: `fallback-pay-${t.id}`,
          kind: "payment",
          date: t.date,
          title: t.label,
          subtitle: t.method ?? null,
          amountMinor: Math.round(t.amount * 100),
          invoiceId: "unknown",
          payment: {
            _id: t.id,
            amountMinor: Math.round(t.amount * 100),
            paymentDate: t.date,
            paymentMethod: t.method ?? "other",
            status: "completed",
            allocations: [],
          } as any,
          allocatedMinor: Math.round(t.amount * 100),
          unallocatedMinor: 0,
        } satisfies LedgerRow;
      });

      return fallback.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    }

    const rows: LedgerRow[] = [];

    // 1) Invoice issued (one statement line)
    if (invoiceDetail.issueDate) {
      rows.push({
        id: `inv-${invoiceDetail._id}-issued`,
        kind: "invoice_issued",
        date: invoiceDetail.issueDate,
        title: `Invoice Issued • ${invoiceDetail.invoiceNumber}`,
        subtitle: termLabel,
        amountMinor: invoiceDetail.totalAmountMinor,
        invoiceId: invoiceDetail._id,
        invoiceNumber: invoiceDetail.invoiceNumber,
      });
    }

    // 2) Payments (one line per payment, with breakdown)
    for (const p of invoiceDetail.payments ?? []) {
      const allocatedMinor =
        (p.allocations ?? []).reduce(
          (sum, a) => sum + (a.amountMinor || 0),
          0
        ) || 0;
      const unallocatedMinor = Math.max(
        0,
        (p.amountMinor || 0) - allocatedMinor
      );

      rows.push({
        id: `pay-${p._id}`,
        kind: "payment",
        date: p.paymentDate,
        title: `Payment Received • ${String(p.paymentMethod).replaceAll(
          "_",
          " "
        )}`,
        subtitle: p.receiptNumber ? `Receipt: ${p.receiptNumber}` : undefined,
        amountMinor: p.amountMinor,
        invoiceId: invoiceDetail._id,
        payment: p as any,
        allocatedMinor,
        unallocatedMinor,
      });
    }

    // 3) Credit ledger entries (credit wallet + applications)
    if (creditBalance?.entries?.length) {
      const lineItemNameById = new Map<string, string>();
      for (const li of invoiceDetail.lineItems ?? []) {
        lineItemNameById.set(li._id, li.name);
      }

      for (const e of creditBalance.entries) {
        // Show credit entries relevant to this invoice OR global credit entries.
        // (For now: show all credits, but we label applications clearly.)
        if (e.type === "credit") {
          rows.push({
            id: `credit-${e.createdAt}-${e.amountMinor}`,
            kind: "credit_added",
            date: e.createdAt,
            title: "Credit Added",
            subtitle: e.reason ?? null,
            amountMinor: e.amountMinor,
            sourcePaymentId: e.sourcePaymentId ?? null,
          });
        } else {
          const isForThisInvoice =
            !!e.appliedToInvoiceId &&
            String(e.appliedToInvoiceId) === String(invoiceDetail._id);

          if (!isForThisInvoice) continue;

          const liName = e.appliedToLineItemId
            ? lineItemNameById.get(String(e.appliedToLineItemId)) ?? null
            : null;

          rows.push({
            id: `credit-apply-${e.createdAt}-${e.amountMinor}`,
            kind: "credit_applied",
            date: e.createdAt,
            title: "Credit Applied to Invoice",
            subtitle: e.reason ?? null,
            amountMinor: e.amountMinor,
            appliedToLineItemName: liName,
            appliedToLineItemId: e.appliedToLineItemId ?? null,
          });
        }
      }
    }

    return rows.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [invoiceDetail, creditBalance, student.feeTimeline, termLabel]);

  const hasInvoice = Boolean(invoiceDetail?._id);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
      {/* Left: Ledger / Statement */}
      <div className="space-y-4">
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/5 via-primary/2 to-transparent"
            aria-hidden="true"
          />
          <CardHeader className="relative z-10 flex flex-row items-start justify-between gap-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-2 rounded-md border border-white/10 bg-white/5 p-1">
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

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setIncludePending((v) => !v)}
                className={cn(
                  "text-xs",
                  includePending
                    ? "border-amber-400/30 bg-amber-500/10 text-amber-100"
                    : ""
                )}
              >
                <Clock className="h-4 w-4" />
                {includePending ? "Pending: On" : "Pending: Off"}
              </Button>

              {/* keep your term dropdown visible even when All time is selected (optional) */}
              <div className="hidden md:block">
                <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2 py-1.5">
                  <Calendar className="h-4 w-4 text-white/60" />
                  <select
                    value={academicPeriodId ?? ""}
                    onChange={(e) => setAcademicPeriodId(e.target.value)}
                    className="bg-transparent text-xs text-white/80 outline-none"
                    disabled={periodsLoading}
                  >
                    {periods.map((p) => (
                      <option key={p._id} value={p._id} className="text-black">
                        {p.yearLabel} • {p.term}
                        {p.isCurrent ? " (Current)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-xs"
              >
                <FileText className="h-4 w-4" />
                Export
              </Button>
            </div>
          </CardHeader>

          <CardContent className="relative z-10 space-y-3">
            {!hasInvoice ? (
              <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 text-amber-300/80" />
                <div className="flex-1">
                  <div className="text-sm font-semibold">
                    No invoice found for {termLabel}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Create/issue an invoice for this term to start tracking
                    payments and allocations.
                  </p>
                </div>
              </div>
            ) : ledgerLoading ? (
              <div className="flex items-center justify-center gap-3 py-10 text-sm text-muted-foreground">
                <Clock className="h-5 w-5 animate-spin" />
                Loading ledger…
              </div>
            ) : ledgerRows.length === 0 ? (
              <div className="flex items-center justify-center gap-3 py-10 text-sm text-muted-foreground">
                <AlertCircle className="h-5 w-5" />
                No ledger entries yet.
              </div>
            ) : (
              <div className="space-y-2">
                {ledgerRows.map((row) => {
                  const isPendingApproval =
                    row.kind === "payment" &&
                    row.payment.status === "pending_approval";
                  const isPayment = row.kind === "payment";
                  const isInvoice = row.kind === "invoice_issued";
                  const isCreditAdded = row.kind === "credit_added";
                  const isCreditApplied = row.kind === "credit_applied";

                  const icon = isInvoice ? (
                    <Receipt className="h-4 w-4 text-white/70" />
                  ) : isPayment ? (
                    <ArrowDownLeft className="h-4 w-4 text-emerald-300/80" />
                  ) : isCreditApplied ? (
                    <ArrowDownLeft className="h-4 w-4 text-sky-300/80" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 text-sky-300/80" />
                  );

                  const badge = isPendingApproval ? (
                    <Badge
                      variant="outline"
                      className="border-amber-400/25 bg-amber-500/10 text-amber-100"
                    >
                      Pending Approval
                    </Badge>
                  ) : isInvoice ? (
                    <Badge
                      variant="outline"
                      className="border-white/10 bg-white/5 text-white/70"
                    >
                      Invoice
                    </Badge>
                  ) : isPayment ? (
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

                  const amountText = isInvoice
                    ? fmtSigned(row.amountMinor)
                    : isPayment
                    ? fmtSigned(-row.amountMinor)
                    : isCreditApplied
                    ? fmtSigned(-row.amountMinor)
                    : fmtSigned(row.amountMinor);

                  return (
                    <div
                      key={row.id}
                      className="group rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition-all duration-200 hover:border-white/15 hover:bg-white/7"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 grid size-8 place-items-center rounded-lg border border-white/10 bg-white/5">
                            {icon}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-sm font-semibold">
                                {row.title}
                              </div>
                              {badge}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {fmtDate(row.date)}
                              {row.subtitle ? (
                                <span className="text-white/30"> • </span>
                              ) : null}
                              {row.subtitle ? row.subtitle : null}
                              {isCreditApplied &&
                              (row as any).appliedToLineItemName ? (
                                <span className="text-white/30"> • </span>
                              ) : null}
                              {isCreditApplied &&
                              (row as any).appliedToLineItemName ? (
                                <span>
                                  Line item:{" "}
                                  <span className="text-white/70">
                                    {(row as any).appliedToLineItemName}
                                  </span>
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div
                            className={cn(
                              "text-sm font-semibold",
                              isInvoice
                                ? "text-white/85"
                                : isPendingApproval
                                ? "text-amber-100"
                                : isPayment
                                ? "text-emerald-200"
                                : "text-sky-200"
                            )}
                          >
                            {amountText}
                          </div>

                          {isPayment ? (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Allocated:{" "}
                              <span className="text-white/70">
                                {formatMoney((row as any).allocatedMinor)}
                              </span>
                              {(row as any).unallocatedMinor > 0 ? (
                                <>
                                  <span className="text-white/30"> • </span>
                                  Credit:{" "}
                                  <span className="text-sky-200">
                                    {formatMoney((row as any).unallocatedMinor)}
                                  </span>
                                </>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {isPayment ? (
                        <div className="mt-3">
                          <details className="rounded-lg border border-white/10 bg-black/10 p-3">
                            <summary className="cursor-pointer select-none text-xs font-medium text-white/70">
                              View allocation breakdown
                            </summary>
                            <div className="mt-3 space-y-2">
                              {((row as any).payment.allocations ?? [])
                                .length === 0 ? (
                                <div className="text-xs text-muted-foreground">
                                  No allocations recorded.
                                </div>
                              ) : (
                                (row as any).payment.allocations.map(
                                  (a: any) => (
                                    <div
                                      key={a._id}
                                      className="flex items-center justify-between gap-3 text-xs"
                                    >
                                      <div className="text-white/80">
                                        {a.invoiceLineItemId?.name ??
                                          "Line Item"}
                                      </div>
                                      <div className="font-medium text-white/80">
                                        {formatMoney(a.amountMinor)}
                                      </div>
                                    </div>
                                  )
                                )
                              )}
                              <Separator className="my-2 bg-white/10" />
                              <div className="flex items-center justify-between text-xs">
                                <div className="text-muted-foreground">
                                  Total paid
                                </div>
                                <div className="font-semibold text-emerald-200">
                                  {formatMoney(
                                    (row as any).payment.amountMinor
                                  )}
                                </div>
                              </div>
                            </div>
                          </details>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Installments preview (read-only for now; we’ll make allocation logic next) */}
        {hasInvoice &&
        invoiceDetail?.lineItems?.some((li) => li.installments?.length) ? (
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
                .filter((li) => li.installments?.length)
                .map((li) => (
                  <div
                    key={li._id}
                    className="rounded-xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4 text-white/60" />
                          <div className="text-sm font-semibold">{li.name}</div>
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
                      {li.installments?.map((inst) => (
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
                              {inst.status.replaceAll("_", " ")}
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
      </div>

      {/* Right: Summary + Credit */}
      <div className="space-y-4">
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
            {invoiceDetail ? (
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
                      {invoiceDetail.status.replaceAll("_", " ")}
                    </Badge>
                  </div>

                  <Separator className="my-3 bg-white/10" />

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-muted-foreground">Total billed</div>
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
                  >
                    <Receipt className="mr-1.5 h-4 w-4" />
                    Record Payment
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 border-white/20 bg-white/5 text-xs text-white/80 transition-all duration-200 hover:border-sky-400/50 hover:bg-sky-500/20 hover:text-sky-100 hover:shadow-md hover:shadow-sky-500/20"
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
                      No invoice selected
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Pick a term (top right) to load the invoice and ledger.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

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
                    (a, b) =>
                      new Date(b.createdAt).getTime() -
                      new Date(a.createdAt).getTime()
                  )
                  .slice(0, 6)
                  .map((e) => (
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
                      <div
                        className={cn(
                          "font-semibold",
                          e.type === "credit" ? "text-sky-200" : "text-sky-200"
                        )}
                      >
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
  );
}
