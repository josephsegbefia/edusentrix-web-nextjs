// src/components/admin/fees/StudentCreditManager.tsx
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { formatMoney, toMajorUnits } from "@/lib/fees/money";
import { DollarSign, ArrowRight, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { useBusyToast } from "@/hooks/useBusyToast";
import { ResponsiveModal } from "@/components/modals/ResponsiveModal";

type CreditEntry = {
  type: "credit" | "debit" | "application";
  amountMinor: number;
  reason: string;
  createdAt: string | Date;
  appliedToInvoiceId?: string;
};

type Invoice = {
  _id: string;
  invoiceNumber: string;
  totalOutstandingMinor: number;
  academicPeriodId?: {
    yearLabel: string;
    term: string;
  };
};

type Props = {
  studentId: string;
  studentName: string;
  creditBalance: number;
  entries: CreditEntry[];
  invoices: Invoice[];
  onCreditApplied?: () => void;
};

export function StudentCreditManager({
  studentId,
  studentName,
  creditBalance,
  entries,
  invoices,
  onCreditApplied,
}: Props) {
  const { toast } = useToast();
  const busy = useBusyToast();
  const [showApplyModal, setShowApplyModal] = React.useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = React.useState("");
  const [selectedLineItemId, setSelectedLineItemId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [lineItems, setLineItems] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (selectedInvoiceId) {
      fetch(`/api/admin/fees/invoices/${selectedInvoiceId}`)
        .then((res) => res.json())
        .then((data) => {
          setLineItems(data.lineItems || []);
        })
        .catch(() => setLineItems([]));
    } else {
      setLineItems([]);
    }
  }, [selectedInvoiceId]);

  const handleApplyCredit = async () => {
    if (!selectedInvoiceId || !amount || parseFloat(amount) <= 0) {
      toast.error("Error", {
        description: "Please select an invoice and enter an amount",
      });
      return;
    }

    const amountValue = parseFloat(amount);
    if (amountValue > toMajorUnits(creditBalance)) {
      toast.error("Error", {
        description: "Amount exceeds available credit balance",
      });
      return;
    }

    try {
      await busy.promise(
        fetch(`/api/admin/fees/credit/${studentId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            invoiceId: selectedInvoiceId,
            invoiceLineItemId: selectedLineItemId || undefined,
            amount: amountValue,
          }),
        }).then(async (res) => {
          if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || "Failed to apply credit");
          }
          return res.json();
        }),
        {
          loading: "Applying credit...",
          success: "Credit applied successfully",
          error: "Failed to apply credit",
        }
      );

      setShowApplyModal(false);
      setSelectedInvoiceId("");
      setSelectedLineItemId("");
      setAmount("");
      onCreditApplied?.();
    } catch (error: any) {
      // Error already handled by busy.promise
    }
  };

  const getEntryIcon = (type: string) => {
    switch (type) {
      case "credit":
        return <CheckCircle2 className="h-4 w-4 text-emerald-300" />;
      case "application":
        return <ArrowRight className="h-4 w-4 text-blue-300" />;
      default:
        return <AlertCircle className="h-4 w-4 text-orange-300" />;
    }
  };

  const getEntryBadge = (type: string) => {
    const colors: Record<string, string> = {
      credit: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      application: "bg-blue-500/20 text-blue-300 border-blue-500/30",
      debit: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    };
    return (
      <Badge className={colors[type] || colors.credit}>
        {type.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <Card className="border border-white/10 bg-white/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">Credit Balance</CardTitle>
              <p className="text-sm text-white/60 mt-1">{studentName}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-emerald-300">
                {formatMoney(creditBalance)}
              </p>
              {creditBalance > 0 && (
                <Button
                  size="sm"
                  onClick={() => setShowApplyModal(true)}
                  className="mt-2 bg-brand hover:bg-brand/90 text-white"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Apply Credit
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-white/60 text-center py-4">
              No credit transactions yet
            </p>
          ) : (
            <div className="space-y-3">
              {entries.slice().reverse().map((entry, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/5"
                >
                  <div className="flex items-center gap-3">
                    {getEntryIcon(entry.type)}
                    <div>
                      <p className="text-sm font-medium text-white">
                        {entry.reason}
                      </p>
                      <p className="text-xs text-white/50">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-sm font-semibold ${
                        entry.type === "credit"
                          ? "text-emerald-300"
                          : entry.type === "application"
                          ? "text-blue-300"
                          : "text-orange-300"
                      }`}
                    >
                      {entry.type === "credit" ? "+" : entry.type === "application" ? "-" : "-"}{" "}
                      {formatMoney(Math.abs(entry.amountMinor))}
                    </span>
                    {getEntryBadge(entry.type)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Apply Credit Modal */}
      <ResponsiveModal
        open={showApplyModal}
        onClose={() => setShowApplyModal(false)}
        title="Apply Credit to Invoice"
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
              Available Credit
            </Label>
            <p className="text-2xl font-bold text-emerald-300">
              {formatMoney(creditBalance)}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
              Select Invoice *
            </Label>
            <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
              <SelectTrigger className="border border-white/10 bg-white/5 text-white">
                <SelectValue placeholder="Select invoice" />
              </SelectTrigger>
              <SelectContent>
                {invoices.map((invoice) => (
                  <SelectItem key={invoice._id} value={invoice._id}>
                    {invoice.invoiceNumber} • Outstanding: {formatMoney(invoice.totalOutstandingMinor)}
                    {invoice.academicPeriodId && (
                      <> • {invoice.academicPeriodId.yearLabel} {invoice.academicPeriodId.term}</>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedInvoiceId && lineItems.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                Select Line Item (Optional)
              </Label>
              <Select value={selectedLineItemId} onValueChange={setSelectedLineItemId}>
                <SelectTrigger className="border border-white/10 bg-white/5 text-white">
                  <SelectValue placeholder="Apply to entire invoice" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Apply to entire invoice</SelectItem>
                  {lineItems
                    .filter((item: any) => item.amountOutstandingMinor > 0)
                    .map((item: any) => (
                      <SelectItem key={item._id} value={item._id}>
                        {item.name} • Outstanding: {formatMoney(item.amountOutstandingMinor)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
              Amount (GHS) *
            </Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount to apply"
              max={toMajorUnits(creditBalance)}
              className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
            />
            <p className="text-xs text-white/50">
              Maximum: {formatMoney(creditBalance)}
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <Button
              variant="ghost"
              onClick={() => setShowApplyModal(false)}
              className="text-white/80 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApplyCredit}
              disabled={!selectedInvoiceId || !amount || parseFloat(amount) <= 0}
              className="bg-brand hover:bg-brand/90 text-white"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Apply Credit
            </Button>
          </div>
        </div>
      </ResponsiveModal>
    </div>
  );
}
