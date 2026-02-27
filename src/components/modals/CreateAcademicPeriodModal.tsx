"use client";

import * as React from "react";
import { z } from "zod";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z
  .object({
    yearLabel: z.string().min(1, "Academic year is required"),
    term: z.string().min(1, "Term is required"),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
  })
  .superRefine((val, ctx) => {
    const start = new Date(val.startDate);
    const end = new Date(val.endDate);

    if (Number.isNaN(start.getTime())) {
      ctx.addIssue({
        code: "custom",
        path: ["startDate"],
        message: "Start date is invalid",
      });
    }

    if (Number.isNaN(end.getTime())) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date is invalid",
      });
    }

    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      if (end < start) {
        ctx.addIssue({
          code: "custom",
          path: ["endDate"],
          message: "End date must be after start date",
        });
      }
    }
  });

type FormValues = z.infer<typeof schema>;

type CreateAcademicPeriodModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: FormValues) => Promise<void>;
  isLoading?: boolean;
};

export default function CreateAcademicPeriodModal({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: CreateAcademicPeriodModalProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      yearLabel: "",
      term: "",
      startDate: "",
      endDate: "",
    },
    mode: "onChange",
  });

  const isPending = Boolean(isLoading || form.formState.isSubmitting);

  const startDate = form.watch("startDate");

  React.useEffect(() => {
    if (!open) return;
    form.reset({
      yearLabel: "",
      term: "",
      startDate: "",
      endDate: "",
    });
  }, [open, form]);

  React.useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onOpenChange(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, isPending, onOpenChange]);

  async function handleSubmit(values: FormValues) {
    try {
      await onSubmit(values);
      form.reset();
      onOpenChange(false);
    } catch {
      // keep modal open; parent handles toasts
    }
  }

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        aria-modal="true"
        role="dialog"
      >
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !isPending)
              onOpenChange(false);
          }}
        />

        <div className="relative z-10 flex min-h-full items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-[860px] overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 text-white shadow-2xl shadow-black/40"
          >
            <div className="px-6 pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h1 className="text-lg font-semibold">
                    Create Academic Period
                  </h1>
                  <p className="text-sm text-white/60">
                    Set the academic year, term, and key dates for this period.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={isPending}
                  className="h-9 w-9 rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-5 h-px bg-white/10" />
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="space-y-6"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                      Academic year *
                    </Label>
                    <Input
                      placeholder="2024/2025"
                      className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                      {...form.register("yearLabel")}
                    />
                    {form.formState.errors.yearLabel ? (
                      <p className="text-xs text-rose-300">
                        {form.formState.errors.yearLabel.message}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                      Term *
                    </Label>
                    <Input
                      placeholder="1st Term"
                      className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                      {...form.register("term")}
                    />
                    {form.formState.errors.term ? (
                      <p className="text-xs text-rose-300">
                        {form.formState.errors.term.message}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                      Start date *
                    </Label>
                    <Input
                      type="date"
                      className="border border-white/10 bg-white/5 text-white focus:border-brand focus:ring-1 focus:ring-brand"
                      {...form.register("startDate")}
                    />
                    {form.formState.errors.startDate ? (
                      <p className="text-xs text-rose-300">
                        {form.formState.errors.startDate.message}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                      End date *
                    </Label>
                    <Input
                      type="date"
                      min={startDate || undefined}
                      className="border border-white/10 bg-white/5 text-white focus:border-brand focus:ring-1 focus:ring-brand"
                      {...form.register("endDate")}
                    />
                    {form.formState.errors.endDate ? (
                      <p className="text-xs text-rose-300">
                        {form.formState.errors.endDate.message}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-white/10">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={isPending}
                    className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isPending}
                    className="gap-2 bg-brand text-black hover:opacity-90"
                  >
                    {isPending ? (
                      "Creating…"
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Create Period
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
