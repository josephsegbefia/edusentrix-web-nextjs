// src/components/admin/fees/InstallmentScheduleConfig.tsx
"use client";

import * as React from "react";
import { useFieldArray, Control, useWatch } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Minus, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { calculateInstallmentAmounts, toMinorUnits, toMajorUnits } from "@/lib/fees/money";
import type { CreateInvoiceInput } from "@/schemas/invoice";
import type { BulkCreateInvoiceInput } from "@/schemas/bulk-invoice";

type Props<T extends CreateInvoiceInput | BulkCreateInvoiceInput = CreateInvoiceInput> = {
  control: Control<T>;
  lineItemIndex: number;
  totalAmount: number;
  numberOfInstallments: number;
  startDate?: string; // Optional start date for first installment
};

export function InstallmentScheduleConfig<T extends CreateInvoiceInput | BulkCreateInvoiceInput = CreateInvoiceInput>({
  control,
  lineItemIndex,
  totalAmount,
  numberOfInstallments,
  startDate,
}: Props<T>) {
  const { fields, append, remove, update } = useFieldArray({
    control,
    name: `lineItems.${lineItemIndex}.installmentSchedule` as const,
  });

  const installmentSchedule = useWatch({
    control,
    name: `lineItems.${lineItemIndex}.installmentSchedule` as const,
  });

  // Auto-generate installments when numberOfInstallments changes
  React.useEffect(() => {
    if (numberOfInstallments >= 2 && totalAmount > 0) {
      const amounts = calculateInstallmentAmounts(toMinorUnits(totalAmount), numberOfInstallments);
      const baseDate = startDate ? new Date(startDate) : new Date();

      // Clear existing and create new
      const newSchedule = amounts.map((amountMinor, index) => {
        const dueDate = new Date(baseDate);
        // Spread installments over months (30 days apart)
        dueDate.setDate(dueDate.getDate() + index * 30);

        return {
          installmentNumber: index + 1,
          dueDate: dueDate.toISOString().slice(0, 10),
          amount: toMajorUnits(amountMinor),
        };
      });

      // Update all fields at once
      if (fields.length !== newSchedule.length) {
        // Remove all and add new ones
        fields.forEach((_, idx) => remove(idx));
        newSchedule.forEach((item) => append(item));
      } else {
        // Update existing
        newSchedule.forEach((item, idx) => {
          update(idx, item);
        });
      }
    } else if (numberOfInstallments < 2) {
      // Clear schedule if installments disabled
      fields.forEach((_, idx) => remove(idx));
    }
  }, [numberOfInstallments, totalAmount, startDate]);

  const totalScheduled = installmentSchedule?.reduce(
    (sum, inst) => sum + (inst?.amount || 0),
    0
  ) || 0;
  const difference = Math.abs(totalScheduled - totalAmount);

  return (
    <div className="space-y-4 mt-4 pt-4 border-t border-white/10">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Installment Schedule ({numberOfInstallments} installments)
        </Label>
        {difference > 0.01 && (
          <span className="text-xs text-rose-300">
            Total mismatch: GHS {difference.toFixed(2)}
          </span>
        )}
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {fields.map((field, index) => (
            <motion.div
              key={field.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white/80">
                  Installment {index + 1}
                </span>
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(index)}
                    className="text-rose-300 hover:text-rose-200 h-6 w-6 p-0"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs text-white/60">Due Date</Label>
                  <Input
                    type="date"
                    {...control.register(`lineItems.${lineItemIndex}.installmentSchedule.${index}.dueDate` as const)}
                    className="border border-white/10 bg-white/5 text-white text-sm h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-white/60">Amount (GHS)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    {...control.register(`lineItems.${lineItemIndex}.installmentSchedule.${index}.amount` as const, {
                      valueAsNumber: true,
                    })}
                    className="border border-white/10 bg-white/5 text-white text-sm h-9"
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {fields.length < numberOfInstallments && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const nextNumber = fields.length + 1;
            const baseDate = startDate ? new Date(startDate) : new Date();
            baseDate.setDate(baseDate.getDate() + (nextNumber - 1) * 30);

            append({
              installmentNumber: nextNumber,
              dueDate: baseDate.toISOString().slice(0, 10),
              amount: 0,
            });
          }}
          className="w-full border-white/10 bg-white/5 text-white hover:bg-white/10"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Installment
        </Button>
      )}

      {fields.length > 0 && (
        <div className="pt-2 border-t border-white/10">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/60">Total Scheduled:</span>
            <span className={`font-semibold ${difference > 0.01 ? "text-rose-300" : "text-white"}`}>
              GHS {totalScheduled.toFixed(2)} / GHS {totalAmount.toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
