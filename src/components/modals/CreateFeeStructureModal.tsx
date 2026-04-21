// src/components/modals/CreateFeeStructureModal.tsx
"use client";

import * as React from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateFeeStructureSchema, CreateFeeStructureInput } from "@/schemas/fee";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { motion } from "framer-motion";
import { toMajorUnits } from "@/lib/fees/money";
import { suggestFeeCodeFromName } from "@/lib/fees/suggestFeeCode";
import type { FeeStructure } from "@/hooks/admin/useFeeStructures";
import type { UpdateFeeStructureInput as HookUpdatePayload } from "@/hooks/admin/useFeeStructures";

const EMPTY_DEFAULTS: CreateFeeStructureInput = {
  name: "",
  code: "",
  description: "",
  category: "tuition",
  isActive: true,
  defaultAmount: undefined,
  allowsInstallments: false,
  maxInstallments: undefined,
};

function structureToFormValues(s: FeeStructure): CreateFeeStructureInput {
  return {
    name: s.name,
    code: s.code,
    description: s.description ?? "",
    category: s.category,
    isActive: s.isActive,
    defaultAmount:
      s.defaultAmountMinor != null && Number.isFinite(s.defaultAmountMinor)
        ? toMajorUnits(s.defaultAmountMinor)
        : undefined,
    allowsInstallments: s.allowsInstallments,
    maxInstallments: s.maxInstallments ?? undefined,
  };
}

type CreateProps = {
  mode?: "create";
  onClose: () => void;
  onSubmit: (payload: CreateFeeStructureInput) => Promise<void>;
  isLoading?: boolean;
};

type EditProps = {
  mode: "edit";
  structure: FeeStructure;
  onClose: () => void;
  onSubmit: (payload: HookUpdatePayload) => Promise<void>;
  isLoading?: boolean;
};

type Props = CreateProps | EditProps;

function isEditProps(p: Props): p is EditProps {
  return p.mode === "edit";
}

export default function CreateFeeStructureModal(props: Props) {
  const { onClose, isLoading } = props;
  const mode = isEditProps(props) ? "edit" : "create";
  const editStructure = isEditProps(props) ? props.structure : null;
  /** When true (create only), code is no longer derived from the name */
  const [customCode, setCustomCode] = React.useState(false);

  /** Same rules for create and edit so required fields cannot be cleared accidentally */
  const resolver = zodResolver(
    CreateFeeStructureSchema
  ) as Resolver<CreateFeeStructureInput>;

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateFeeStructureInput>({
    resolver,
    defaultValues: editStructure
      ? structureToFormValues(editStructure)
      : EMPTY_DEFAULTS,
    mode: "onChange",
  });

  React.useEffect(() => {
    if (mode === "edit" && editStructure) {
      reset(structureToFormValues(editStructure));
    } else if (mode === "create") {
      setCustomCode(false);
      reset(EMPTY_DEFAULTS);
    }
  }, [mode, editStructure, reset]);

  const nameValue = watch("name");
  const allowsInstallments = watch("allowsInstallments");

  const codeField = register("code");

  React.useEffect(() => {
    if (mode !== "create" || customCode) return;
    const next = suggestFeeCodeFromName(nameValue ?? "");
    setValue("code", next, { shouldValidate: true });
  }, [mode, customCode, nameValue, setValue]);

  async function internalSubmit(values: CreateFeeStructureInput) {
    try {
      if (isEditProps(props)) {
        const payload: HookUpdatePayload = {
          name: values.name,
          code: values.code,
          description: values.description?.trim() ? values.description : null,
          category: values.category,
          isActive: values.isActive,
          defaultAmount:
            values.defaultAmount === undefined ? undefined : values.defaultAmount,
          allowsInstallments: values.allowsInstallments,
          maxInstallments: values.allowsInstallments
            ? values.maxInstallments ?? null
            : null,
        };
        await props.onSubmit(payload);
      } else {
        await props.onSubmit(values);
      }
      onClose();
    } catch (e: unknown) {
      console.error("Fee structure save error:", e);
    }
  }

  const submitLabel = mode === "edit" ? "Save changes" : "Create fee structure";

  return (
    <form onSubmit={handleSubmit(internalSubmit)} className="space-y-8">
      <div className="space-y-6">
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Details
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label
                htmlFor="name"
                className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
              >
                Name *
              </Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="e.g., Tuition Fee"
                className="border border-white/10 bg-white/5 text-white placeholder:text-muted-foreground focus:border-brand focus:ring-1 focus:ring-brand"
              />
              {errors.name && (
                <div className="text-xs text-rose-300">{errors.name.message}</div>
              )}
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="code"
                className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
              >
                Code *
              </Label>
              <Input
                id="code"
                name={codeField.name}
                ref={codeField.ref}
                onBlur={codeField.onBlur}
                onChange={(e) => {
                  if (mode === "create") setCustomCode(true);
                  codeField.onChange(e);
                }}
                placeholder={mode === "create" ? "From fee name" : "e.g., TUITION"}
                className="border border-white/10 bg-white/5 text-white placeholder:text-muted-foreground focus:border-brand focus:ring-1 focus:ring-brand uppercase"
              />
              <p className="text-xs text-white/45">
                {mode === "create" ? (
                  <>
                    We build this from the fee name (up to 20 characters: words separated by
                    underscores). Edit this field anytime for a custom code.
                  </>
                ) : (
                  <>Short label for reports and imports.</>
                )}
              </p>
              {errors.code && (
                <div className="text-xs text-rose-300">{errors.code.message}</div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Category *
            </Label>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2 md:grid-cols-5 md:gap-3">
                  {(["tuition", "library", "sports", "uniform", "other"] as const).map(
                    (cat) => (
                      <motion.label
                        key={cat}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all md:px-4 md:py-3 ${
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
                    )
                  )}
                </div>
              )}
            />
            {errors.category && (
              <div className="text-xs text-rose-300">{errors.category.message}</div>
            )}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="description"
              className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
            >
              Description
            </Label>
            <Input
              id="description"
              {...register("description")}
              placeholder="Optional notes for staff…"
              className="border border-white/10 bg-white/5 text-white placeholder:text-muted-foreground focus:border-brand focus:ring-1 focus:ring-brand"
            />
            {errors.description && (
              <div className="text-xs text-rose-300">{errors.description.message}</div>
            )}
          </div>
        </section>

        <div className="h-px bg-white/10" />

        <section className="space-y-5">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Amount & installments
            </h2>
            <p className="mt-1 text-sm text-white/55">
              Default amount is used when issuing invoices; you can still override per invoice.
            </p>
          </div>

          <div className="rounded-xl border border-brand/25 bg-brand/10 p-4 md:p-5">
            <div className="space-y-2">
              <Label
                htmlFor="defaultAmount"
                className="text-xs font-medium uppercase tracking-[0.2em] text-white/80"
              >
                Default amount (GHS)
              </Label>
              <Input
                id="defaultAmount"
                type="number"
                step="0.01"
                inputMode="decimal"
                {...register("defaultAmount")}
                placeholder="0.00"
                className="border border-white/15 bg-white/10 text-lg font-semibold text-white placeholder:text-white/40 focus:border-brand focus:ring-1 focus:ring-brand"
              />
              {errors.defaultAmount && (
                <div className="text-xs text-rose-300">{errors.defaultAmount.message}</div>
              )}
              <p className="text-xs text-white/50">
                Leave empty if this template does not imply a fixed price.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <Controller
              name="allowsInstallments"
              control={control}
              render={({ field }) => (
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded border-white/20 bg-white/5 accent-brand"
                  />
                  <span className="text-sm text-white/80">Allow installments</span>
                </label>
              )}
            />

            {allowsInstallments && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <Label
                  htmlFor="maxInstallments"
                  className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
                >
                  Maximum installments
                </Label>
                <Input
                  id="maxInstallments"
                  type="number"
                  min="2"
                  max="12"
                  inputMode="numeric"
                  {...register("maxInstallments")}
                  placeholder="e.g., 3"
                  className="border border-white/10 bg-white/5 text-white placeholder:text-muted-foreground focus:border-brand focus:ring-1 focus:ring-brand"
                />
                {errors.maxInstallments && (
                  <div className="text-xs text-rose-300">
                    {errors.maxInstallments.message}
                  </div>
                )}
                <p className="text-xs text-white/50">Between 2 and 12 when installments are on.</p>
              </motion.div>
            )}
          </div>

          {mode === "edit" && (
            <Controller
              name="isActive"
              control={control}
              render={({ field }) => (
                <label className="flex cursor-pointer items-center gap-3 border-t border-white/10 pt-4">
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded border-white/20 bg-white/5 accent-brand"
                  />
                  <span className="text-sm text-white/80">Structure is active</span>
                </label>
              )}
            />
          )}
        </section>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-6">
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={isSubmitting}
          className="text-white/80 hover:text-white"
        >
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>

        <Button
          type="submit"
          disabled={isSubmitting || isLoading}
          className="bg-brand text-white hover:bg-brand/90"
        >
          <Check className="mr-2 h-4 w-4" />
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
