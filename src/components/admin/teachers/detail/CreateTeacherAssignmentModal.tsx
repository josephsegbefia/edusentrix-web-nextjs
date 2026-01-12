// src/components/admin/teachers/detail/CreateTeacherAssignmentModal.tsx
"use client";

import * as React from "react";
import { z } from "zod";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Check,
  ChevronsUpDown,
  AlertTriangle,
  Info,
  Clock,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useAcademicPeriods } from "@/hooks/admin/useAcademicPeriods";
import {
  useSubjectSearch,
  useClassGroupSearch,
} from "@/hooks/admin/useDirectorySearch";
import { useCreateTeacherAssignment } from "@/hooks/admin/useTeacherAssignments";
import { useTeacherWorkload } from "@/hooks/admin/useTeacherWorkload";
import { premiumSelectContent, premiumMenuItem } from "@/components/ui/premium";

const DOW = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
] as const;

const scheduleItemSchema = z.object({
  dayOfWeek: z.coerce.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Start time must be HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "End time must be HH:MM"),
  location: z.string().max(80).optional(),
});

const baseSchema = z.object({
  academicPeriodId: z.string().min(1, "Select an academic period"),
  subjectId: z.string().min(1, "Select a subject"),
  classGroupId: z.string().min(1, "Select a class group"),
  workloadHours: z.coerce.number().min(0).max(80),
  notes: z.string().max(500).optional(),
  includeSchedule: z.boolean(),
  schedules: z.array(scheduleItemSchema).optional(),
});

const schema = baseSchema.superRefine((val, ctx) => {
  if (!val.includeSchedule || !val.schedules || val.schedules.length === 0)
    return;

  val.schedules.forEach((s, idx) => {
    if (s.startTime && s.endTime) {
      const [sh, sm] = s.startTime.split(":").map(Number);
      const [eh, em] = s.endTime.split(":").map(Number);
      const start = sh * 60 + sm;
      const end = eh * 60 + em;
      if (start >= end) {
        ctx.addIssue({
          code: "custom",
          path: ["schedules", idx, "endTime"],
          message: "End time must be after start time",
        });
      }
    }
  });
});

type FormValues = z.infer<typeof schema>;

const STEPS = [
  {
    id: 1,
    title: "Assignment Details",
    fields: ["academicPeriodId", "workloadHours", "subjectId", "classGroupId"],
  },
  {
    id: 2,
    title: "Schedules",
    fields: ["includeSchedule", "schedules"],
  },
  { id: 3, title: "Notes & Confirm", fields: ["notes"] },
] as const;

function Callout({
  tone,
  title,
  children,
}: {
  tone: "warning" | "info";
  title: string;
  children?: React.ReactNode;
}) {
  const Icon = tone === "warning" ? AlertTriangle : Info;
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        tone === "warning"
          ? "border-amber-400/20 bg-amber-500/10 text-amber-100"
          : "border-sky-400/20 bg-sky-500/10 text-sky-100"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold">{title}</p>
          {children ? (
            <div className="text-sm text-white/80">{children}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Combobox({
  label,
  placeholder,
  valueLabel,
  onOpenChange,
  open,
  query,
  setQuery,
  items,
  isLoading,
  onSelect,
  emptyText,
}: {
  label?: string;
  placeholder: string;
  valueLabel: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  query: string;
  setQuery: (v: string) => void;
  items: Array<{ id: string; label: string }>;
  isLoading?: boolean;
  onSelect: (id: string, label: string) => void;
  emptyText?: string;
}) {
  return (
    <div className="space-y-2">
      {label ? (
        <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          {label}
        </Label>
      ) : null}

      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full justify-between border border-white/10 bg-white/5 text-white hover:bg-white/10 focus-visible:ring-1 focus-visible:ring-brand"
          >
            <span
              className={cn(
                "truncate",
                valueLabel ? "text-white" : "text-muted-foreground"
              )}
            >
              {valueLabel || placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-70" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className={cn(
            premiumSelectContent,
            "w-(--radix-popover-trigger-width) p-1 max-h-[400px]"
          )}
        >
          <Command shouldFilter={false} className="bg-transparent">
            <CommandInput
              placeholder="Search…"
              value={query}
              onValueChange={setQuery}
              className="border-b border-neutral-800/60 bg-transparent"
            />
            <CommandList className="max-h-[300px] overflow-y-auto">
              {isLoading ? (
                <div className="px-3 py-3 text-sm text-neutral-400">
                  Searching…
                </div>
              ) : (
                <>
                  <CommandEmpty className="py-6 text-center text-sm text-neutral-400">
                    {emptyText || "No results found."}
                  </CommandEmpty>
                  <CommandGroup>
                    {items.map((it) => (
                      <CommandItem
                        key={it.id}
                        value={it.id}
                        onSelect={() => {
                          onSelect(it.id, it.label);
                          onOpenChange(false);
                        }}
                        className={cn(
                          premiumMenuItem,
                          "flex items-center justify-between"
                        )}
                      >
                        <span className="truncate">{it.label}</span>
                        {valueLabel === it.label ? (
                          <Check className="h-4 w-4 text-neutral-300" />
                        ) : null}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function CreateTeacherAssignmentModal({
  open,
  onOpenChange,
  teacher,
  currentActiveAssignmentsCount,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  teacher: { id: string; fullName: string; maxClasses: number | null };
  currentActiveAssignmentsCount: number;
}) {
  const { data: periodsRes, isLoading: periodsLoading } = useAcademicPeriods();
  const periods = React.useMemo(
    () => periodsRes?.periods ?? [],
    [periodsRes?.periods]
  );

  const currentPeriod = React.useMemo(
    () => periods.find((p) => p.isCurrent) || periods[0] || null,
    [periods]
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      academicPeriodId: "",
      subjectId: "",
      classGroupId: "",
      workloadHours: 0,
      notes: "",
      includeSchedule: false,
      schedules: [],
    },
    mode: "onChange",
  });

  const { mutateAsync, isPending } = useCreateTeacherAssignment(teacher.id);

  const academicPeriodId = form.watch("academicPeriodId");
  const { data: workloadData } = useTeacherWorkload(
    teacher.id,
    academicPeriodId || undefined
  );
  const workload = workloadData?.data;

  const [currentStep, setCurrentStep] = React.useState(1);

  const [subjectOpen, setSubjectOpen] = React.useState(false);
  const [classOpen, setClassOpen] = React.useState(false);
  const [subjectQuery, setSubjectQuery] = React.useState("");
  const [classQuery, setClassQuery] = React.useState("");

  const subjectQ = useDebouncedValue(subjectQuery, 250);
  const classQ = useDebouncedValue(classQuery, 250);

  const subjectsQ = useSubjectSearch(subjectQ);
  const classGroupsQ = useClassGroupSearch(classQ);

  const subjectItems = (subjectsQ.data?.data ?? []).map((s) => ({
    id: s.id,
    label: s.name,
  }));
  const classItems = (classGroupsQ.data?.data ?? []).map((g) => ({
    id: g.id,
    label: g.label || g.name,
  }));

  const [selectedSubjectLabel, setSelectedSubjectLabel] = React.useState<
    string | null
  >(null);
  const [selectedClassLabel, setSelectedClassLabel] = React.useState<
    string | null
  >(null);

  // Location combobox state (using class groups for location)
  const [locationOpenIndex, setLocationOpenIndex] = React.useState<
    number | null
  >(null);
  const [locationQuery, setLocationQuery] = React.useState("");
  const locationQ = useDebouncedValue(locationQuery, 250);
  const locationGroupsQ = useClassGroupSearch(locationQ);
  const locationItems = (locationGroupsQ.data?.data ?? []).map((g) => ({
    id: g.id,
    label: g.label || g.name,
  }));

  const [warnings, setWarnings] = React.useState<string[]>([]);
  const [conflict, setConflict] = React.useState<{
    subject?: { name: string };
    classGroup?: { name: string };
    schedule?: { dayOfWeek?: number; startTime?: string; endTime?: string };
  } | null>(null);
  const [result, setResult] = React.useState<{ id: string } | null>(null);

  const maxClasses = teacher.maxClasses;
  const atCapacity =
    typeof maxClasses === "number" &&
    maxClasses >= 0 &&
    currentActiveAssignmentsCount >= maxClasses;

  // Escape to close + lock body scroll (Dialog-like behavior, without Dialog)
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

  // reset / defaults on open
  React.useEffect(() => {
    if (!open) return;

    setCurrentStep(1);
    setResult(null);
    setWarnings([]);
    setConflict(null);
    setLocationOpenIndex(null);
    setLocationQuery("");

    setSubjectOpen(false);
    setClassOpen(false);
    setSubjectQuery("");
    setClassQuery("");

    if (!form.getValues("academicPeriodId") && currentPeriod?._id) {
      form.setValue("academicPeriodId", currentPeriod._id, {
        shouldValidate: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentPeriod?._id]);

  const includeSchedule = form.watch("includeSchedule");
  const schedules = form.watch("schedules") || [];

  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === STEPS.length;

  async function handleNext() {
    const step = STEPS[currentStep - 1];
    const fields = [...step.fields] as Array<keyof FormValues>;
    const ok = await form.trigger(fields, { shouldFocus: true });
    if (!ok) return;
    setCurrentStep((s) => Math.min(s + 1, STEPS.length));
  }

  function handlePrevious() {
    setCurrentStep((s) => Math.max(s - 1, 1));
  }

  const periodLabel = (pId: string) => {
    const p = periods.find((x) => x._id === pId);
    return p ? `${p.yearLabel} • ${p.term}` : "—";
  };

  async function onSubmit(values: FormValues) {
    setWarnings([]);
    setConflict(null);

    // Check workload before submitting (unchanged)
    if (workload) {
      const newClassCount = workload.current.classes + 1;
      const wouldExceedClasses =
        workload.capacity.maxClasses &&
        newClassCount > workload.capacity.maxClasses;
      const wouldExceedStudents =
        workload.capacity.maxStudents &&
        workload.current.students > workload.capacity.maxStudents;

      if (wouldExceedClasses || wouldExceedStudents) {
        const warningMessages: string[] = [];
        if (wouldExceedClasses) {
          warningMessages.push(
            `This assignment would exceed the teacher's maximum class capacity (${workload.capacity.maxClasses} classes). Current: ${workload.current.classes}, After: ${newClassCount}`
          );
        }
        if (wouldExceedStudents) {
          warningMessages.push(
            `This assignment may exceed the teacher's maximum student capacity (${workload.capacity.maxStudents} students). Current: ${workload.current.students}`
          );
        }

        const shouldProceed = window.confirm(
          `⚠️ Workload Warning\n\n${warningMessages.join(
            "\n\n"
          )}\n\nDo you want to proceed anyway?`
        );

        if (!shouldProceed) return;
      }
    }

    const payload = {
      academicPeriodId: values.academicPeriodId,
      subjectId: values.subjectId,
      classGroupId: values.classGroupId,
      workloadHours: values.workloadHours ?? 0,
      notes: values.notes || undefined,
      schedules:
        values.includeSchedule &&
        values.schedules &&
        values.schedules.length > 0
        ? values.schedules
        : undefined,
      status: "active" as const,
    };

    try {
      const res = await mutateAsync(payload);
      setWarnings(res.warnings ?? []);
      setResult({ id: res.data.id });

      toast.success("Assignment created", {
        description: `${teacher.fullName} is now assigned.`,
      });
    } catch (e: unknown) {
      const error = e as {
        status?: number;
        message?: string;
        meta?: { conflict?: unknown };
      };
      const meta = error?.meta;
      if (error?.status === 409 && meta?.conflict) {
        setConflict(meta.conflict as typeof conflict);
      }
      toast.error(error?.message || "Failed to create assignment");
    }
  }

  // match CreateStudentModal behavior: if closed, render nothing (parent controls open)
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
        {/* Overlay */}
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
          onMouseDown={(e) => {
            // click outside to close
            if (e.target === e.currentTarget && !isPending) onOpenChange(false);
          }}
        />

        {/* Panel */}
        <div className="relative z-10 flex min-h-full items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className={cn(
              // SOLID dark panel (like CreateStudentModal vibe)
              "w-full max-w-[860px] overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 text-white shadow-2xl shadow-black/40"
            )}
          >
            {/* Header (clear + underlined) */}
            <div className="px-6 pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h1 className="text-lg font-semibold">Create Assignment</h1>
                  <p className="text-sm text-white/60">
            Assign a subject and class group to{" "}
                    <span className="font-medium text-white/85">
              {teacher.fullName}
            </span>
            .
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

            {/* Body (scrollable) */}
            <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
              <div className="space-y-6">
                {/* banners */}
            {atCapacity ? (
          <Callout tone="warning" title="Capacity warning">
                    This teacher already has{" "}
                    <b>{currentActiveAssignmentsCount}</b> active assignments
            {typeof maxClasses === "number" ? (
              <>
                {" "}
                (limit: <b>{maxClasses}</b>)
              </>
            ) : null}
            . You can still proceed, but consider rebalancing workloads.
          </Callout>
        ) : null}

            {conflict ? (
          <Callout tone="warning" title="Schedule conflict detected">
            <div className="space-y-1">
              <p className="text-white/80">
                Overlaps with:{" "}
                <b>
                  {conflict.subject?.name ?? "Subject"} •{" "}
                  {conflict.classGroup?.name ?? "Class"}
                </b>
              </p>
              {conflict.schedule?.dayOfWeek != null &&
              conflict.schedule?.startTime &&
              conflict.schedule?.endTime ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                  <Clock className="h-3.5 w-3.5" />
                  {DOW[Number(conflict.schedule.dayOfWeek)]?.label ??
                    `Day ${conflict.schedule.dayOfWeek}`}{" "}
                          • {conflict.schedule.startTime}-
                          {conflict.schedule.endTime}
                </div>
              ) : null}
              <p className="text-white/70">
                        Adjust the day/time or remove schedule from this
                        assignment.
              </p>
            </div>
          </Callout>
        ) : null}

            {result ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-emerald-100">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5">
                  <Check className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                          <p className="text-sm font-semibold">
                            Assignment created
                          </p>
                  <p className="text-sm text-white/80">
                    {periodLabel(form.getValues("academicPeriodId"))} •{" "}
                            {selectedSubjectLabel ?? "—"} •{" "}
                            {selectedClassLabel ?? "—"}
                  </p>
                  {warnings.length ? (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-semibold text-white/80">
                        Warnings
                      </p>
                      <ul className="list-disc space-y-1 pl-5 text-sm text-white/75">
                        {warnings.map((w, idx) => (
                          <li key={idx}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

                    <div className="flex items-center justify-end pt-2">
                <Button
                  variant="outline"
                        className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                  onClick={() => {
                    form.reset();
                          setSelectedSubjectLabel(null);
                          setSelectedClassLabel(null);
                          setResult(null);
                    onOpenChange(false);
                  }}
                >
                  Close
                </Button>
                    </div>
            </div>
          ) : (
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-8"
                  >
                    {/* Step indicator (same style as CreateStudentModal) */}
                    <div className="flex items-center justify-between pb-2">
                      <div className="text-sm text-white/70">
                        Step{" "}
                        <span className="font-semibold">{currentStep}</span> of{" "}
                        {STEPS.length}
                      </div>
                      <div className="flex gap-1">
                        {STEPS.map((_, i) => (
                          <span
                            key={i}
                            className={cn(
                              "h-1.5 w-8 rounded-full transition-all",
                              i + 1 <= currentStep ? "bg-brand" : "bg-white/20"
                            )}
                          />
                        ))}
                      </div>
                    </div>

                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-6"
                      >
                        {currentStep === 1 && (
                          <section className="space-y-6">
                            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                              Assignment Details
                            </h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                                <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                                  Academic Period *
                                </Label>
                <Select
                  value={form.watch("academicPeriodId")}
                  onValueChange={(v) =>
                    form.setValue("academicPeriodId", v, {
                      shouldValidate: true,
                    })
                  }
                >
                                  <SelectTrigger className="border border-white/10 bg-white/5 text-white hover:bg-white/10 focus:ring-1 focus:ring-brand">
                    <SelectValue
                      placeholder={
                                        periodsLoading
                                          ? "Loading…"
                                          : "Select academic period"
                      }
                    />
                  </SelectTrigger>
                                  <SelectContent
                                    className={premiumSelectContent}
                                  >
                    {periods.map((p) => (
                      <SelectItem
                        key={p._id}
                        value={p._id}
                        className={premiumMenuItem}
                      >
                        <div className="flex items-center gap-2">
                          <span>{p.yearLabel}</span>
                                          <span className="text-neutral-500">
                                            •
                                          </span>
                          <span>{p.term}</span>
                          {p.isCurrent ? (
                            <Badge
                              variant="outline"
                              className="ml-2 border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                            >
                              Current
                            </Badge>
                          ) : null}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.academicPeriodId ? (
                                  <p className="text-xs text-rose-300">
                                    {
                                      form.formState.errors.academicPeriodId
                                        .message
                                    }
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                                <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                                  Workload (hours/week)
                                </Label>
                <Input
                  type="number"
                  min={0}
                  max={80}
                  step={1}
                                  className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                  {...form.register("workloadHours")}
                />
              </div>
            </div>

            <Separator className="bg-white/10" />

            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-2">
              <Combobox
                                  label="Subject *"
                placeholder="Select subject"
                valueLabel={selectedSubjectLabel}
                open={subjectOpen}
                onOpenChange={setSubjectOpen}
                query={subjectQuery}
                setQuery={setSubjectQuery}
                items={subjectItems}
                isLoading={subjectsQ.isLoading}
                emptyText="No subjects found."
                onSelect={(id, label) => {
                                    form.setValue("subjectId", id, {
                                      shouldValidate: true,
                                    });
                  setSelectedSubjectLabel(label);
                }}
              />
              {form.formState.errors.subjectId ? (
                                  <p className="text-xs text-rose-300">
                  {form.formState.errors.subjectId.message}
                </p>
              ) : null}
                              </div>

                              <div className="space-y-2">
              <Combobox
                                  label="Class Group *"
                placeholder="Select class group"
                valueLabel={selectedClassLabel}
                open={classOpen}
                onOpenChange={setClassOpen}
                query={classQuery}
                setQuery={setClassQuery}
                items={classItems}
                isLoading={classGroupsQ.isLoading}
                emptyText="No class groups found."
                onSelect={(id, label) => {
                                    form.setValue("classGroupId", id, {
                                      shouldValidate: true,
                                    });
                  setSelectedClassLabel(label);
                }}
              />
              {form.formState.errors.classGroupId ? (
                                  <p className="text-xs text-rose-300">
                  {form.formState.errors.classGroupId.message}
                </p>
              ) : null}
            </div>
                            </div>
                          </section>
                        )}

                        {currentStep === 2 && (
                          <section className="space-y-6">
                            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                              Schedules
                            </h2>

            <Accordion
              type="single"
              collapsible
                              value={includeSchedule ? "schedule" : ""}
              className="rounded-2xl border border-white/10 bg-white/5"
              onValueChange={(v) =>
                                form.setValue(
                                  "includeSchedule",
                                  v === "schedule"
                                )
              }
            >
                              <AccordionItem
                                value="schedule"
                                className="border-none"
                              >
                              <AccordionTrigger className="px-4 py-3 text-sm">
                  Optional schedules (recommended)
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-4">
                                    {(!schedules || schedules.length === 0) && (
                      <Button
                        type="button"
                        variant="outline"
                                        className="w-full border-dashed border-white/20 bg-transparent hover:bg-white/5 hover:border-white/30"
                        onClick={() => {
                          form.setValue(
                            "schedules",
                            [
                              {
                                dayOfWeek: 1,
                                startTime: "",
                                endTime: "",
                                location: undefined,
                              },
                            ],
                            { shouldValidate: false }
                          );
                                          if (
                                            !form.getValues("includeSchedule")
                                          ) {
                                            form.setValue(
                                              "includeSchedule",
                                              true
                                            );
                          }
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add First Schedule
                      </Button>
                    )}

                                    {(schedules || []).map((schedule, idx) => {
                                      const selectedLocationId =
                                        schedule.location;
                      const selectedLocationLabel =
                                        (selectedLocationId &&
                                          locationItems.find(
                                            (i) => i.id === selectedLocationId
                                          )?.label) ||
                                        null;

                      return (
                        <div
                          key={idx}
                          className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4"
                        >
                          <div className="flex items-center justify-between">
                                            <Label className="text-sm font-medium text-white/90">
                              Schedule {idx + 1}
                            </Label>

                                            {(schedules || []).length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                                className="h-8 w-8 text-rose-300 hover:text-rose-200 hover:bg-rose-500/10"
                                onClick={() => {
                                                  const current =
                                                    form.getValues(
                                                      "schedules"
                                                    ) || [];
                                  form.setValue(
                                    "schedules",
                                                    current.filter(
                                                      (_, i) => i !== idx
                                                    ),
                                    { shouldValidate: true }
                                  );
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                              <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                                                Day
                                              </Label>
                              <Select
                                                value={String(
                                                  schedule.dayOfWeek ?? 1
                                                )}
                                onValueChange={(v) => {
                                                  const current =
                                                    form.getValues(
                                                      "schedules"
                                                    ) || [];
                                  current[idx] = {
                                    ...current[idx],
                                    dayOfWeek: Number(v),
                                  };
                                                  form.setValue(
                                                    "schedules",
                                                    current,
                                                    {
                                                      shouldValidate:
                                                        includeSchedule,
                                                    }
                                                  );
                                                }}
                                              >
                                                <SelectTrigger className="border border-white/10 bg-white/5 text-white hover:bg-white/10 focus:ring-1 focus:ring-brand">
                                  <SelectValue placeholder="Select day" />
                                </SelectTrigger>
                                                <SelectContent
                                                  className={
                                                    premiumSelectContent
                                                  }
                                                >
                                  {DOW.map((d) => (
                                    <SelectItem
                                      key={d.value}
                                      value={d.value}
                                                      className={
                                                        premiumMenuItem
                                                      }
                                    >
                                      {d.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                                              {form.formState.errors
                                                ?.schedules?.[idx]
                                                ?.dayOfWeek ? (
                                                <p className="text-xs text-rose-300">
                                  {String(
                                                    form.formState.errors
                                                      .schedules[idx]?.dayOfWeek
                                                      ?.message
                                  )}
                                </p>
                              ) : null}
                            </div>

                            <div className="space-y-2">
                                              <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                                                Location (Class Group)
                                              </Label>
                              <Combobox
                                placeholder="Select class group for location"
                                                valueLabel={
                                                  selectedLocationLabel
                                                }
                                open={locationOpenIndex === idx}
                                onOpenChange={(v) =>
                                                  setLocationOpenIndex(
                                                    v ? idx : null
                                                  )
                                }
                                query={locationQuery}
                                setQuery={setLocationQuery}
                                items={locationItems}
                                                isLoading={
                                                  locationGroupsQ.isLoading
                                                }
                                emptyText="No class groups found."
                                onSelect={(id) => {
                                                  const current =
                                                    form.getValues(
                                                      "schedules"
                                                    ) || [];
                                  current[idx] = {
                                    ...current[idx],
                                    location: id,
                                  };
                                                  form.setValue(
                                                    "schedules",
                                                    current,
                                                    {
                                                      shouldValidate:
                                                        includeSchedule,
                                                    }
                                                  );
                                  setLocationOpenIndex(null);
                                }}
                              />
                            </div>

                            <div className="space-y-2">
                                              <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                                                Start time
                                              </Label>
                              <Input
                                type="time"
                                                className="border border-white/10 bg-white/5 text-white focus:border-brand focus:ring-1 focus:ring-brand"
                                value={schedule.startTime || ""}
                                onChange={(e) => {
                                                  const current =
                                                    form.getValues(
                                                      "schedules"
                                                    ) || [];
                                  current[idx] = {
                                    ...current[idx],
                                    startTime: e.target.value,
                                  };
                                                  form.setValue(
                                                    "schedules",
                                                    current,
                                                    {
                                                      shouldValidate:
                                                        includeSchedule,
                                                    }
                                                  );
                                                }}
                                              />
                            </div>

                            <div className="space-y-2">
                                              <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                                                End time
                                              </Label>
                              <Input
                                type="time"
                                                className="border border-white/10 bg-white/5 text-white focus:border-brand focus:ring-1 focus:ring-brand"
                                value={schedule.endTime || ""}
                                onChange={(e) => {
                                                  const current =
                                                    form.getValues(
                                                      "schedules"
                                                    ) || [];
                                  current[idx] = {
                                    ...current[idx],
                                    endTime: e.target.value,
                                  };
                                                  form.setValue(
                                                    "schedules",
                                                    current,
                                                    {
                                                      shouldValidate:
                                                        includeSchedule,
                                                    }
                                                  );
                                                }}
                                              />
                                              {form.formState.errors
                                                ?.schedules?.[idx]?.endTime ? (
                                                <p className="text-xs text-rose-300">
                                  {String(
                                                    form.formState.errors
                                                      .schedules[idx]?.endTime
                                                      ?.message
                                  )}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <Button
                      type="button"
                      variant="outline"
                                      className="w-full border-dashed border-white/20 bg-transparent hover:bg-white/5 hover:border-white/30"
                      onClick={() => {
                                        const current =
                                          form.getValues("schedules") || [];
                        form.setValue(
                          "schedules",
                          [
                            ...current,
                            {
                              dayOfWeek: 1,
                              startTime: "",
                              endTime: "",
                              location: undefined,
                            },
                          ],
                          { shouldValidate: false }
                        );
                                        if (
                                          !form.getValues("includeSchedule")
                                        ) {
                                          form.setValue(
                                            "includeSchedule",
                                            true
                                          );
                        }
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Another Schedule
                    </Button>
                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          </section>
                        )}

                        {currentStep === 3 && (
                          <section className="space-y-6">
                            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                              Notes & Confirm
                            </h2>

                            <div className="space-y-2">
                              <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                                Notes (optional)
                              </Label>
                              <Textarea
                                className="min-h-[110px] border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                                {...form.register("notes")}
                              />
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                                Review
                              </p>

                              <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-1">
                                  <p className="text-xs text-white/50">
                                    Academic period
                                  </p>
                                  <p className="text-sm text-white/85">
                                    {periodLabel(
                                      form.getValues("academicPeriodId")
                                    )}
                                  </p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-xs text-white/50">
                                    Workload
                                  </p>
                                  <p className="text-sm text-white/85">
                                    {form.getValues("workloadHours") ?? 0}{" "}
                                    hrs/week
                      </p>
                    </div>
                                <div className="space-y-1">
                                  <p className="text-xs text-white/50">
                                    Subject
                                  </p>
                                  <p className="text-sm text-white/85">
                                    {selectedSubjectLabel ?? "—"}
                                  </p>
                  </div>
                                <div className="space-y-1">
                                  <p className="text-xs text-white/50">
                                    Class group
                                  </p>
                                  <p className="text-sm text-white/85">
                                    {selectedClassLabel ?? "—"}
                                  </p>
                                </div>
                              </div>

                              <div className="pt-2 border-t border-white/10">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs text-white/50">
                                    Schedules
                                  </p>
                                  <p className="text-xs text-white/75">
                                    {includeSchedule && schedules.length > 0
                                      ? `${schedules.length} item(s)`
                                      : "Not included"}
                                  </p>
                                </div>
                              </div>
            </div>

            {warnings.length ? (
              <Callout tone="info" title="Warnings">
                <ul className="list-disc space-y-1 pl-5">
                  {warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </Callout>
            ) : null}
                          </section>
          )}
                      </motion.div>
                    </AnimatePresence>

                    {/* Footer nav (like CreateStudentModal) */}
                    <div className="flex items-center justify-between pt-6 border-t border-white/10">
            <Button
              type="button"
              variant="outline"
                        onClick={() => {
                          if (isFirstStep) onOpenChange(false);
                          else handlePrevious();
                        }}
              disabled={isPending}
                        className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
                        <ChevronLeft className="h-4 w-4" />
                        {isFirstStep ? "Cancel" : "Previous"}
            </Button>

                      <div className="flex gap-2">
                        {!isLastStep ? (
                          <Button
                            type="button"
                            onClick={handleNext}
                            disabled={isPending}
                            className="gap-2 bg-brand text-black hover:opacity-90"
                          >
                            Next
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        ) : (
            <Button
              type="button"
              onClick={form.handleSubmit(onSubmit)}
              disabled={isPending}
                            className="gap-2 bg-brand text-black hover:opacity-90"
                          >
                            {isPending ? (
                              "Creating…"
                            ) : (
                              <>
                                <Check className="h-4 w-4" />
                                Create Assignment
                              </>
                            )}
            </Button>
                        )}
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
