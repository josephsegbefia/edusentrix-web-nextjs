/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/fees/money";
import { Clock, X, Sparkles } from "lucide-react";
import { useRecordPayment } from "@/hooks/admin/useRecordPayment";
import { toast } from "sonner";
import { premiumSelectContent } from "@/components/ui/premium";

function parseMoneyToMinor(v: string) {
  const n = Number(String(v).replace(/,/g, "").trim());
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n * 100));
}

function minorToMoneyInput(minor: number) {
  return (minor / 100).toFixed(2);
}

function ModalShell(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const { open, onOpenChange, title, subtitle, children } = props;
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    if (open) {
      window.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onOpenChange]);

  if (!open || !mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100]">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-2xl md:inset-0 md:flex md:items-center md:justify-center md:p-4">
        <div
          className="flex flex-col w-full max-h-[90vh] rounded-t-2xl border border-white/10 bg-[#0b1220] shadow-2xl shadow-black/40 md:rounded-2xl md:max-h-[85vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Fixed Header */}
          <div className="flex-shrink-0 flex items-start justify-between gap-3 p-6 pb-4">
            <div>
              <div className="text-lg font-semibold text-white/90">{title}</div>
              {subtitle ? (
                <div className="mt-1 text-sm text-white/50">{subtitle}</div>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <Separator className="bg-white/10" />

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export function RecordPaymentModal(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  studentId: string;
  invoice: any | null;
}) {
  const { open, onOpenChange, studentId, invoice } = props;

  const mutation = useRecordPayment();

  const lineItems = (invoice?.lineItems ?? []) as any[];
  const invoiceId = invoice?._id as string | undefined;

  const [status, setStatus] = React.useState<"completed" | "pending_approval">(
    "completed"
  );
  const [allocationMode, setAllocationMode] = React.useState<"auto" | "manual">(
    "auto"
  );

  const [amount, setAmount] = React.useState("");
  const [paymentDate, setPaymentDate] = React.useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [paymentMethod, setPaymentMethod] = React.useState<
    "cash" | "bank_transfer" | "mobile_money" | "paystack" | "cheque" | "other"
  >("cash");
  const [receiptNumber, setReceiptNumber] = React.useState("");
  const [reference, setReference] = React.useState("");
  const [note, setNote] = React.useState("");

  const [manual, setManual] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!open) return;
    setStatus("completed");
    setAllocationMode("auto");
    setAmount("");
    setReceiptNumber("");
    setReference("");
    setNote("");
    setManual({});
  }, [open]);

  const amountMinor = parseMoneyToMinor(amount);

  const manualAllocations = React.useMemo(() => {
    const list: { invoiceLineItemId: string; amountMinor: number }[] = [];
    for (const li of lineItems) {
      const v = manual[String(li._id)];
      const m = parseMoneyToMinor(v || "");
      if (m > 0)
        list.push({ invoiceLineItemId: String(li._id), amountMinor: m });
    }
    return list;
  }, [manual, lineItems]);

  const manualAllocatedMinor = manualAllocations.reduce(
    (s, a) => s + a.amountMinor,
    0
  );
  const remainingMinor = Math.max(0, amountMinor - manualAllocatedMinor);
  const overAlloc = manualAllocatedMinor > amountMinor;

  async function onSubmit() {
    if (!invoiceId) return toast.error("No invoice selected for this term.");
    if (amountMinor <= 0) return toast.error("Enter a valid amount.");

    if (allocationMode === "manual" && overAlloc) {
      return toast.error("Manual allocations exceed the payment amount.");
    }

    try {
      await mutation.mutateAsync({
        studentId,
        invoiceId,
        amountMinor,
        paymentDate: new Date(paymentDate).toISOString(),
        paymentMethod,
        receiptNumber: receiptNumber || undefined,
        reference: reference || undefined,
        note: note || undefined,
        status,
        allocationMode,
        allocations:
          allocationMode === "manual" ? manualAllocations : undefined,
      });

      toast.success(
        status === "completed"
          ? "Payment recorded"
          : "Payment saved (pending approval)"
      );
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to record payment");
    }
  }

  const disabled = mutation.isPending || !invoiceId;

  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title="Record Payment"
      subtitle={
        invoice
          ? `Invoice: ${invoice.invoiceNumber}`
          : "Select a term invoice first"
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label
              htmlFor="amount"
              className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
            >
              Amount {amountMinor ? `(${formatMoney(amountMinor)})` : "*"}
            </Label>
            <Input
              id="amount"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="paymentDate"
              className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
            >
              Payment Date *
            </Label>
            <Input
              id="paymentDate"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="paymentMethod"
              className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
            >
              Payment Method *
            </Label>
            <Select value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
              <SelectTrigger
                id="paymentMethod"
                className="border border-white/10 bg-white/5 text-white focus:border-brand focus:ring-1 focus:ring-brand"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={premiumSelectContent}>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="mobile_money">Mobile Money</SelectItem>
                <SelectItem value="paystack">Paystack</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="status"
              className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
            >
              Status *
            </Label>
            <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 p-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setStatus("completed")}
                className={cn(
                  "h-8 flex-1 text-xs",
                  status === "completed"
                    ? "bg-white/10 text-white"
                    : "text-white/60"
                )}
              >
                Posted
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setStatus("pending_approval")}
                className={cn(
                  "h-8 flex-1 text-xs",
                  status === "pending_approval"
                    ? "bg-amber-500/15 text-amber-100"
                    : "text-white/60"
                )}
              >
                Pending
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="receiptNumber"
              className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
            >
              Receipt Number
            </Label>
            <Input
              id="receiptNumber"
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
              placeholder="e.g. RCP-1042"
              className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="reference"
              className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
            >
              Reference
            </Label>
            <Input
              id="reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Bank ref / MoMo ref"
              className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="note"
            className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
          >
            Notes
          </Label>
          <Textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Short note for audit trail…"
            className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand min-h-[80px]"
          />
        </div>

        <Separator className="bg-white/10" />

        {/* Allocation mode */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
            Allocation
          </Label>

          <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 p-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setAllocationMode("auto")}
              className={cn(
                "h-8 px-3 text-xs",
                allocationMode === "auto"
                  ? "bg-white/10 text-white"
                  : "text-white/60"
              )}
            >
              <Sparkles className="mr-1 h-4 w-4" />
              Auto (priority)
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setAllocationMode("manual")}
              className={cn(
                "h-8 px-3 text-xs",
                allocationMode === "manual"
                  ? "bg-white/10 text-white"
                  : "text-white/60"
              )}
            >
              Manual
            </Button>
          </div>
        </div>

        {allocationMode === "auto" ? (
          <Card className="border border-white/10 bg-white/5 p-4">
            <div className="flex items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 text-white/50" />
              <div className="text-xs text-white/60">
                Auto allocation applies funds to **highest-priority outstanding
                items first** (based on bursar/admin ordering). Any excess becomes
                **Credit**.
              </div>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {lineItems.map((li) => {
              const outstanding =
                li.amountOutstandingMinor ??
                Math.max(0, (li.amountMinor ?? 0) - (li.amountPaidMinor ?? 0));
              return (
                <div
                  key={li._id}
                  className="rounded-lg border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="text-sm font-semibold text-white/85">
                        {li.name}
                      </div>
                      <div className="mt-1 text-xs text-white/50">
                        Outstanding:{" "}
                        <span className="text-white/70">
                          {formatMoney(outstanding)}
                        </span>
                        {typeof li.sortOrder === "number" ? (
                          <>
                            <span className="text-white/30"> • </span>
                            <Badge
                              variant="outline"
                              className="border-white/10 bg-white/5 text-white/60"
                            >
                              Priority {li.sortOrder}
                            </Badge>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() =>
                        setManual((m) => ({
                          ...m,
                          [String(li._id)]:
                            outstanding > 0 ? minorToMoneyInput(outstanding) : "",
                        }))
                      }
                    >
                      Pay full
                    </Button>
                  </div>

                  <div>
                    <Input
                      placeholder="0.00"
                      value={manual[String(li._id)] ?? ""}
                      onChange={(e) =>
                        setManual((m) => ({
                          ...m,
                          [String(li._id)]: e.target.value,
                        }))
                      }
                      inputMode="decimal"
                      className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                    />
                  </div>
                </div>
              );
            })}

            <Card className="border border-white/10 bg-black/10 p-4">
              <div className="flex items-center justify-between text-xs mb-2">
                <div className="text-white/50">Allocated</div>
                <div
                  className={cn(
                    "font-semibold",
                    overAlloc ? "text-amber-200" : "text-white/80"
                  )}
                >
                  {formatMoney(manualAllocatedMinor)}
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="text-white/50">Remaining (becomes Credit)</div>
                <div className="font-semibold text-sky-200">
                  {formatMoney(remainingMinor)}
                </div>
              </div>
            </Card>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row pt-4">
          <Button
            type="button"
            variant="outline"
            className="flex-1 border-white/20 bg-white/5 text-white/80"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={disabled}
            onClick={onSubmit}
          >
            {mutation.isPending
              ? "Saving…"
              : status === "completed"
              ? "Record payment"
              : "Save pending payment"}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
