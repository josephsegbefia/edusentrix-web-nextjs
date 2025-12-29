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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/fees/money";
import { Sparkles, X } from "lucide-react";
import { useApplyCredit } from "@/hooks/admin/useApplyCredit";
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

export function ApplyCreditModal(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  studentId: string;
  invoice: any | null;
  creditBalanceMinor: number;
}) {
  const { open, onOpenChange, studentId, invoice, creditBalanceMinor } = props;
  const mutation = useApplyCredit();

  const lineItems = (invoice?.lineItems ?? []) as any[];
  const invoiceId = invoice?._id as string | undefined;

  const [allocationMode, setAllocationMode] = React.useState<"auto" | "manual">(
    "auto"
  );
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");
  const [manual, setManual] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!open) return;
    setAllocationMode("auto");
    setAmount("");
    setNote("");
    setManual({});
  }, [open]);

  const amountMinor = parseMoneyToMinor(amount);
  const clampedMinor = Math.min(amountMinor, Math.max(0, creditBalanceMinor));

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
  const overAlloc = manualAllocatedMinor > clampedMinor;
  const remainingMinor = Math.max(0, clampedMinor - manualAllocatedMinor);

  async function onSubmit() {
    if (!invoiceId) return toast.error("No invoice selected for this term.");
    if (clampedMinor <= 0) return toast.error("Enter a valid credit amount.");
    if (clampedMinor > creditBalanceMinor)
      return toast.error("Amount exceeds credit balance.");
    if (allocationMode === "manual" && overAlloc)
      return toast.error("Manual allocations exceed the credit amount.");

    try {
      await mutation.mutateAsync({
        studentId,
        invoiceId,
        amountMinor: clampedMinor,
        note: note || undefined,
        allocationMode,
        allocations:
          allocationMode === "manual" ? manualAllocations : undefined,
      });

      toast.success("Credit applied");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to apply credit");
    }
  }

  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title="Apply Credit"
      subtitle={
        invoice
          ? `Invoice: ${invoice.invoiceNumber}`
          : "Select a term invoice first"
      }
    >
      <div className="space-y-6">
        <Card className="border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between text-sm">
            <div className="text-white/50">Available Credit</div>
            <div className="font-semibold text-sky-200">
              {formatMoney(creditBalanceMinor)}
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label
              htmlFor="amount"
              className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
            >
              Amount *
            </Label>
            <Input
              id="amount"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
            />
            {amountMinor !== clampedMinor ? (
              <div className="text-xs text-amber-200/80">
                Clamped to available balance: {formatMoney(clampedMinor)}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="allocationMode"
              className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
            >
              Allocation *
            </Label>
            <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 p-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setAllocationMode("auto")}
                className={cn(
                  "h-8 flex-1 text-xs",
                  allocationMode === "auto"
                    ? "bg-white/10 text-white"
                    : "text-white/60"
                )}
              >
                <Sparkles className="mr-1 h-4 w-4" />
                Auto
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setAllocationMode("manual")}
                className={cn(
                  "h-8 flex-1 text-xs",
                  allocationMode === "manual"
                    ? "bg-white/10 text-white"
                    : "text-white/60"
                )}
              >
                Manual
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="note"
            className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
          >
            Note
          </Label>
          <Input
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. applied from overpayment"
            className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
          />
        </div>

        {allocationMode === "manual" ? (
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
                      Fill
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
                <div className="text-white/50">Remaining</div>
                <div className="font-semibold text-white/70">
                  {formatMoney(remainingMinor)}
                </div>
              </div>
            </Card>
          </div>
        ) : null}

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
            disabled={mutation.isPending || !invoiceId}
            onClick={onSubmit}
          >
            {mutation.isPending ? "Applying…" : "Apply credit"}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
