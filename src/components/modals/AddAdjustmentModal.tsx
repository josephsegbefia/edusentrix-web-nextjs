// src/components/modals/AddAdjustmentModal.tsx
"use client";

import * as React from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AddAdjustmentSchema,
  AddAdjustmentInput,
} from "@/schemas/adjustment";
import { useBusyToast } from "@/hooks/useBusyToast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Check, X, Plus, Minus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  invoiceId: string;
  onClose: () => void;
  onSubmit: (payload: AddAdjustmentInput) => Promise<void>;
  isLoading?: boolean;
};

const STEPS = [
  {
    id: 1,
    title: "Adjustment Details",
    fields: ["lineItems"],
  },
  {
    id: 2,
    title: "Review",
    fields: [],
  },
] as const;

export default function AddAdjustmentModal({
  invoiceId,
  onClose,
  onSubmit,
  isLoading,
}: Props) {
  const busy = useBusyToast();
  const [currentStep, setCurrentStep] = React.useState(1);

  const {
    register,
    handleSubmit,
    control,
    trigger,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AddAdjustmentInput>({
    resolver: zodResolver(AddAdjustmentSchema),
    defaultValues: {
      invoiceId,
      lineItems: [
        {
          name: "",
          description: "",
          amount: 0,
          adjustmentType: "other",
          adjustmentReason: "",
        },
      ],
    },
    mode: "onChange",
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lineItems",
  });

  const lineItems = watch("lineItems");
  const currentStepData = STEPS[currentStep - 1];
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === STEPS.length;

  const totalAdjustment = lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);

  async function internalSubmit(values: AddAdjustmentInput) {
    try {
      await onSubmit(values);
      onClose();
    } catch (e: unknown) {
      console.error("Adjustment creation error:", e);
    }
  }

  async function handleNext() {
    const fieldsToValidate = currentStepData.fields;
    const isValid = await trigger([...fieldsToValidate] as (keyof AddAdjustmentInput)[]);
    if (isValid) {
      setCurrentStep((s) => Math.min(s + 1, STEPS.length));
    }
  }

  function handlePrevious() {
    setCurrentStep((s) => Math.max(s - 1, 1));
  }

  const handleAddLineItem = () => {
    append({
      name: "",
      description: "",
      amount: 0,
      adjustmentType: "other",
      adjustmentReason: "",
    });
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
          {/* Step 1: Adjustment Details */}
          {currentStep === 1 && (
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                  Adjustment Line Items
                </h2>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddLineItem}
                  className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>

              <div className="space-y-4">
                {fields.map((field, index) => (
                  <motion.div
                    key={field.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white/80">
                        Adjustment {index + 1}
                      </span>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                          className="text-rose-300 hover:text-rose-200"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                        Adjustment Type *
                      </Label>
                      <Controller
                        name={`lineItems.${index}.adjustmentType`}
                        control={control}
                        render={({ field }) => (
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            {(["waiver", "scholarship", "correction", "penalty", "other"] as const).map((type) => (
                              <motion.label
                                key={type}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all cursor-pointer ${
                                  field.value === type
                                    ? "border-brand bg-brand/20 text-brand"
                                    : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
                                }`}
                              >
                                <input
                                  type="radio"
                                  value={type}
                                  checked={field.value === type}
                                  onChange={() => field.onChange(type)}
                                  className="sr-only"
                                />
                                <span className="capitalize">{type}</span>
                              </motion.label>
                            ))}
                          </div>
                        )}
                      />
                      {errors.lineItems?.[index]?.adjustmentType && (
                        <div className="text-xs text-rose-300">
                          {errors.lineItems[index]?.adjustmentType?.message}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                          Name *
                        </Label>
                        <Input
                          {...register(`lineItems.${index}.name` as const)}
                          placeholder="e.g., Scholarship Discount"
                          className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                        />
                        {errors.lineItems?.[index]?.name && (
                          <div className="text-xs text-rose-300">
                            {errors.lineItems[index]?.name?.message}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                          Amount (GHS) *
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          {...register(`lineItems.${index}.amount` as const, {
                            valueAsNumber: true,
                          })}
                          placeholder="Negative for credit, positive for charge"
                          className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                        />
                        {errors.lineItems?.[index]?.amount && (
                          <div className="text-xs text-rose-300">
                            {errors.lineItems[index]?.amount?.message}
                          </div>
                        )}
                        <p className="text-xs text-white/50">
                          Use negative values for credits/waivers, positive for additional charges
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                        Reason *
                      </Label>
                      <Input
                        {...register(`lineItems.${index}.adjustmentReason` as const)}
                        placeholder="Explain the reason for this adjustment..."
                        className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                      />
                      {errors.lineItems?.[index]?.adjustmentReason && (
                        <div className="text-xs text-rose-300">
                          {errors.lineItems[index]?.adjustmentReason?.message}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                        Description (Optional)
                      </Label>
                      <Input
                        {...register(`lineItems.${index}.description` as const)}
                        placeholder="Additional details..."
                        className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                      />
                    </div>
                  </motion.div>
                ))}
              </div>

              {errors.lineItems && (
                <div className="text-xs text-rose-300">
                  {errors.lineItems.message || "Please fix adjustment errors"}
                </div>
              )}

              <div className="pt-4 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white/80">
                    Net Adjustment:
                  </span>
                  <span className={`text-lg font-bold ${
                    totalAdjustment < 0 ? "text-emerald-300" : totalAdjustment > 0 ? "text-orange-300" : "text-white"
                  }`}>
                    {totalAdjustment < 0 ? "-" : "+"} GHS {Math.abs(totalAdjustment).toFixed(2)}
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* Step 2: Review */}
          {currentStep === 2 && (
            <section className="space-y-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                Review Adjustments
              </h2>

              <div className="space-y-4">
                {lineItems.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white/80">
                        {item.name}
                      </span>
                      <span className={`text-sm font-semibold ${
                        item.amount < 0 ? "text-emerald-300" : "text-orange-300"
                      }`}>
                        {item.amount < 0 ? "-" : "+"} GHS {Math.abs(item.amount).toFixed(2)}
                      </span>
                    </div>
                    <div className="text-xs text-white/60">
                      <span className="capitalize">{item.adjustmentType}</span>
                      {item.description && ` • ${item.description}`}
                    </div>
                    <div className="text-xs text-white/50">
                      Reason: {item.adjustmentReason}
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white/80">
                    Net Adjustment:
                  </span>
                  <span className={`text-2xl font-bold ${
                    totalAdjustment < 0 ? "text-emerald-300" : totalAdjustment > 0 ? "text-orange-300" : "text-white"
                  }`}>
                    {totalAdjustment < 0 ? "-" : "+"} GHS {Math.abs(totalAdjustment).toFixed(2)}
                  </span>
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
            disabled={isSubmitting || isLoading}
            className="bg-brand hover:bg-brand/90 text-white"
          >
            <Check className="h-4 w-4 mr-2" />
            Add Adjustments
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
