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
import { Separator } from "@/components/ui/separator";
import { formatMoney } from "@/lib/fees/money";
import { cn } from "@/lib/utils";
import {
  FileText,
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Receipt,
  CreditCard,
} from "lucide-react";
import { useInvoice } from "@/hooks/admin/useInvoices";

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
      className: "border-white/20 bg-white/5 text-white/70",
      icon: FileText,
    },
    issued: {
      label: "Issued",
      className: "border-blue-400/25 bg-blue-500/10 text-blue-200",
      icon: Clock,
    },
    paid: {
      label: "Paid",
      className: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
      icon: CheckCircle2,
    },
    overdue: {
      label: "Overdue",
      className: "border-red-400/25 bg-red-500/10 text-red-200",
      icon: AlertCircle,
    },
    partially_paid: {
      label: "Partially Paid",
      className: "border-amber-400/25 bg-amber-500/10 text-amber-200",
      icon: Clock,
    },
    cancelled: {
      label: "Cancelled",
      className: "border-white/10 bg-white/5 text-white/70",
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

export function InvoiceDetailDrawer(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invoiceId: string | null;
  studentId: string;
}) {
  const { data, isLoading, isError } = useInvoice(props.invoiceId || "");

  const invoice = data?.invoice;

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl border-white/10 bg-black/60 backdrop-blur overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Bill Details
            </span>
            {invoice && statusBadge(invoice.status)}
          </SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center gap-3 py-20 text-sm text-muted-foreground">
            <Clock className="h-5 w-5 animate-spin" />
            Loading bill details...
          </div>
        ) : isError || !invoice ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-400/50" />
            <p className="mt-3 text-sm font-medium text-red-200">
              Failed to load bill
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Please try again later
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* Header Info */}
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-2xl font-bold text-white/90">
                    {invoice.invoiceNumber}
                  </div>
                  {invoice.academicPeriodId && (
                    <div className="mt-1 text-sm text-muted-foreground">
                      {invoice.academicPeriodId.yearLabel} •{" "}
                      {invoice.academicPeriodId.term}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-white/90">
                    {formatMoney(invoice.totalAmountMinor)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Total Amount
                  </div>
                </div>
              </div>

              <Separator className="bg-white/10" />

              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-muted-foreground">Total Billed</div>
                  <div className="mt-1 text-sm font-semibold text-white/90">
                    {formatMoney(invoice.totalAmountMinor)}
                  </div>
                </div>
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <div className="text-xs text-muted-foreground">Total Paid</div>
                  <div className="mt-1 text-sm font-semibold text-emerald-200">
                    {formatMoney(invoice.totalPaidMinor)}
                  </div>
                </div>
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                  <div className="text-xs text-muted-foreground">Outstanding</div>
                  <div className="mt-1 text-sm font-semibold text-amber-200">
                    {formatMoney(invoice.totalOutstandingMinor)}
                  </div>
                </div>
                {invoice.totalCreditAppliedMinor > 0 && (
                  <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
                    <div className="text-xs text-muted-foreground">Credit Applied</div>
                    <div className="mt-1 text-sm font-semibold text-sky-200">
                      {formatMoney(invoice.totalCreditAppliedMinor)}
                    </div>
                  </div>
                )}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <div>
                    <div className="text-xs">Issue Date</div>
                    <div className="font-medium text-white/80">
                      {fmtDate(invoice.issueDate)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <div>
                    <div className="text-xs">Due Date</div>
                    <div className="font-medium text-white/80">
                      {fmtDate(invoice.dueDate)}
                    </div>
                  </div>
                </div>
                {invoice.paidDate && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4" />
                    <div>
                      <div className="text-xs">Paid Date</div>
                      <div className="font-medium text-white/80">
                        {fmtDate(invoice.paidDate)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Line Items */}
            {invoice.lineItems && invoice.lineItems.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/80">
                  Line Items
                </h3>
                <div className="space-y-2">
                  {invoice.lineItems.map((item: any) => (
                    <div
                      key={item._id}
                      className="rounded-lg border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="font-medium text-white/90">{item.name}</div>
                          {item.description && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {item.description}
                            </div>
                          )}
                          {item.isAdjustment && (
                            <Badge
                              className="mt-2 border-white/10 bg-white/5 text-xs"
                              variant="outline"
                            >
                              Adjustment: {item.adjustmentType || "other"}
                            </Badge>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-white/90">
                            {formatMoney(item.amountMinor)}
                          </div>
                          {item.amountPaidMinor > 0 && (
                            <div className="mt-1 text-xs text-emerald-300">
                              Paid: {formatMoney(item.amountPaidMinor)}
                            </div>
                          )}
                          {item.amountOutstandingMinor > 0 && (
                            <div className="mt-1 text-xs text-amber-300">
                              Outstanding: {formatMoney(item.amountOutstandingMinor)}
                            </div>
                          )}
                        </div>
                      </div>
                      {item.installments && item.installments.length > 0 && (
                        <div className="mt-3 border-t border-white/10 pt-3">
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
                                <span className="font-medium text-white/80">
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
              </div>
            )}

            {/* Payments */}
            {invoice.payments && invoice.payments.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/80">
                  Payments ({invoice.payments.length})
                </h3>
                <div className="space-y-2">
                  {invoice.payments.map((payment: any) => (
                    <div
                      key={payment._id}
                      className="rounded-lg border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Receipt className="h-4 w-4 text-muted-foreground" />
                            <div className="font-medium text-white/90">
                              {formatMoney(payment.amountMinor)}
                            </div>
                            {payment.receiptNumber && (
                              <Badge
                                className="border-white/10 bg-white/5 text-xs"
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
                                  ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
                                  : "border-amber-400/25 bg-amber-500/10 text-amber-200"
                              )}
                              variant="outline"
                            >
                              {payment.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      {payment.allocations && payment.allocations.length > 0 && (
                        <div className="mt-3 border-t border-white/10 pt-3">
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
                                <span className="font-medium text-white/80">
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
            {invoice.notes && (
              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/80">
                  Notes
                </h3>
                <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/80">
                  {invoice.notes}
                </div>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
