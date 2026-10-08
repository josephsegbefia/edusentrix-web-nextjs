/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/fees/money";
import { cn } from "@/lib/utils";
import {
  FileText,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Receipt,
  CreditCard,
  Wallet,
  NotebookText,
  Info,
} from "lucide-react";
import { useInvoice } from "@/hooks/admin/useInvoices";

const DEMO_MARKER = "marketing-video-2026";

function fmtDate(iso: string | Date | null | undefined) {
  if (!iso) return "N/A";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "N/A";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(d);
}

function statusBadge(status: string) {
  const statusMap: Record<string, { label: string; className: string; icon: any }> = {
    draft: {
      label: "Draft",
      className: "border-(--ws-line-strong) bg-(--ws-fill) text-(--ws-fg-70)",
      icon: FileText,
    },
    issued: {
      label: "Issued",
      className: "border-blue-400/25 bg-blue-500/10 text-blue-200",
      icon: Clock,
    },
    paid: {
      label: "Paid",
      className: "border-emerald-400/25 bg-emerald-500/10 text-(--ws-emerald)",
      icon: CheckCircle2,
    },
    overdue: {
      label: "Overdue",
      className: "border-red-400/25 bg-red-500/10 text-red-200",
      icon: AlertCircle,
    },
    partially_paid: {
      label: "Partially Paid",
      className: "border-amber-400/25 bg-amber-500/10 text-(--ws-amber)",
      icon: Clock,
    },
    cancelled: {
      label: "Cancelled",
      className: "border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-70)",
      icon: XCircle,
    },
  };

  const config = statusMap[status] || statusMap.draft;
  const Icon = config.icon;

  return (
    <Badge className={cn("gap-1.5", config.className)} variant="outline">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

function cleanDemoMarker(value: string | null | undefined) {
  const text = String(value || "").trim();
  if (!text) return { text: "", hadMarker: false };
  const pattern = new RegExp(`^\\[${DEMO_MARKER}\\]\\s*`, "i");
  return {
    text: text.replace(pattern, "").trim(),
    hadMarker: pattern.test(text),
  };
}

function SummaryTile(props: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "white" | "emerald" | "amber" | "sky";
}) {
  const Icon = props.icon;
  const toneClass = {
    white: "border-(--ws-line) bg-(--ws-fill) text-(--ws-fg)",
    emerald: "border-emerald-400/20 bg-emerald-500/10 text-(--ws-emerald)",
    amber: "border-amber-400/20 bg-amber-500/10 text-(--ws-amber)",
    sky: "border-sky-400/20 bg-sky-500/10 text-sky-100",
  }[props.tone];

  return (
    <div className={cn("rounded-2xl border p-4 shadow-inner", toneClass)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-(--ws-fg-40)">
          {props.label}
        </p>
        <Icon className="h-4 w-4 text-(--ws-fg-40)" />
      </div>
      <p className="mt-3 text-lg font-semibold text-(--ws-fg)">{props.value}</p>
    </div>
  );
}

export function InvoiceDetailDrawer(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invoiceId: string | null;
  studentId: string;
}) {
  const { data, isLoading, isError } = useInvoice(props.invoiceId || "");

  const invoice = data?.invoice;
  const cleanNotes = cleanDemoMarker(invoice?.notes);
  const hasDemoMarker =
    cleanNotes.hadMarker ||
    Boolean(
      invoice?.lineItems?.some((item: any) => cleanDemoMarker(item.description).hadMarker)
    );

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent className="w-full overflow-y-auto border-(--ws-line) bg-(--ws-popover) p-0 text-(--ws-fg) shadow-2xl shadow-black/50 backdrop-blur-2xl sm:max-w-3xl">
        <SheetHeader className="sticky top-0 z-20 border-b border-(--ws-line) bg-(--ws-popover)/85 px-5 py-4 backdrop-blur-xl sm:px-7">
          <SheetTitle className="flex items-center justify-between gap-4">
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-(--ws-line) bg-(--ws-fill) shadow-inner">
                <FileText className="h-5 w-5 text-(--ws-cyan)" />
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.28em] text-(--ws-fg-40)">
                  Bill Details
                </span>
                <span className="mt-1 block truncate text-lg font-semibold text-(--ws-fg)">
                  {invoice?.invoiceNumber || "Student bill"}
                </span>
              </span>
            </span>
            {invoice && statusBadge(invoice.status)}
          </SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="m-5 flex items-center justify-center gap-3 rounded-2xl border border-(--ws-line) bg-(--ws-fill) py-20 text-sm text-(--ws-fg-50) sm:m-7">
            <Clock className="h-5 w-5 animate-spin text-(--ws-cyan)" />
            Loading bill details...
          </div>
        ) : isError || !invoice ? (
          <div className="m-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-8 text-center sm:m-7">
            <AlertCircle className="mx-auto h-12 w-12 text-red-400/50" />
            <p className="mt-3 text-sm font-medium text-red-200">
              Failed to load bill
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Please try again later
            </p>
          </div>
        ) : (
          <div className="space-y-6 px-5 py-6 sm:px-7 sm:py-7">
            <section className="relative overflow-hidden rounded-3xl border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) p-5 shadow-[var(--ws-shadow)] sm:p-6">
              <div
                className="pointer-events-none absolute inset-x-8 top-0 h-px bg-linear-to-r from-transparent via-white/25 to-transparent"
                aria-hidden="true"
              />
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {statusBadge(invoice.status)}
                    {invoice.academicPeriodId ? (
                      <span className="rounded-full border border-(--ws-line) bg-(--ws-fill) px-3 py-1 text-xs text-(--ws-fg-60)">
                        {invoice.academicPeriodId.yearLabel} • {invoice.academicPeriodId.term}
                      </span>
                    ) : null}
                  </div>
                  <h2 className="mt-4 break-words text-2xl font-semibold tracking-tight text-(--ws-fg)">
                    {invoice.invoiceNumber}
                  </h2>
                  <div className="mt-4 grid gap-3 text-sm text-(--ws-fg-60) sm:grid-cols-2">
                    <div className="flex items-center gap-2 rounded-xl border border-(--ws-line) bg-(--ws-fill) px-3 py-2">
                      <Calendar className="h-4 w-4 text-(--ws-fg-40)" />
                      <span>Issued {fmtDate(invoice.issueDate)}</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-(--ws-line) bg-(--ws-fill) px-3 py-2">
                      <Clock className="h-4 w-4 text-(--ws-fg-40)" />
                      <span>Due {fmtDate(invoice.dueDate)}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-(--ws-line) bg-(--ws-fill) p-4 text-left shadow-inner lg:min-w-52 lg:text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--ws-fg-40)">
                    Amount Due
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-(--ws-fg)">
                    {formatMoney(invoice.totalOutstandingMinor)}
                  </p>
                  <p className="mt-1 text-xs text-(--ws-fg-40)">
                    of {formatMoney(invoice.totalAmountMinor)} billed
                  </p>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <SummaryTile
                label="Total billed"
                value={formatMoney(invoice.totalAmountMinor)}
                icon={Receipt}
                tone="white"
              />
              <SummaryTile
                label="Total paid"
                value={formatMoney(invoice.totalPaidMinor)}
                icon={CheckCircle2}
                tone="emerald"
              />
              <SummaryTile
                label="Outstanding"
                value={formatMoney(invoice.totalOutstandingMinor)}
                icon={Wallet}
                tone="amber"
              />
                {invoice.totalCreditAppliedMinor > 0 && (
                <SummaryTile
                  label="Credit applied"
                  value={formatMoney(invoice.totalCreditAppliedMinor)}
                  icon={Wallet}
                  tone="sky"
                />
                )}
            </section>

            {/* Line Items */}
            {invoice.lineItems && invoice.lineItems.length > 0 && (
              <section className="rounded-3xl border border-(--ws-line) bg-(--ws-fill) p-4 shadow-xl shadow-black/20 sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--ws-fg-40)">
                      Line Items
                    </p>
                    <h3 className="mt-1 text-base font-semibold text-(--ws-fg)">
                      What this bill covers
                    </h3>
                  </div>
                  <NotebookText className="h-5 w-5 text-(--ws-fg-40)" />
                </div>
                <div className="space-y-3">
                  {invoice.lineItems.map((item: any) => (
                    <div
                      key={item._id}
                      className="rounded-2xl border border-(--ws-line) bg-linear-to-br from-(--ws-fill-strong) to-(--ws-fill) p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-(--ws-fg)">{item.name}</div>
                          {cleanDemoMarker(item.description).text && (
                            <p className="mt-1 text-sm leading-5 text-(--ws-fg-50)">
                              {cleanDemoMarker(item.description).text}
                            </p>
                          )}
                          {item.isAdjustment && (
                            <Badge
                              className="mt-2 border-(--ws-line) bg-(--ws-fill) text-xs"
                              variant="outline"
                            >
                              Adjustment: {item.adjustmentType || "other"}
                            </Badge>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-base font-semibold text-(--ws-fg)">
                            {formatMoney(item.amountMinor)}
                          </div>
                          <div className="mt-2 flex flex-col items-end gap-1 text-xs">
                            {item.amountPaidMinor > 0 && (
                              <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-(--ws-emerald)">
                                Paid {formatMoney(item.amountPaidMinor)}
                              </span>
                            )}
                            {item.amountOutstandingMinor > 0 && (
                              <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-(--ws-amber)">
                                Outstanding {formatMoney(item.amountOutstandingMinor)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {item.installments && item.installments.length > 0 && (
                        <div className="mt-3 border-t border-(--ws-line) pt-3">
                          <div className="text-xs font-medium text-muted-foreground mb-2">
                            Installments ({item.installments.length})
                          </div>
                          <div className="space-y-1">
                            {item.installments.map((inst: any) => (
                              <div
                                key={inst._id}
                                className="flex items-center justify-between text-xs"
                              >
                                <span className="text-muted-foreground">
                                  Installment {inst.installmentNumber} •{" "}
                                  {fmtDate(inst.dueDate)}
                                </span>
                                <span className="font-medium text-(--ws-fg-80)">
                                  {formatMoney(inst.amountOutstandingMinor)} /{" "}
                                  {formatMoney(inst.amountMinor)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Payments */}
            {invoice.payments && invoice.payments.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-(--ws-fg-80)">
                  Payments ({invoice.payments.length})
                </h3>
                <div className="space-y-2">
                  {invoice.payments.map((payment: any) => (
                    <div
                      key={payment._id}
                      className="rounded-lg border border-(--ws-line) bg-(--ws-fill) p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Receipt className="h-4 w-4 text-muted-foreground" />
                            <div className="font-medium text-(--ws-fg-90)">
                              {formatMoney(payment.amountMinor)}
                            </div>
                            {payment.receiptNumber && (
                              <Badge
                                className="border-(--ws-line) bg-(--ws-fill) text-xs"
                                variant="outline"
                              >
                                {payment.receiptNumber}
                              </Badge>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span>{fmtDate(payment.paymentDate)}</span>
                            <span className="flex items-center gap-1">
                              <CreditCard className="h-3 w-3" />
                              {payment.paymentMethod}
                            </span>
                            <Badge
                              className={cn(
                                "text-xs",
                                payment.status === "completed"
                                  ? "border-emerald-400/25 bg-emerald-500/10 text-(--ws-emerald)"
                                  : "border-amber-400/25 bg-amber-500/10 text-(--ws-amber)"
                              )}
                              variant="outline"
                            >
                              {payment.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      {payment.allocations && payment.allocations.length > 0 && (
                        <div className="mt-3 border-t border-(--ws-line) pt-3">
                          <div className="text-xs font-medium text-muted-foreground mb-2">
                            Allocations
                          </div>
                          <div className="space-y-1">
                            {payment.allocations.map((alloc: any) => (
                              <div
                                key={alloc._id}
                                className="flex items-center justify-between text-xs"
                              >
                                <span className="text-muted-foreground">
                                  {alloc.invoiceLineItemId?.name || "Unknown"}
                                </span>
                                <span className="font-medium text-(--ws-fg-80)">
                                  {formatMoney(alloc.amountMinor)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {cleanNotes.text && (
              <section className="rounded-3xl border border-(--ws-line) bg-(--ws-fill) p-4 sm:p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--ws-fg-40)">
                  Notes
                </p>
                <div className="mt-3 rounded-2xl border border-(--ws-line) bg-(--ws-fill) p-4 text-sm leading-6 text-(--ws-fg-70)">
                  {cleanNotes.text}
                </div>
              </section>
            )}

            {hasDemoMarker && (
              <section className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-(--ws-amber)">
                <div className="flex gap-3">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    <span className="font-semibold">Demo data note:</span>{" "}
                    {DEMO_MARKER} was added by the marketing demo seed script to identify generated
                    walkthrough data. It is not part of the fee name and has been hidden from the bill
                    descriptions above.
                  </p>
                </div>
              </section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
