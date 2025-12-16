// src/components/modals/CreateFeeStructureModal.tsx
"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CreateFeeStructureSchema,
  CreateFeeStructureInput,
} from "@/schemas/fee";
import { useBusyToast } from "@/hooks/useBusyToast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  onClose: () => void;
  onSubmit: (payload: CreateFeeStructureInput) => Promise<void>;
  isLoading?: boolean;
};

const STEPS = [
  {
    id: 1,
    title: "Basic Information",
    fields: ["name", "code", "category", "description"],
  },
  {
    id: 2,
    title: "Amount & Installments",
    fields: ["defaultAmount", "allowsInstallments", "maxInstallments"],
  },
] as const;

export default function CreateFeeStructureModal({
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
  } = useForm<CreateFeeStructureInput>({
    resolver: zodResolver(CreateFeeStructureSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      category: "tuition",
      isActive: true,
      defaultAmount: undefined,
      allowsInstallments: false,
      maxInstallments: undefined,
    },
    mode: "onChange",
  });

  const allowsInstallments = watch("allowsInstallments");
  const currentStepData = STEPS[currentStep - 1];
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === STEPS.length;

  async function internalSubmit(values: CreateFeeStructureInput) {
    try {
      await onSubmit(values);
      onClose();
    } catch (e: unknown) {
      console.error("Fee structure creation error:", e);
    }
  }

  async function handleNext() {
    const fields = currentStepData.fields;
    const isValid = await trigger([...fields] as (keyof CreateFeeStructureInput)[]);
    if (isValid) {
      setCurrentStep((s) => Math.min(s + 1, STEPS.length));
    }
  }

  function handlePrevious() {
    setCurrentStep((s) => Math.max(s - 1, 1));
  }

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
          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                Fee Structure Details
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label
                    htmlFor="name"
                    className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                  >
                    Name *
                  </Label>
                  <Input
                    id="name"
                    {...register("name")}
                    placeholder="e.g., Tuition Fee"
                    className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                  {errors.name && (
                    <div className="text-xs text-rose-300">
                      {errors.name.message}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="code"
                    className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                  >
                    Code *
                  </Label>
                  <Input
                    id="code"
                    {...register("code")}
                    placeholder="e.g., TUITION"
                    className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand uppercase"
                  />
                  {errors.code && (
                    <div className="text-xs text-rose-300">
                      {errors.code.message}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                  Category *
                </Label>
                <Controller
                  name="category"
                  control={control}
                  render={({ field }) => (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {(["tuition", "library", "sports", "uniform", "other"] as const).map((cat) => (
                        <motion.label
                          key={cat}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-all cursor-pointer ${
                            field.value === cat
                              ? "border-brand bg-brand/20 text-brand"
                              : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
                          }`}
                        >
                          <input
                            type="radio"
                            value={cat}
                            checked={field.value === cat}
                            onChange={() => field.onChange(cat)}
                            className="sr-only"
                          />
                          <span className="capitalize">{cat}</span>
                        </motion.label>
                      ))}
                    </div>
                  )}
                />
                {errors.category && (
                  <div className="text-xs text-rose-300">
                    {errors.category.message}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="description"
                  className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                >
                  Description
                </Label>
                <Input
                  id="description"
                  {...register("description")}
                  placeholder="Optional description..."
                  className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                />
                {errors.description && (
                  <div className="text-xs text-rose-300">
                    {errors.description.message}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Step 2: Amount & Installments */}
          {currentStep === 2 && (
            <section className="space-y-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                Amount & Installment Settings
              </h2>

              <div className="space-y-2">
                <Label
                  htmlFor="defaultAmount"
                  className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                >
                  Default Amount (GHS)
                </Label>
                <Input
                  id="defaultAmount"
                  type="number"
                  step="0.01"
                  {...register("defaultAmount", { valueAsNumber: true })}
                  placeholder="0.00"
                  className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                />
                {errors.defaultAmount && (
                  <div className="text-xs text-rose-300">
                    {errors.defaultAmount.message}
                  </div>
                )}
                <p className="text-xs text-white/50">
                  Optional default amount for this fee type
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Controller
                    name="allowsInstallments"
                    control={control}
                    render={({ field }) => (
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                          className="h-4 w-4 rounded border-white/20 bg-white/5 accent-brand cursor-pointer"
                        />
                        <span className="text-sm text-white/80">
                          Allow Installments
                        </span>
                      </label>
                    )}
                  />
                </div>

                {allowsInstallments && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2"
                  >
                    <Label
                      htmlFor="maxInstallments"
                      className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                    >
                      Maximum Installments
                    </Label>
                    <Input
                      id="maxInstallments"
                      type="number"
                      min="2"
                      max="12"
                      {...register("maxInstallments", { valueAsNumber: true })}
                      placeholder="e.g., 3"
                      className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                    />
                    {errors.maxInstallments && (
                      <div className="text-xs text-rose-300">
                        {errors.maxInstallments.message}
                      </div>
                    )}
                    <p className="text-xs text-white/50">
                      Maximum number of installments allowed (2-12)
                    </p>
                  </motion.div>
                )}
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
            Create Fee Structure
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
