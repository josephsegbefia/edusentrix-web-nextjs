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
import { Switch } from "@/components/ui/switch";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";

const schema = z
  .object({
    yearLabel: z.string().min(1, "Academic year is required"),
    term: z.string().min(1, "Term is required"),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    isYearEndTerminal: z.boolean().default(false),
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

type PeriodSeed = {
  yearLabel?: string | null;
  term?: string | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  isYearEndTerminal?: boolean | null;
};

type CreateAcademicPeriodModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: FormValues) => Promise<void>;
  isLoading?: boolean;
  initialValues?: Partial<FormValues> | null;
  periods?: PeriodSeed[];
  previousPeriod?: PeriodSeed | null;
  title?: string;
  description?: string;
  submitLabel?: string;
};

function toYmd(date: Date | string | null | undefined): string {
  if (!date) return "";
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseYmd(value: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) return null;
  const d = new Date(year, month - 1, day);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function defaultAcademicYear(today = new Date()): string {
  const year = today.getFullYear();
  const startsNewYear = today.getMonth() >= 7;
  const start = startsNewYear ? year : year - 1;
  return `${start}/${start + 1}`;
}

function advanceAcademicYear(label: string): string {
  const slashMatch = label.match(/(\d{4})\s*\/\s*(\d{4})/);
  if (slashMatch) {
    const start = Number(slashMatch[1]) + 1;
    const end = Number(slashMatch[2]) + 1;
    return `${start}/${end}`;
  }
  const dashMatch = label.match(/(\d{4})\s*-\s*(\d{4})/);
  if (dashMatch) {
    const start = Number(dashMatch[1]) + 1;
    const end = Number(dashMatch[2]) + 1;
    return `${start}-${end}`;
  }
  const singleYear = label.match(/\b(\d{4})\b/);
  if (singleYear) return String(Number(singleYear[1]) + 1);
  return defaultAcademicYear();
}

function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

function inferTermNumber(term?: string | null): number | null {
  if (!term) return null;
  const lower = term.toLowerCase();
  const digit = lower.match(/\b([1-3])\b/);
  if (digit) return Number(digit[1]);
  if (/\bfirst\b|\b1st\b/.test(lower)) return 1;
  if (/\bsecond\b|\b2nd\b/.test(lower)) return 2;
  if (/\bthird\b|\b3rd\b/.test(lower)) return 3;
  return null;
}

function nextTermLabel(previousTerm?: string | null): string {
  if (!previousTerm) return "1st Term";
  const current = inferTermNumber(previousTerm) ?? 0;
  const next = current >= 3 ? 1 : current + 1;
  const trimmed = previousTerm.trim();
  if (/^term\s+\d/i.test(trimmed)) return `Term ${next}`;
  if (/^\d+(st|nd|rd|th)\s+term/i.test(trimmed)) return `${ordinal(next)} Term`;
  if (/^first\s+term/i.test(trimmed)) return next === 2 ? "Second Term" : "First Term";
  if (/^second\s+term/i.test(trimmed)) return next === 3 ? "Third Term" : "Second Term";
  if (/^third\s+term/i.test(trimmed)) return "First Term";
  return `${ordinal(next)} Term`;
}

function resetTermLabel(previousTerm?: string | null): string {
  if (!previousTerm) return "1st Term";
  const trimmed = previousTerm.trim();
  if (/^term\s+\d/i.test(trimmed)) return "Term 1";
  if (/^\d+(st|nd|rd|th)\s+term/i.test(trimmed)) return "1st Term";
  if (/^(first|second|third)\s+term/i.test(trimmed)) return "First Term";
  return "1st Term";
}

function latestPeriod(periods: PeriodSeed[] = []): PeriodSeed | null {
  return periods
    .filter((period) => period.endDate || period.startDate)
    .slice()
    .sort((a, b) => {
      const aTime = new Date(a.endDate || a.startDate || 0).getTime();
      const bTime = new Date(b.endDate || b.startDate || 0).getTime();
      return bTime - aTime;
    })[0] ?? null;
}

function buildLeoPeriodDefaults(input: {
  initialValues?: Partial<FormValues> | null;
  periods?: PeriodSeed[];
  previousPeriod?: PeriodSeed | null;
}): { values: FormValues; note: string | null } {
  if (input.initialValues) {
    return {
      values: {
        yearLabel: input.initialValues.yearLabel || "",
        term: input.initialValues.term || "",
        startDate: toYmd(input.initialValues.startDate || ""),
        endDate: toYmd(input.initialValues.endDate || ""),
        isYearEndTerminal: input.initialValues.isYearEndTerminal || false,
      },
      note: null,
    };
  }

  const previous = input.previousPeriod ?? latestPeriod(input.periods);
  if (!previous) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = addDays(start, 89);
    return {
      values: {
        yearLabel: defaultAcademicYear(start),
        term: "1st Term",
        startDate: toYmd(start),
        endDate: toYmd(end),
        isYearEndTerminal: false,
      },
      note: "Leo filled this as the first academic period using 1st Term and the current academic year.",
    };
  }

  const previousTermNo = inferTermNumber(previous.term);
  const shouldAdvanceYear = Boolean(previous.isYearEndTerminal) || previousTermNo === 3;
  const previousEnd = previous.endDate ? new Date(previous.endDate) : new Date();
  const previousStart = previous.startDate ? new Date(previous.startDate) : null;
  const durationDays =
    previousStart && !Number.isNaN(previousStart.getTime()) && !Number.isNaN(previousEnd.getTime())
      ? Math.max(
          28,
          Math.round((previousEnd.getTime() - previousStart.getTime()) / 86400000)
        )
      : 89;
  const nextStart = Number.isNaN(previousEnd.getTime())
    ? new Date()
    : addDays(previousEnd, 1);
  nextStart.setHours(0, 0, 0, 0);
  const nextEnd = addDays(nextStart, durationDays);
  const previousYear = previous.yearLabel || defaultAcademicYear(nextStart);
  const nextYear = shouldAdvanceYear
    ? advanceAcademicYear(previousYear)
    : previousYear;
  const nextTerm = shouldAdvanceYear
    ? resetTermLabel(previous.term)
    : nextTermLabel(previous.term);

  return {
    values: {
      yearLabel: nextYear,
      term: nextTerm,
      startDate: toYmd(nextStart),
      endDate: toYmd(nextEnd),
      isYearEndTerminal: nextTerm.includes("3") || /^third/i.test(nextTerm),
    },
    note: shouldAdvanceYear
      ? `Leo detected that the previous period ended the academic year, so it advanced ${previousYear} to ${nextYear} and restarted at ${nextTerm}.`
      : `Leo followed the previous term naming pattern and suggested ${nextTerm}.`,
  };
}

export default function CreateAcademicPeriodModal({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  initialValues,
  periods,
  previousPeriod,
  title = "Create Academic Period",
  description = "Set the academic year, term, and key dates for this period.",
  submitLabel = "Create Period",
}: CreateAcademicPeriodModalProps) {
  const leoDefaults = React.useMemo(
    () => buildLeoPeriodDefaults({ initialValues, periods, previousPeriod }),
    [
      initialValues,
      periods,
      previousPeriod,
    ]
  );
  const resolvedDefaults = leoDefaults.values;
  const leoNote = leoDefaults.note;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: resolvedDefaults,
    mode: "onChange",
  });

  const isPending = Boolean(isLoading || form.formState.isSubmitting);

  const startDate = form.watch("startDate");
  const startDateValue = parseYmd(startDate);
  const endDateValue = parseYmd(form.watch("endDate"));

  React.useEffect(() => {
    if (!open) return;
    form.reset(resolvedDefaults);
  }, [open, form, resolvedDefaults]);

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
                    {title}
                  </h1>
                  <p className="text-sm text-white/60">
                    {description}
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
                {leoNote ? (
                  <div className="rounded-xl border border-brand/25 bg-brand/10 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
                      Leo suggestion
                    </p>
                    <p className="mt-1 text-sm text-white/75">{leoNote}</p>
                  </div>
                ) : null}

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
                    <CustomDatePicker
                      label="Start date *"
                      value={startDateValue}
                      onChange={(date) =>
                        form.setValue("startDate", toYmd(date), {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                      className="border border-white/10 bg-white/5 text-white focus:border-brand focus:ring-1 focus:ring-brand"
                    />
                    {form.formState.errors.startDate ? (
                      <p className="text-xs text-rose-300">
                        {form.formState.errors.startDate.message}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <CustomDatePicker
                      label="End date *"
                      value={endDateValue}
                      onChange={(date) =>
                        form.setValue("endDate", toYmd(date), {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                      minDate={startDateValue || undefined}
                      className="border border-white/10 bg-white/5 text-white focus:border-brand focus:ring-1 focus:ring-brand"
                    />
                    {form.formState.errors.endDate ? (
                      <p className="text-xs text-rose-300">
                        {form.formState.errors.endDate.message}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                        Year-end period
                      </Label>
                      <p className="text-sm text-white/60">
                        Mark this only when the period is the final period of the academic year. Promotions automation uses this flag.
                      </p>
                    </div>
                    <Switch
                      checked={form.watch("isYearEndTerminal")}
                      onCheckedChange={(checked) =>
                        form.setValue("isYearEndTerminal", checked, {
                          shouldDirty: true,
                        })
                      }
                    />
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
                      `${submitLabel.replace(/\s+/g, " ")}…`
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        {submitLabel}
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
