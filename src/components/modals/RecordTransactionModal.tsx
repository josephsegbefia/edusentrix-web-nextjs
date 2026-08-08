"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns/format";
import { CalendarIcon, Loader2, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GhanaPhoneInput } from "@/components/ui/ghana-phone-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import {
  useCreateManualTransaction,
  ManualTransactionInput,
  ManualTransactionCategory,
  TransactionDirection,
  TransactionMethod,
} from "@/hooks/admin/useFinancialCenter";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ========================
// Form Schema
// ========================

const transactionFormSchema = z.object({
  direction: z.enum(["inflow", "outflow"]),
  category: z.enum([
    "other_income",
    "refund",
    "adjustment",
    "gateway_fee",
    "bank_charge",
    "penalty",
    "discount",
  ]),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  feeAmount: z.number().min(0),
  currency: z.string(),
  occurredAt: z.date(),
  method: z.enum([
    "cash",
    "mobile_money",
    "bank_transfer",
    "card",
    "cheque",
    "other",
  ]),
  reference: z.string().optional(),
  description: z.string().min(1, "Description is required").max(500),
  notes: z.string().max(1000).optional(),
  partyName: z.string().optional(),
  partyType: z.enum(["student", "guardian", "vendor", "staff", "donor", "other"]).optional(),
  partyEmail: z.string().email().optional().or(z.literal("")),
  partyPhone: z.string().optional(),
});

type TransactionFormData = z.infer<typeof transactionFormSchema>;

// ========================
// Props
// ========================

interface RecordTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  defaultDirection?: TransactionDirection;
}

// ========================
// Component
// ========================

export function RecordTransactionModal({
  open,
  onOpenChange,
  onSuccess,
  defaultDirection = "inflow",
}: RecordTransactionModalProps) {
  const createTransaction = useCreateManualTransaction();

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      direction: defaultDirection,
      category: "other_income",
      amount: 0,
      feeAmount: 0,
      currency: "GHS",
      occurredAt: new Date(),
      method: "bank_transfer",
      reference: "",
      description: "",
      notes: "",
      partyName: "",
      partyType: "other",
      partyEmail: "",
      partyPhone: "",
    },
  });

  // Reset form when modal opens
  React.useEffect(() => {
    if (open) {
      form.reset({
        direction: defaultDirection,
        category: defaultDirection === "inflow" ? "other_income" : "adjustment",
        amount: 0,
        feeAmount: 0,
        currency: "GHS",
        occurredAt: new Date(),
        method: "bank_transfer",
        reference: "",
        description: "",
        notes: "",
        partyName: "",
        partyType: "other",
        partyEmail: "",
        partyPhone: "",
      });
    }
  }, [open, form, defaultDirection]);

  const direction = form.watch("direction");

  const onSubmit = async (data: TransactionFormData) => {
    try {
      const payload: ManualTransactionInput = {
        direction: data.direction as TransactionDirection,
        category: data.category as ManualTransactionCategory,
        grossAmountMinor: Math.round(data.amount * 100),
        feeAmountMinor: Math.round((data.feeAmount || 0) * 100),
        currency: data.currency,
        occurredAt: data.occurredAt.toISOString(),
        method: data.method as TransactionMethod,
        reference: data.reference || undefined,
        description: data.description,
        notes: data.notes || undefined,
        partyName: data.partyName || undefined,
        partyType: data.partyType || undefined,
        partyEmail: data.partyEmail || undefined,
        partyPhone: data.partyPhone || undefined,
      };

      await createTransaction.mutateAsync(payload);
      toast.success("Transaction recorded successfully");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to record transaction");
    }
  };

  const inflowCategories = [
    { value: "other_income", label: "Other Income" },
    { value: "refund", label: "Refund Received" },
    { value: "adjustment", label: "Positive Adjustment" },
  ];

  const outflowCategories = [
    { value: "refund", label: "Refund Given" },
    { value: "adjustment", label: "Negative Adjustment" },
    { value: "gateway_fee", label: "Gateway Fee" },
    { value: "bank_charge", label: "Bank Charge" },
    { value: "penalty", label: "Penalty" },
    { value: "discount", label: "Discount" },
  ];

  const categories = direction === "inflow" ? inflowCategories : outflowCategories;

  const paymentMethods = [
    { value: "cash", label: "Cash" },
    { value: "mobile_money", label: "Mobile Money" },
    { value: "bank_transfer", label: "Bank Transfer" },
    { value: "card", label: "Card" },
    { value: "cheque", label: "Cheque" },
    { value: "other", label: "Other" },
  ];

  const partyTypes = [
    { value: "student", label: "Student" },
    { value: "guardian", label: "Guardian" },
    { value: "vendor", label: "Vendor" },
    { value: "staff", label: "Staff" },
    { value: "donor", label: "Donor" },
    { value: "other", label: "Other" },
  ];

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Record Transaction"
      description="Manually record a transaction in the ledger"
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-1">
        {/* Direction Toggle */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant={direction === "inflow" ? "default" : "outline"}
            onClick={() => {
              form.setValue("direction", "inflow");
              form.setValue("category", "other_income");
            }}
            className={cn(
              "flex-1",
              direction === "inflow" && "bg-emerald-600 hover:bg-emerald-700"
            )}
          >
            <ArrowDownRight className="mr-2 h-4 w-4" />
            Inflow (Income)
          </Button>
          <Button
            type="button"
            variant={direction === "outflow" ? "default" : "outline"}
            onClick={() => {
              form.setValue("direction", "outflow");
              form.setValue("category", "adjustment");
            }}
            className={cn(
              "flex-1",
              direction === "outflow" && "bg-red-600 hover:bg-red-700"
            )}
          >
            <ArrowUpRight className="mr-2 h-4 w-4" />
            Outflow (Expense)
          </Button>
        </div>

        {/* Category and Amount */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-white/80">
              Category <span className="text-red-400">*</span>
            </Label>
            <PremiumSelect
              value={form.watch("category")}
              onValueChange={(v) => form.setValue("category", v as ManualTransactionCategory)}
            >
              <PremiumSelectTrigger>
                <PremiumSelectValue placeholder="Select category" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {categories.map((cat) => (
                  <PremiumSelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount" className="text-white/80">
              Amount <span className="text-red-400">*</span>
            </Label>
            <div className="flex gap-2">
              <PremiumSelect
                value={form.watch("currency")}
                onValueChange={(v) => form.setValue("currency", v)}
              >
                <PremiumSelectTrigger className="w-24">
                  <PremiumSelectValue />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  <PremiumSelectItem value="GHS">GHS</PremiumSelectItem>
                  <PremiumSelectItem value="USD">USD</PremiumSelectItem>
                </PremiumSelectContent>
              </PremiumSelect>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                {...form.register("amount", { valueAsNumber: true })}
                className="flex-1 border-white/10 bg-white/5 text-white placeholder:text-white/40"
              />
            </div>
            {form.formState.errors.amount && (
              <p className="text-xs text-red-400">{form.formState.errors.amount.message}</p>
            )}
          </div>
        </div>

        {/* Payment Method and Date */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-white/80">
              Payment Method <span className="text-red-400">*</span>
            </Label>
            <PremiumSelect
              value={form.watch("method")}
              onValueChange={(v) => form.setValue("method", v as TransactionMethod)}
            >
              <PremiumSelectTrigger>
                <PremiumSelectValue placeholder="Select method" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {paymentMethods.map((pm) => (
                  <PremiumSelectItem key={pm.value} value={pm.value}>
                    {pm.label}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>

          <div className="space-y-2">
            <Label className="text-white/80">Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal border-white/10 bg-white/5 hover:bg-white/10",
                    !form.watch("occurredAt") && "text-white/40"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.watch("occurredAt") ? (
                    format(form.watch("occurredAt"), "PPP")
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 border-white/10 bg-slate-900" align="start">
                <Calendar
                  mode="single"
                  selected={form.watch("occurredAt")}
                  onSelect={(date) => date && form.setValue("occurredAt", date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Reference */}
        <div className="space-y-2">
          <Label htmlFor="reference" className="text-white/80">
            Reference Number (Optional)
          </Label>
          <Input
            id="reference"
            placeholder="e.g., Receipt number, bill ID"
            {...form.register("reference")}
            className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description" className="text-white/80">
            Description <span className="text-red-400">*</span>
          </Label>
          <Textarea
            id="description"
            placeholder="What is this transaction for?"
            {...form.register("description")}
            className="min-h-[80px] border-white/10 bg-white/5 text-white placeholder:text-white/40"
          />
          {form.formState.errors.description && (
            <p className="text-xs text-red-400">{form.formState.errors.description.message}</p>
          )}
        </div>

        {/* Party Info (Collapsible) */}
        <details className="group">
          <summary className="cursor-pointer text-sm text-white/60 hover:text-white transition-colors">
            + Add party details (optional)
          </summary>
          <div className="mt-4 space-y-4 pl-4 border-l border-white/10">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-white/80">Party Name</Label>
                <Input
                  placeholder="Name of person/organization"
                  {...form.register("partyName")}
                  className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">Party Type</Label>
                <PremiumSelect
                  value={form.watch("partyType") || "other"}
                  onValueChange={(v) => form.setValue("partyType", v as "student" | "guardian" | "vendor" | "staff" | "donor" | "other")}
                >
                  <PremiumSelectTrigger>
                    <PremiumSelectValue />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    {partyTypes.map((pt) => (
                      <PremiumSelectItem key={pt.value} value={pt.value}>
                        {pt.label}
                      </PremiumSelectItem>
                    ))}
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-white/80">Email</Label>
                <Input
                  type="email"
                  placeholder="email@example.com"
                  {...form.register("partyEmail")}
                  className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">Phone</Label>
                <GhanaPhoneInput
                  value={form.watch("partyPhone") || ""}
                  onValueChange={(value) => form.setValue("partyPhone", value, { shouldDirty: true })}
                  onBlur={() => form.trigger("partyPhone")}
                  className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
                />
              </div>
            </div>
          </div>
        </details>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes" className="text-white/80">
            Internal Notes (Optional)
          </Label>
          <Textarea
            id="notes"
            placeholder="Notes for internal reference..."
            {...form.register("notes")}
            className="min-h-[60px] border-white/10 bg-white/5 text-white placeholder:text-white/40"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/10 bg-white/5 hover:bg-white/10"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createTransaction.isPending}
            className={cn(
              "text-white",
              direction === "inflow"
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-red-600 hover:bg-red-700"
            )}
          >
            {createTransaction.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Record Transaction
          </Button>
        </div>
      </form>
    </ResponsiveModal>
  );
}
