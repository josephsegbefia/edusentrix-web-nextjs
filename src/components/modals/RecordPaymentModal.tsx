// src/components/modals/RecordPaymentModal.tsx
"use client";

import * as React from "react";
import { useForm, useFieldArray, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CreatePaymentSchema,
  CreatePaymentInput,
  PaymentAllocationInput,
} from "@/schemas/payment";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useInvoices } from "@/hooks/admin/useInvoices";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Check, X, Plus, Minus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney, formatCurrencyFromMajor, toMajorUnits } from "@/lib/fees/money";

/** Display copy only — API / schema still use the value keys (e.g. `paystack`). */
const RECORD_PAYMENT_METHOD_ORDER = [
  "cash",
  "mobile_money",
  "bank_transfer",
  "paystack",
  "cheque",
  "other",
] as const satisfies readonly CreatePaymentInput["paymentMethod"][];

const PAYMENT_METHOD_UI: Record<
  CreatePaymentInput["paymentMethod"],
  { title: string; subtitle?: string }
> = {
  cash: { title: "Cash" },
  mobile_money: {
    title: "Mobile money",
    subtitle: "Direct MoMo (MTN, Vodafone, etc.)",
  },
  bank_transfer: {
    title: "Bank transfer",
    subtitle: "Deposit or wire to school account",
  },
  paystack: { title: "Card" },
  cheque: { title: "Cheque" },
  other: { title: "Other" },
};

type Props = {
  onClose: () => void;
  onSubmit: (payload: CreatePaymentInput) => Promise<void>;
  isLoading?: boolean;
  initialInvoiceId?: string;
};

const STEPS = [
  {
    id: 1,
    title: "Payment Details",
    fields: ["invoiceId", "amount", "paymentMethod", "paymentDate"],
  },
  {
    id: 2,
    title: "Allocate Payment",
    fields: ["allocations"],
  },
  {
    id: 3,
    title: "Review & Submit",
    fields: ["notes", "receiptNumber"],
  },
] as const;

export default function RecordPaymentModal({
  onClose,
  onSubmit,
  isLoading,
  initialInvoiceId,
}: Props) {
  const busy = useBusyToast();
  const [currentStep, setCurrentStep] = React.useState(1);
  const [selectedInvoice, setSelectedInvoice] = React.useState<any>(null);

  // Fetch invoices
  const { data: invoicesData } = useInvoices({ limit: 100 });
  const invoices = invoicesData?.invoices || [];

  const {
    register,
    handleSubmit,
    control,
    trigger,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreatePaymentInput>({
    resolver: zodResolver(CreatePaymentSchema),
    defaultValues: {
      invoiceId: initialInvoiceId || "",
      amount: 0,
      paymentMethod: "cash",
      allocations: [],
      paymentDate: new Date().toISOString().slice(0, 10),
      notes: undefined,
      receiptNumber: undefined,
    },
    mode: "onChange",
  });

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "allocations",
  });

  const invoiceId = watch("invoiceId");
  const amount = watch("amount");
  const allocations = watch("allocations");
  const paymentMethod = watch("paymentMethod");

  React.useEffect(() => {
    if (invoiceId) {
      const invoice = invoices.find((inv: any) => inv._id === invoiceId);
      setSelectedInvoice(invoice);
      if (invoice && invoice.lineItems) {
        // Auto-populate allocations based on outstanding amounts
        const autoAllocations = invoice.lineItems
          .filter((item: any) => item.amountOutstandingMinor > 0)
          .map((item: any) => ({
            invoiceLineItemId: item._id,
            amount: toMajorUnits(item.amountOutstandingMinor),
            notes: undefined,
          }));
        if (autoAllocations.length > 0) {
          setValue("allocations", autoAllocations);
        }
      }
    }
  }, [invoiceId, invoices, setValue]);

  const currentStepData = STEPS[currentStep - 1];
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === STEPS.length;

  const totalAllocated = allocations.reduce((sum, a) => sum + (a.amount || 0), 0);
  const remainingAmount = amount - totalAllocated;

  async function internalSubmit(values: CreatePaymentInput) {
    try {
      await onSubmit(values);
      onClose();
    } catch (e: unknown) {
      console.error("Payment recording error:", e);
    }
  }

  async function handleNext() {
    const fieldsToValidate = currentStepData.fields;
    const isValid = await trigger([...fieldsToValidate] as (keyof CreatePaymentInput)[]);
    if (isValid) {
      setCurrentStep((s) => Math.min(s + 1, STEPS.length));
    }
  }

  function handlePrevious() {
    setCurrentStep((s) => Math.max(s - 1, 1));
  }

  const handleAddAllocation = () => {
    if (selectedInvoice && selectedInvoice.lineItems) {
      const availableItems = selectedInvoice.lineItems.filter(
        (item: any) => item.amountOutstandingMinor > 0
      );
      if (availableItems.length > 0) {
        append({
          invoiceLineItemId: availableItems[0]._id,
          amount: 0,
        });
      }
    }
  };

  const handleAutoAllocate = () => {
    if (selectedInvoice && selectedInvoice.lineItems && amount > 0) {
      const outstandingItems = selectedInvoice.lineItems
        .filter((item: any) => item.amountOutstandingMinor > 0)
        .map((item: any) => ({
          ...item,
          outstanding: toMajorUnits(item.amountOutstandingMinor),
        }))
        .sort((a: any, b: any) => a.displayOrder - b.displayOrder);

      const allocations: PaymentAllocationInput[] = [];
      let remaining = amount;

      for (const item of outstandingItems) {
        if (remaining <= 0) break;
        const allocateAmount = Math.min(item.outstanding, remaining);
        allocations.push({
          invoiceLineItemId: item._id,
          amount: allocateAmount,
        });
        remaining -= allocateAmount;
      }

      setValue("allocations", allocations);
    }
  };

  return (
    <form onSubmit={handleSubmit(internalSubmit)} className="space-y-8">
      {/* Step Indicator */}
      <div className="flex items-center justify-between pb-6">
        <div className="text-sm text-white/70">
          Step <span className="font-semibold">{currentStep}</span> of{" "}
          {STEPS.length}
        </div>
        <div className="flex gap-1">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-8 rounded-full transition-all ${
                i + 1 <= currentStep ? "bg-brand" : "bg-white/20"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Form Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {/* Step 1: Payment Details */}
          {currentStep === 1 && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                Payment Information
              </h2>
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                  Invoice *
                </Label>
                <Controller
                  name="invoiceId"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="border border-white/10 bg-white/5 text-white">
                        <SelectValue placeholder="Select invoice" />
                      </SelectTrigger>
                      <SelectContent>
                        {invoices
                          .filter((inv: any) => inv.status !== "cancelled")
                          .map((invoice: any) => (
                            <SelectItem key={invoice._id} value={invoice._id}>
                              {invoice.invoiceNumber} •{" "}
                              {invoice.studentName} •{" "}
                              {formatMoney(invoice.totalOutstandingMinor)} outstanding
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.invoiceId && (
                  <div className="text-xs text-rose-300">
                    {errors.invoiceId.message}
                  </div>
                )}
              </div>

              {selectedInvoice && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                      Total Outstanding
                    </span>
                    <span className="text-lg font-bold text-white">
                      {formatMoney(selectedInvoice.totalOutstandingMinor)}
                    </span>
                  </div>
                </motion.div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label
                    htmlFor="amount"
                    className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                  >
                    Payment Amount (GHS) *
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    {...register("amount", { valueAsNumber: true })}
                    className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                  {errors.amount && (
                    <div className="text-xs text-rose-300">
                      {errors.amount.message}
                    </div>
                  )}
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
                    {...register("paymentDate")}
                    className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                  Payment Method *
                </Label>
                <p className="text-[11px] leading-snug text-white/45">
                  Choose how the family paid.{" "}
                  <span className="text-white/55">
                    &quot;Mobile money&quot; is a direct wallet transfer. &quot;Card&quot; is when they
                    paid through your online checkout (card, USSD, or mobile money).
                  </span>
                </p>
                <Controller
                  name="paymentMethod"
                  control={control}
                  render={({ field }) => (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {RECORD_PAYMENT_METHOD_ORDER.map((method) => {
                        const copy = PAYMENT_METHOD_UI[method];
                        const selected = field.value === method;
                        return (
                          <motion.label
                            key={method}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={`flex flex-1 cursor-pointer flex-col items-stretch rounded-lg border px-3 py-3 text-sm font-medium transition-all ${
                              selected
                                ? "border-brand bg-brand/20 text-brand"
                                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white/90"
                            }`}
                          >
                            <input
                              type="radio"
                              value={method}
                              checked={selected}
                              onChange={() => field.onChange(method)}
                              className="sr-only"
                            />
                            <span className="text-center leading-tight">{copy.title}</span>
                            {copy.subtitle ? (
                              <span
                                className={`mt-1 text-center text-[10px] font-normal leading-snug ${
                                  selected ? "text-brand/80" : "text-white/40"
                                }`}
                              >
                                {copy.subtitle}
                              </span>
                            ) : null}
                          </motion.label>
                        );
                      })}
                    </div>
                  )}
                />
                {errors.paymentMethod && (
                  <div className="text-xs text-rose-300">
                    {errors.paymentMethod.message}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Step 2: Allocate Payment */}
          {currentStep === 2 && (
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                  Payment Allocation
                </h2>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAutoAllocate}
                    disabled={!selectedInvoice || amount <= 0}
                    className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                  >
                    Auto Allocate
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddAllocation}
                    disabled={!selectedInvoice}
                    className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
              </div>

              {selectedInvoice && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white/80">
                      Payment Amount
                    </span>
                    <span className="text-lg font-bold text-white">
                      {formatCurrencyFromMajor(amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white/80">
                      Total Allocated
                    </span>
                    <span className="text-lg font-bold text-white">
                      {formatCurrencyFromMajor(totalAllocated)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-white/10">
                    <span className="text-sm font-medium text-white/80">
                      Remaining
                    </span>
                    <span
                      className={`text-lg font-bold ${
                        Math.abs(remainingAmount) < 0.01
                          ? "text-emerald-300"
                          : remainingAmount > 0
                          ? "text-orange-300"
                          : "text-rose-300"
                      }`}
                    >
                      {formatCurrencyFromMajor(remainingAmount)}
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {fields.map((field, index) => {
                  const lineItem = selectedInvoice?.lineItems?.find(
                    (item: any) => item._id === allocations[index]?.invoiceLineItemId
                  );
                  const maxAmount = lineItem
                    ? toMajorUnits(lineItem.amountOutstandingMinor)
                    : 0;

                  return (
                    <motion.div
                      key={field.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white/80">
                          Allocation {index + 1}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                          className="text-rose-300 hover:text-rose-200"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                          Line Item *
                        </Label>
                        <Controller
                          name={`allocations.${index}.invoiceLineItemId`}
                          control={control}
                          render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger className="border border-white/10 bg-white/5 text-white">
                                <SelectValue placeholder="Select line item" />
                              </SelectTrigger>
                              <SelectContent>
                                {selectedInvoice?.lineItems
                                  ?.filter((item: any) => item.amountOutstandingMinor > 0)
                                  .map((item: any) => (
                                    <SelectItem key={item._id} value={item._id}>
                                      {item.name} • Outstanding: GHS{" "}
                                      {formatMoney(item.amountOutstandingMinor)}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        {errors.allocations?.[index]?.invoiceLineItemId && (
                          <div className="text-xs text-rose-300">
                            {errors.allocations[index]?.invoiceLineItemId?.message}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                          Amount (GHS) * (Max: {formatCurrencyFromMajor(maxAmount)})
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          {...register(`allocations.${index}.amount` as const, {
                            valueAsNumber: true,
                          })}
                          max={maxAmount}
                          className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                        />
                        {errors.allocations?.[index]?.amount && (
                          <div className="text-xs text-rose-300">
                            {errors.allocations[index]?.amount?.message}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                          Notes (Optional)
                        </Label>
                        <Input
                          {...register(`allocations.${index}.notes` as const)}
                          placeholder="Allocation notes..."
                          className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {errors.allocations && (
                <div className="text-xs text-rose-300">
                  {errors.allocations.message || "Please fix allocation errors"}
                </div>
              )}
            </section>
          )}

          {/* Step 3: Review & Submit */}
          {currentStep === 3 && (
            <section className="space-y-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                Review Payment
              </h2>

              <div className="space-y-4">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                    Invoice
                  </p>
                  <p className="text-sm text-white">
                    {selectedInvoice?.invoiceNumber}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                    Payment Amount
                  </p>
                  <p className="text-2xl font-bold text-white">
                    {formatCurrencyFromMajor(amount)}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                    Payment Method
                  </p>
                  <p className="text-sm text-white">
                    {PAYMENT_METHOD_UI[paymentMethod].title}
                  </p>
                  {PAYMENT_METHOD_UI[paymentMethod].subtitle ? (
                    <p className="text-xs text-white/50">
                      {PAYMENT_METHOD_UI[paymentMethod].subtitle}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted mb-2">
                    Allocations
                  </p>
                  <div className="space-y-2">
                    {allocations.map((allocation, index) => {
                      const lineItem = selectedInvoice?.lineItems?.find(
                        (item: any) => item._id === allocation.invoiceLineItemId
                      );
                      return (
                        <div
                          key={index}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-white/80">
                            {lineItem?.name || "Unknown"}
                          </span>
                          <span className="text-white font-medium">
                            {formatCurrencyFromMajor(allocation.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label
                    htmlFor="receiptNumber"
                    className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                  >
                    Receipt Number (Optional)
                  </Label>
                  <Input
                    id="receiptNumber"
                    {...register("receiptNumber")}
                    placeholder="e.g., RCP-2025-001"
                    className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="notes"
                    className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                  >
                    Notes (Optional)
                  </Label>
                  <Input
                    id="notes"
                    {...register("notes")}
                    placeholder="Additional notes..."
                    className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>
            </section>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-6 border-t border-white/10">
        <Button
          type="button"
          variant="ghost"
          onClick={isFirstStep ? onClose : handlePrevious}
          disabled={isSubmitting}
          className="text-white/80 hover:text-white"
        >
          {isFirstStep ? (
            <>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </>
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </>
          )}
        </Button>

        {isLastStep ? (
          <Button
            type="submit"
            disabled={isSubmitting || isLoading || Math.abs(remainingAmount) >= 0.01}
            className="bg-brand hover:bg-brand/90 text-white"
          >
            <Check className="h-4 w-4 mr-2" />
            Record Payment
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleNext}
            className="bg-brand hover:bg-brand/90 text-white"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </form>
  );
}
