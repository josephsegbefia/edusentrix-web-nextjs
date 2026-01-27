// src/app/(app)/admin/fees/invoices/[id]/page.tsx
"use client";

import React from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useInvoice, useIssueInvoice, useCancelInvoice, useAddAdjustment } from "@/hooks/admin/useInvoices";
import { formatMoney } from "@/lib/fees/money";
import Link from "next/link";
import { ArrowLeft, Receipt, CheckCircle, XCircle, PlusCircle, DollarSign, TrendingUp, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/loading/skeleton";
import { useFeesSSE } from "@/hooks/admin/useFeesSSE";
import { InstallmentScheduleView } from "@/components/admin/fees/InstallmentScheduleView";
import { InvoiceEventTimeline } from "@/components/admin/fees/InvoiceEventTimeline";
import StudentCreditSection from "@/components/admin/fees/StudentCreditSection";
import { ResponsiveModal } from "@/components/modals/ResponsiveModal";
import AddAdjustmentModal from "@/components/modals/AddAdjustmentModal";
import { useBusyToast } from "@/hooks/useBusyToast";
import type { AddAdjustmentInput } from "@/schemas/adjustment";
import { cn } from "@/lib/utils";

function InvoiceStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-gray-500/20 text-gray-300",
    issued: "bg-blue-500/20 text-blue-300",
    partially_paid: "bg-yellow-500/20 text-yellow-300",
    paid: "bg-green-500/20 text-green-300",
    overdue: "bg-red-500/20 text-red-300",
    cancelled: "bg-gray-500/20 text-gray-400",
  };

  return (
    <Badge className={colors[status] || colors.draft}>
      {status.replace("_", " ").toUpperCase()}
    </Badge>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
      <div
        className={`pointer-events-none absolute inset-0 bg-linear-to-br ${accent}`}
        aria-hidden="true"
      />
      <CardHeader className="relative z-10">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
            {label}
          </CardTitle>
          {Icon && (
            <Icon className="h-4 w-4 text-white/40" aria-hidden="true" />
          )}
        </div>
      </CardHeader>
      <CardContent className="relative z-10">
        <p className="text-3xl font-semibold text-white drop-shadow-sm">{value}</p>
        <div className="h-[3px] w-12 rounded-full bg-white/30 mt-3" />
      </CardContent>
    </Card>
  );
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const invoiceId = params.id as string;
  const { data, isLoading, error } = useInvoice(invoiceId);
  const issueInvoice = useIssueInvoice();
  const cancelInvoice = useCancelInvoice();
  const addAdjustment = useAddAdjustment();
  const busy = useBusyToast();
  useFeesSSE(); // Enable real-time updates

  const [showAdjustmentModal, setShowAdjustmentModal] = React.useState(false);

  const handleAddAdjustment = async (payload: AddAdjustmentInput) => {
    // Normalize payload: convert null to undefined for description fields
    const normalizedPayload = {
      ...payload,
      lineItems: payload.lineItems.map((item) => ({
        ...item,
        description: item.description ?? undefined,
      })),
    };
    await busy.promise(
      addAdjustment.mutateAsync(normalizedPayload),
      {
        loading: "Adding adjustments...",
        success: "Adjustments added successfully",
        error: "Failed to add adjustments",
      }
    );
    setShowAdjustmentModal(false);
  };

  const handleIssueInvoice = async () => {
    await busy.promise(
      issueInvoice.mutateAsync(invoiceId),
      {
        loading: "Issuing invoice...",
        success: "Invoice issued successfully",
        error: "Failed to issue invoice",
      }
    );
  };

  const handleCancelInvoice = async () => {
    if (!confirm("Are you sure you want to cancel this invoice? This action cannot be undone.")) {
      return;
    }
    await busy.promise(
      cancelInvoice.mutateAsync(invoiceId),
      {
        loading: "Cancelling invoice...",
        success: "Invoice cancelled successfully",
        error: "Failed to cancel invoice",
      }
    );
  };

  if (error) {
    return (
      <div className="space-y-6 p-6">
        <Link href="/admin/fees/invoices">
          <Button
            variant="ghost"
            size="sm"
            className="border border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Invoices
          </Button>
        </Link>
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load invoice</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const invoice = data?.invoice;

  if (isLoading || !invoice) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/fees/invoices">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 cursor-pointer border border-white/10 bg-white/5 transition-all duration-200 hover:scale-105 hover:border-white/20 hover:bg-white/10 hover:shadow-md hover:shadow-black/20 active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Invoice Details
            </p>
            <h1 className="text-3xl font-bold text-white">{invoice.invoiceNumber}</h1>
            <p className="text-white/60 mt-1">
              {invoice.studentId?.firstName} {invoice.studentId?.lastName}
              {invoice.studentId?.admissionNo && ` • ${invoice.studentId.admissionNo}`}
            </p>
            {invoice.academicPeriodId && (
              <p className="text-sm text-white/50 mt-1">
                {invoice.academicPeriodId.yearLabel} • {invoice.academicPeriodId.term}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <InvoiceStatusBadge status={invoice.status} />
          {invoice.status === "draft" && (
            <Button
              onClick={handleIssueInvoice}
              disabled={issueInvoice.isPending}
              className="bg-brand hover:bg-brand/90 text-white"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Issue Invoice
            </Button>
          )}
          {invoice.status !== "cancelled" && invoice.status !== "draft" && (
            <>
              <Button
                variant="outline"
                onClick={() => setShowAdjustmentModal(true)}
                className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-white/20"
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Adjustment
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancelInvoice}
                disabled={cancelInvoice.isPending}
                className="bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30 hover:text-red-200"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Invoice Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Total Amount"
          value={formatMoney(invoice.totalAmountMinor)}
          icon={DollarSign}
          accent="from-blue-500/10 via-blue-500/5 to-transparent"
        />
        <MetricCard
          label="Paid"
          value={formatMoney(invoice.totalPaidMinor)}
          icon={TrendingUp}
          accent="from-emerald-500/10 via-emerald-500/5 to-transparent"
        />
        <MetricCard
          label="Outstanding"
          value={formatMoney(invoice.totalOutstandingMinor)}
          icon={AlertCircle}
          accent="from-orange-500/10 via-orange-500/5 to-transparent"
        />
      </div>

      {/* Line Items */}
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-purple-500/5 via-purple-500/2 to-transparent"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10">
          <CardTitle className="text-white">Line Items</CardTitle>
        </CardHeader>
        <CardContent className="relative z-10">
          {invoice.lineItems && invoice.lineItems.length === 0 ? (
            <p className="text-center text-white/60 py-4">No line items</p>
          ) : (
            <div className="space-y-4">
              {invoice.lineItems?.map((item: any) => (
                <div key={item._id} className="space-y-3">
                  <div className={cn(
                    "flex items-center justify-between p-4 rounded-xl border transition-all duration-200",
                    item.isAdjustment
                      ? item.amountMinor < 0
                        ? "border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15"
                        : "border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/15"
                      : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
                  )}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-semibold text-white">{item.name}</p>
                        {item.isAdjustment && (
                          <Badge className="text-xs bg-white/10 text-white/80">
                            {item.adjustmentType?.toUpperCase() || "ADJUSTMENT"}
                          </Badge>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-sm text-white/60">{item.description}</p>
                      )}
                      {item.isAdjustment && item.adjustmentReason && (
                        <p className="text-xs text-white/50 mt-1">
                          Reason: {item.adjustmentReason}
                        </p>
                      )}
                      {item.allowsInstallments && item.numberOfInstallments && (
                        <p className="text-xs text-white/50 mt-1">
                          {item.numberOfInstallments} installments
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <p className={cn(
                        "font-semibold text-lg",
                        item.isAdjustment && item.amountMinor < 0
                          ? "text-emerald-300"
                          : item.isAdjustment && item.amountMinor > 0
                          ? "text-orange-300"
                          : "text-white"
                      )}>
                        {item.isAdjustment && item.amountMinor < 0 ? "-" : ""}
                        {formatMoney(Math.abs(item.amountMinor))}
                      </p>
                      {!item.isAdjustment && (
                        <p className="text-sm text-white/60 mt-1">
                          Paid: {formatMoney(item.amountPaidMinor)}
                        </p>
                      )}
                      {!item.isAdjustment && (
                        <div className="mt-2">
                          <InvoiceStatusBadge status={item.status} />
                        </div>
                      )}
                    </div>
                  </div>
                  {item.installments && item.installments.length > 0 && (
                    <InstallmentScheduleView
                      lineItemId={item._id}
                      lineItemName={item.name}
                      installments={item.installments}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payments */}
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-green-500/5 via-green-500/2 to-transparent"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">Payments</CardTitle>
            {invoice.status !== "draft" && invoice.status !== "cancelled" && (
              <Link href={`/admin/fees/payments/record?invoiceId=${invoiceId}`}>
                <Button
                  size="sm"
                  className="bg-brand hover:bg-brand/90 text-white"
                >
                  <Receipt className="h-4 w-4 mr-2" />
                  Record Payment
                </Button>
              </Link>
            )}
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          {invoice.payments && invoice.payments.length === 0 ? (
            <p className="text-center text-white/60 py-4">No payments recorded</p>
          ) : (
            <div className="space-y-3">
              {invoice.payments?.map((payment: any) => (
                <div
                  key={payment._id}
                  className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-200"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-white">
                      {payment.receiptNumber || `Payment #${payment._id.slice(-6)}`}
                    </p>
                    <p className="text-sm text-white/60 mt-1">
                      {new Date(payment.paymentDate).toLocaleDateString()} • {payment.paymentMethod}
                    </p>
                    {payment.allocations && payment.allocations.length > 0 && (
                      <div className="mt-2 text-xs text-white/50">
                        Allocated to: {payment.allocations.map((a: any) => a.invoiceLineItemId?.name).join(", ")}
                      </div>
                    )}
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-semibold text-lg text-white">{formatMoney(payment.amountMinor)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credit Balance */}
      {invoice.studentId?._id && (
        <StudentCreditSection studentId={invoice.studentId._id} />
      )}

      {/* Event Timeline */}
      {invoice.events && invoice.events.length > 0 && (
        <InvoiceEventTimeline events={invoice.events} />
      )}

      {/* Adjustment Modal */}
      <ResponsiveModal
        open={showAdjustmentModal}
        onClose={() => setShowAdjustmentModal(false)}
        title="Add Adjustments"
        widthClass="max-w-4xl"
      >
        <AddAdjustmentModal
          invoiceId={invoiceId}
          onClose={() => setShowAdjustmentModal(false)}
          onSubmit={handleAddAdjustment}
          isLoading={addAdjustment.isPending}
        />
      </ResponsiveModal>
    </div>
  );
}
