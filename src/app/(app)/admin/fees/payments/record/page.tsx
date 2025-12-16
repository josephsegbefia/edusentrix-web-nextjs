// src/app/(app)/admin/fees/payments/record/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInvoice } from "@/hooks/admin/useInvoices";
import { useRecordPayment } from "@/hooks/admin/usePayments";
import { formatMoney, toMajorUnits } from "@/lib/fees/money";
import { ArrowLeft, Plus, Minus, Check } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { useFeesSSE } from "@/hooks/admin/useFeesSSE";

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
  const { toast } = useToast();
  const invoiceIdParam = searchParams.get("invoiceId");

  const [invoiceId, setInvoiceId] = useState(invoiceIdParam || "");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank_transfer" | "mobile_money" | "paystack" | "cheque" | "other">("cash");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const updateAllocationsWithTotal = (next: Allocation[]) => {
    setAllocations(next);
    const total = next.reduce((sum, a) => sum + a.amount, 0);
    setAmount(total.toFixed(2));
  };

  const { data: invoiceData, isLoading: invoiceLoading } = useInvoice(invoiceId);
  const recordPayment = useRecordPayment();
  useFeesSSE();

  const invoice = invoiceData?.invoice;

  // Initialize allocations when invoice loads
  useEffect(() => {
    if (invoice && invoice.lineItems && allocations.length === 0) {
      const payableLineItems = invoice.lineItems.filter(
        (item: any) => !item.isAdjustment && item.amountOutstandingMinor > 0
      );
      const initialAllocations: Allocation[] = payableLineItems.map((item: any) => {
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
      });
      updateAllocationsWithTotal(initialAllocations);
    }
  }, [invoice, allocations.length]);

  const handleAllocationChange = (index: number, field: "amount" | "notes", value: string | number) => {
    const updated = [...allocations];
    updated[index] = { ...updated[index], [field]: value };
    updateAllocationsWithTotal(updated);
  };

  const handleAddAllocation = () => {
    if (!invoice || !invoice.lineItems) return;

    const unallocatedItems = invoice.lineItems.filter(
      (item: any) =>
        !item.isAdjustment && !allocations.some((a) => a.invoiceLineItemId === item._id)
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
      toast.error("Error", {
        description: "Please fill in all required fields",
      });
      return;
    }

    const totalAllocated = allocations.reduce((sum, a) => sum + a.amount, 0);
    const paymentAmount = parseFloat(amount);

    if (Math.abs(totalAllocated - paymentAmount) > 0.01) {
      toast.error("Error", {
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

      toast.success("Success", {
        description: "Payment recorded successfully",
      });

      router.push(`/admin/fees/invoices/${invoiceId}`);
    } catch (error: any) {
      toast.error("Error", {
        description: error.message || "Failed to record payment",
      });
    }
  };

  const getLineItemName = (lineItemId: string) => {
    return invoice?.lineItems?.find((item: any) => item._id === lineItemId)?.name || "Unknown";
  };

  const getLineItemOutstanding = (lineItemId: string) => {
    const item = invoice?.lineItems?.find((item: any) => item._id === lineItemId);
    return item ? toMajorUnits(item.amountOutstandingMinor) : 0;
  };

  const getInstallmentsForItem = (lineItemId: string) => {
    const item = invoice?.lineItems?.find((li: any) => li._id === lineItemId);
    return item?.installments || [];
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Record Payment</h1>
          <p className="text-muted-foreground">Record a payment for an invoice</p>
        </div>
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Invoice Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="invoiceId">Invoice ID</Label>
              <Input
                id="invoiceId"
                value={invoiceId}
                onChange={(e) => setInvoiceId(e.target.value)}
                placeholder="Enter invoice ID"
                required
              />
            </div>
            {invoice && (
              <div className="p-4 rounded-lg border border-border bg-muted/50">
                <p className="font-semibold">{invoice.invoiceNumber}</p>
                <p className="text-sm text-muted-foreground">
                  {invoice.studentId?.firstName} {invoice.studentId?.lastName}
                </p>
                <p className="text-sm text-muted-foreground">
                  Outstanding: {formatMoney(invoice.totalOutstandingMinor)}
                </p>
              </div>
            )}
            {invoiceLoading && <p className="text-sm text-muted-foreground">Loading invoice...</p>}
          </CardContent>
        </Card>

        {/* Payment Details */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="amount">Amount (GHS)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    <SelectItem value="paystack">Paystack</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="paymentDate">Payment Date</Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Payment Allocation */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Payment Allocation</CardTitle>
              {invoice && invoice.lineItems && allocations.length < invoice.lineItems.filter((li: any) => !li.isAdjustment).length && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddAllocation}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Line Item
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {allocations.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No allocations. Add a line item to allocate payment.
              </p>
            ) : (
              <>
                {allocations.map((allocation, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-lg border border-border space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{getLineItemName(allocation.invoiceLineItemId)}</p>
                        <p className="text-sm text-muted-foreground">
                          Outstanding:{" "}
                          {formatMoney(
                            invoice?.lineItems?.find((li: any) => li._id === allocation.invoiceLineItemId)
                              ?.amountOutstandingMinor || 0
                          )}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveAllocation(index)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label>Amount (GHS)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={allocation.amount}
                          onChange={(e) =>
                            handleAllocationChange(index, "amount", parseFloat(e.target.value) || 0)
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label>Installment (optional)</Label>
                        <Select
                          value={allocation.installmentScheduleId || "lineitem"}
                          onValueChange={(v) => {
                            const installments = getInstallmentsForItem(allocation.invoiceLineItemId);
                            if (v === "lineitem") {
                              const updated = allocations.map((a, i) =>
                                i === index
                                  ? { ...a, installmentScheduleId: undefined, installmentNumber: undefined, amount: getLineItemOutstanding(allocation.invoiceLineItemId) }
                                  : a
                              );
                              updateAllocationsWithTotal(updated);
                              return;
                            }
                            const selected = installments.find((inst: any) => inst._id === v);
                            const updated = allocations.map((a, i) =>
                              i === index
                                ? {
                                    ...a,
                                    installmentScheduleId: v,
                                    installmentNumber: selected?.installmentNumber,
                                    amount: selected
                                      ? toMajorUnits(selected.amountOutstandingMinor)
                                      : a.amount,
                                  }
                                : a
                            );
                            updateAllocationsWithTotal(updated);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select installment" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="lineitem">Apply to line item</SelectItem>
                            {getInstallmentsForItem(allocation.invoiceLineItemId).map((inst: any) => (
                              <SelectItem key={inst._id} value={inst._id}>
                                Inst {inst.installmentNumber} • Due {new Date(inst.dueDate).toLocaleDateString()} •{" "}
                                {formatMoney(inst.amountOutstandingMinor)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Notes (Optional)</Label>
                      <Input
                        value={allocation.notes || ""}
                        onChange={(e) => handleAllocationChange(index, "notes", e.target.value)}
                        placeholder="Notes for this allocation..."
                      />
                    </div>
                  </div>
                ))}
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">Total Allocated:</p>
                    <p className="font-bold text-lg">
                      GHS {allocations.reduce((sum, a) => sum + a.amount, 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-sm text-muted-foreground">Payment Amount:</p>
                    <p className="text-sm font-semibold">GHS {parseFloat(amount || "0").toFixed(2)}</p>
                  </div>
                  {Math.abs(allocations.reduce((sum, a) => sum + a.amount, 0) - parseFloat(amount || "0")) > 0.01 && (
                    <p className="text-sm text-destructive mt-2">
                      Allocation amounts must match payment amount
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={recordPayment.isPending}>
            <Check className="h-4 w-4 mr-2" />
            Record Payment
          </Button>
        </div>
      </form>
    </div>
  );
}
