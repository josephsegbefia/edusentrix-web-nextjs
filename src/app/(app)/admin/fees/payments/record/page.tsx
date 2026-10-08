/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/(app)/admin/fees/payments/record/page.tsx
"use client";

import React, { useState, useEffect, useRef, startTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { WorkspaceScope } from "@/components/theme/workspace-scope";
import { useInvoice } from "@/hooks/admin/useInvoices";
import { useRecordPayment } from "@/hooks/admin/usePayments";
import { formatMoney, toMajorUnits } from "@/lib/fees/money";
import {
  ArrowLeft,
  Banknote,
  Check,
  FileText,
  Layers,
  Loader2,
  Minus,
  Plus,
  Receipt,
  Shield,
} from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { useFeesSSE } from "@/hooks/admin/useFeesSSE";
import { cn } from "@/lib/utils";

const inputClasses =
  "h-11 rounded-xl border border-(--ws-line) bg-(--ws-fill) text-sm text-(--ws-fg) placeholder:text-(--ws-fg-40) transition-all duration-200 focus:border-brand focus:bg-(--ws-fill-strong) focus:ring-2 focus:ring-brand/20";

function parseLocalDate(value: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatLocalDate(date: Date | null): string {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-px flex-1 bg-(--ws-line)" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--ws-fg-40)">
        {children}
      </span>
      <span className="h-px flex-1 bg-(--ws-line)" />
    </div>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <Label htmlFor={htmlFor} className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--ws-fg-40)">
      {children}
    </Label>
  );
}

interface Allocation {
  invoiceLineItemId: string;
  amount: number;
  installmentScheduleId?: string;
  installmentNumber?: number;
  notes?: string;
}

export default function RecordPaymentPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { error: toastError, success: toastSuccess } = useToast();
  const invoiceIdParam = searchParams.get("invoiceId");

  const [invoiceId, setInvoiceId] = useState(invoiceIdParam || "");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "bank_transfer" | "mobile_money" | "paystack" | "cheque" | "other"
  >("cash");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const initializedInvoiceIdRef = useRef<string | null>(null);
  const updateAllocationsWithTotal = (next: Allocation[]) => {
    setAllocations(next);
    const total = next.reduce((sum, a) => sum + a.amount, 0);
    setAmount(total.toFixed(2));
  };

  const { data: invoiceData, isLoading: invoiceLoading } =
    useInvoice(invoiceId);
  const recordPayment = useRecordPayment();
  useFeesSSE();

  const invoice = invoiceData?.invoice;

  useEffect(() => {
    if (initializedInvoiceIdRef.current !== invoiceId) {
      initializedInvoiceIdRef.current = null;
      startTransition(() => {
        setAllocations([]);
        setAmount("");
      });
    }

    if (
      invoice &&
      invoice.lineItems &&
      initializedInvoiceIdRef.current !== invoiceId
    ) {
      const payableLineItems = invoice.lineItems.filter(
        (item: any) => !item.isAdjustment && item.amountOutstandingMinor > 0
      );
      const initialAllocations: Allocation[] = payableLineItems.map(
        (item: any) => {
          const firstOutstandingInstallment = item.installments?.find(
            (inst: any) => inst.amountOutstandingMinor > 0
          );
          return {
            invoiceLineItemId: item._id,
            amount: firstOutstandingInstallment
              ? toMajorUnits(firstOutstandingInstallment.amountOutstandingMinor)
              : toMajorUnits(item.amountOutstandingMinor),
            installmentScheduleId: firstOutstandingInstallment?._id,
            installmentNumber: firstOutstandingInstallment?.installmentNumber,
          };
        }
      );
      initializedInvoiceIdRef.current = invoiceId;
      startTransition(() => {
        updateAllocationsWithTotal(initialAllocations);
      });
    }
  }, [invoice, invoiceId]);

  const handleAllocationChange = (
    index: number,
    field: "amount" | "notes",
    value: string | number
  ) => {
    const updated = [...allocations];
    updated[index] = { ...updated[index], [field]: value };
    updateAllocationsWithTotal(updated);
  };

  const handleAddAllocation = () => {
    if (!invoice || !invoice.lineItems) return;

    const unallocatedItems = invoice.lineItems.filter(
      (item: any) =>
        !item.isAdjustment &&
        !allocations.some((a) => a.invoiceLineItemId === item._id)
    );

    if (unallocatedItems.length > 0) {
      const item = unallocatedItems[0];
      updateAllocationsWithTotal([
        ...allocations,
        {
          invoiceLineItemId: item._id,
          amount: toMajorUnits(item.amountOutstandingMinor),
        },
      ]);
    }
  };

  const handleRemoveAllocation = (index: number) => {
    const updated = allocations.filter((_, i) => i !== index);
    updateAllocationsWithTotal(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!invoiceId || !amount || allocations.length === 0) {
      toastError("Error", {
        description: "Please fill in all required fields",
      });
      return;
    }

    const totalAllocated = allocations.reduce((sum, a) => sum + a.amount, 0);
    const paymentAmount = parseFloat(amount);

    if (Math.abs(totalAllocated - paymentAmount) > 0.01) {
      toastError("Error", {
        description: "Allocation amounts must sum to payment amount",
      });
      return;
    }

    try {
      await recordPayment.mutateAsync({
        invoiceId,
        amount: paymentAmount,
        paymentMethod,
        allocations: allocations.map((a) => ({
          invoiceLineItemId: a.invoiceLineItemId,
          amount: a.amount,
          installmentScheduleId: a.installmentScheduleId,
          installmentNumber: a.installmentNumber,
          notes: a.notes,
        })),
        paymentDate,
        notes: notes || undefined,
      });

      toastSuccess("Success", {
        description: "Payment recorded successfully",
      });

      setIsRedirecting(true);
      router.push(`/admin/fees/invoices/${invoiceId}`);
    } catch (error: any) {
      toastError("Error", {
        description: error.message || "Failed to record payment",
      });
    }
  };

  const getLineItemName = (lineItemId: string) => {
    return (
      invoice?.lineItems?.find((item: any) => item._id === lineItemId)?.name ||
      "Unknown"
    );
  };

  const getLineItemOutstanding = (lineItemId: string) => {
    const item = invoice?.lineItems?.find(
      (item: any) => item._id === lineItemId
    );
    return item ? toMajorUnits(item.amountOutstandingMinor) : 0;
  };

  const getInstallmentsForItem = (lineItemId: string) => {
    const item = invoice?.lineItems?.find((li: any) => li._id === lineItemId);
    return item?.installments || [];
  };

  const totalAllocated = allocations.reduce((sum, a) => sum + a.amount, 0);
  const paymentAmount = parseFloat(amount || "0");
  const allocationMismatch = Math.abs(totalAllocated - paymentAmount) > 0.01;

  return (
    <WorkspaceScope>
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      {/* Header */}
      <section className="relative overflow-hidden rounded-3xl border border-(--ws-line) bg-linear-to-br from-(--ws-fill) via-(--ws-fill) to-transparent p-6 shadow-2xl shadow-black/30 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-emerald-500/15 via-emerald-500/5 to-transparent"
          aria-hidden
        />
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-(--ws-line) bg-(--ws-fill) shadow-inner">
              <Receipt className="h-6 w-6 text-(--ws-emerald)" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-(--ws-fg-50)">
                Fee Management
              </p>
              <h1 className="text-2xl font-semibold text-(--ws-fg)">
                Record Payment
              </h1>
              <p className="mt-0.5 text-sm text-(--ws-fg-40)">
                Record and allocate a payment against a bill.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="gap-2 border border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-60) hover:bg-(--ws-fill-strong) hover:text-(--ws-fg)"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
      </section>

      {/* Form card */}
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-px rounded-4xl bg-linear-to-br from-emerald-500/10 via-transparent to-brand/10"
        />

        <div className="relative overflow-hidden rounded-4xl border border-(--ws-line) bg-card/80 shadow-2xl shadow-black/50 backdrop-blur-2xl">
          <form onSubmit={handleSubmit}>
            {/* Bill section */}
            <div className="px-6 py-7 sm:px-8 sm:py-8">
              <div className="space-y-5">
                <SectionLabel>Bill Details</SectionLabel>

                <div className="space-y-2">
                  <FieldLabel htmlFor="invoiceId">Bill ID *</FieldLabel>
                  <Input
                    id="invoiceId"
                    value={invoiceId}
                    onChange={(e) => setInvoiceId(e.target.value)}
                    placeholder="Enter or paste bill ID"
                    required
                    className={inputClasses}
                  />
                </div>

                {invoiceLoading && (
                  <div className="flex items-center gap-3 rounded-xl border border-(--ws-line) bg-(--ws-fill) p-4">
                    <Loader2 className="h-4 w-4 animate-spin text-(--ws-fg-40)" />
                    <span className="text-sm text-(--ws-fg-40)">Loading bill...</span>
                  </div>
                )}

                {invoice && (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15">
                        <FileText className="h-4 w-4 text-(--ws-emerald)" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-(--ws-fg)">
                          {invoice.invoiceNumber}
                        </p>
                        <p className="text-xs text-(--ws-fg-40)">
                          {invoice.studentId?.firstName} {invoice.studentId?.lastName}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] uppercase tracking-wide text-(--ws-fg-40)">Outstanding</p>
                        <p className="text-sm font-bold text-(--ws-emerald)">
                          {formatMoney(invoice.totalOutstandingMinor)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Payment details section */}
            <div className="border-t border-(--ws-line) px-6 py-7 sm:px-8 sm:py-8">
              <div className="space-y-5">
                <SectionLabel>Payment Details</SectionLabel>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <FieldLabel htmlFor="amount">Amount (GHS) *</FieldLabel>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      required
                      className={inputClasses}
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Payment Method *</FieldLabel>
                    <PremiumSelect
                      value={paymentMethod}
                      onValueChange={(v: any) => setPaymentMethod(v)}
                    >
                      <PremiumSelectTrigger className="h-11 rounded-xl border border-(--ws-line) bg-(--ws-fill) text-sm text-(--ws-fg)">
                        <PremiumSelectValue />
                      </PremiumSelectTrigger>
                      <PremiumSelectContent>
                        <PremiumSelectItem value="cash">Cash</PremiumSelectItem>
                        <PremiumSelectItem value="bank_transfer">Bank Transfer</PremiumSelectItem>
                        <PremiumSelectItem value="mobile_money">Mobile Money</PremiumSelectItem>
                        <PremiumSelectItem value="paystack">Paystack</PremiumSelectItem>
                        <PremiumSelectItem value="cheque">Cheque</PremiumSelectItem>
                        <PremiumSelectItem value="other">Other</PremiumSelectItem>
                      </PremiumSelectContent>
                    </PremiumSelect>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <FieldLabel htmlFor="paymentDate">Payment Date *</FieldLabel>
                    <CustomDatePicker
                      value={parseLocalDate(paymentDate)}
                      onChange={(date) => setPaymentDate(formatLocalDate(date))}
                      placeholder="Select payment date"
                      surface="theme"
                      className="h-11 w-full border-(--ws-line) bg-(--ws-fill) text-(--ws-fg)"
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel htmlFor="notes">Notes (optional)</FieldLabel>
                    <Input
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Additional notes..."
                      className={inputClasses}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Allocation section */}
            <div className="border-t border-(--ws-line) px-6 py-7 sm:px-8 sm:py-8">
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <SectionLabel>Payment Allocation</SectionLabel>
                  {invoice &&
                    invoice.lineItems &&
                    allocations.length <
                      invoice.lineItems.filter((li: any) => !li.isAdjustment)
                        .length && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleAddAllocation}
                        className="gap-1.5 text-[11px] text-brand hover:text-brand"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Line Item
                      </Button>
                    )}
                </div>

                {allocations.length === 0 ? (
                  <div className="rounded-2xl border border-(--ws-line) bg-(--ws-fill) p-8 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-(--ws-line) bg-(--ws-fill)">
                      <Layers className="h-6 w-6 text-(--ws-fg-40)" />
                    </div>
                    <p className="text-sm text-(--ws-fg-40)">
                      No allocations yet. Select a bill to auto-allocate line items.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {allocations.map((allocation, index) => (
                      <div
                        key={index}
                        className="group relative overflow-hidden rounded-2xl border border-(--ws-line) bg-(--ws-fill) p-4 transition-all duration-200 hover:border-(--ws-line-strong) hover:bg-(--ws-fill)"
                      >
                        {/* Line item header */}
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10">
                              <Banknote className="h-4 w-4 text-brand" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-(--ws-fg)">
                                {getLineItemName(allocation.invoiceLineItemId)}
                              </p>
                              <p className="text-[11px] text-(--ws-fg-40)">
                                Outstanding:{" "}
                                {formatMoney(
                                  invoice?.lineItems?.find(
                                    (li: any) =>
                                      li._id === allocation.invoiceLineItemId
                                  )?.amountOutstandingMinor || 0
                                )}
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveAllocation(index)}
                            className="h-8 w-8 rounded-lg border border-(--ws-line) bg-(--ws-fill) p-0 text-(--ws-fg-40) hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-(--ws-rose)"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        {/* Allocation fields */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <FieldLabel>Amount (GHS)</FieldLabel>
                            <Input
                              type="number"
                              step="0.01"
                              value={allocation.amount}
                              onChange={(e) =>
                                handleAllocationChange(
                                  index,
                                  "amount",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              required
                              className={inputClasses}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <FieldLabel>Installment</FieldLabel>
                            <PremiumSelect
                              value={allocation.installmentScheduleId || "lineitem"}
                              onValueChange={(v) => {
                                const installments = getInstallmentsForItem(
                                  allocation.invoiceLineItemId
                                );
                                if (v === "lineitem") {
                                  const updated = allocations.map((a, i) =>
                                    i === index
                                      ? {
                                          ...a,
                                          installmentScheduleId: undefined,
                                          installmentNumber: undefined,
                                          amount: getLineItemOutstanding(
                                            allocation.invoiceLineItemId
                                          ),
                                        }
                                      : a
                                  );
                                  updateAllocationsWithTotal(updated);
                                  return;
                                }
                                const selected = installments.find(
                                  (inst: any) => inst._id === v
                                );
                                const updated = allocations.map((a, i) =>
                                  i === index
                                    ? {
                                        ...a,
                                        installmentScheduleId: v,
                                        installmentNumber:
                                          selected?.installmentNumber,
                                        amount: selected
                                          ? toMajorUnits(
                                              selected.amountOutstandingMinor
                                            )
                                          : a.amount,
                                      }
                                    : a
                                );
                                updateAllocationsWithTotal(updated);
                              }}
                            >
                              <PremiumSelectTrigger className="h-11 rounded-xl border border-(--ws-line) bg-(--ws-fill) text-sm text-(--ws-fg)">
                                <PremiumSelectValue placeholder="Select installment" />
                              </PremiumSelectTrigger>
                              <PremiumSelectContent>
                                <PremiumSelectItem value="lineitem">
                                  Apply to line item
                                </PremiumSelectItem>
                                {getInstallmentsForItem(
                                  allocation.invoiceLineItemId
                                ).map((inst: any) => (
                                  <PremiumSelectItem key={inst._id} value={inst._id}>
                                    Inst {inst.installmentNumber} • Due{" "}
                                    {new Date(inst.dueDate).toLocaleDateString()} •{" "}
                                    {formatMoney(inst.amountOutstandingMinor)}
                                  </PremiumSelectItem>
                                ))}
                              </PremiumSelectContent>
                            </PremiumSelect>
                          </div>
                        </div>

                        <div className="mt-3 space-y-1.5">
                          <FieldLabel>Notes (optional)</FieldLabel>
                          <Input
                            value={allocation.notes || ""}
                            onChange={(e) =>
                              handleAllocationChange(index, "notes", e.target.value)
                            }
                            placeholder="Notes for this allocation..."
                            className={inputClasses}
                          />
                        </div>
                      </div>
                    ))}

                    {/* Allocation summary */}
                    <div className="rounded-2xl border border-(--ws-line) bg-(--ws-fill) p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-(--ws-fg)">Total Allocated</span>
                        <span className="text-lg font-bold text-(--ws-fg)">
                          GHS {totalAllocated.toFixed(2)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-[11px] text-(--ws-fg-40)">Payment Amount</span>
                        <span className="text-sm font-semibold text-(--ws-fg-60)">
                          GHS {paymentAmount.toFixed(2)}
                        </span>
                      </div>
                      {allocationMismatch && (
                        <p className="mt-2 text-xs text-(--ws-rose)">
                          Allocation amounts must match payment amount
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Submit area */}
            <div className="border-t border-(--ws-line) px-6 py-5 sm:px-8">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5 text-[11px] text-(--ws-fg-40)">
                  <Shield className="h-3.5 w-3.5" />
                  <span>Payment will be recorded securely</span>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => router.back()}
                    className="border border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-60) hover:bg-(--ws-fill-strong) hover:text-(--ws-fg)"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={recordPayment.isPending || isRedirecting}
                    className={cn(
                      "gap-2 rounded-2xl bg-brand px-6 text-sm font-semibold text-black shadow-lg shadow-brand/25 transition-all duration-200 hover:bg-sky-300 hover:shadow-brand/40 hover:scale-[1.01] active:scale-[0.99]",
                      (recordPayment.isPending || isRedirecting) && "opacity-50"
                    )}
                  >
                    {recordPayment.isPending || isRedirecting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    {isRedirecting ? "Opening bill..." : "Record Payment"}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
    </WorkspaceScope>
  );
}
