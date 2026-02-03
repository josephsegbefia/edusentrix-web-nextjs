// src/components/admin/teachers/detail/EditTeacherAssignmentModal.tsx
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
import {
  useUpdateTeacherAssignment,
  type TeacherAssignmentDTO,
  type UpdateTeacherAssignmentInput,
} from "@/hooks/admin/useTeacherAssignments";
import { useTeacherWorkload } from "@/hooks/admin/useTeacherWorkload";
import { premiumSelectContent, premiumMenuItem } from "@/components/ui/premium";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";

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
  status: z.enum(["active", "inactive"]),
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

function Callout({
  tone,
  title,
  children,
}: {
  tone: "warning" | "info" | "success";
  title: string;
  children?: React.ReactNode;
}) {
  const Icon = tone === "warning" ? AlertTriangle : tone === "success" ? Check : Info;
  const colorClass = tone === "warning"
    ? "border-amber-400/20 bg-amber-500/10 text-amber-100"
    : tone === "success"
    ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
    : "border-sky-400/20 bg-sky-500/10 text-sky-100";
  return (
    <div className={cn("rounded-2xl border p-4 backdrop-blur", colorClass)}>
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
  label: string;
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
      {label && <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">{label}</Label>}
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full justify-between border-white/10 bg-white/5 hover:bg-white/8"
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
            "w-[var(--radix-popover-trigger-width)] p-1 max-h-[400px]"
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

export function EditTeacherAssignmentModal({
  open,
  onOpenChange,
  teacher,
  assignment,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  teacher: { id: string; fullName: string };
  assignment: TeacherAssignmentDTO;
}) {
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const { data: periodsRes, isLoading: periodsLoading } = useAcademicPeriods();
  const periods = periodsRes?.periods ?? [];

  // Extract existing schedules if any
  const existingSchedules = React.useMemo(() => {
    // The assignment may have schedule (single) or schedules (array)
    if (assignment.schedule && assignment.schedule.dayOfWeek !== null) {
      return [{
        dayOfWeek: assignment.schedule.dayOfWeek,
        startTime: assignment.schedule.startTime || "",
        endTime: assignment.schedule.endTime || "",
        location: assignment.schedule.location || undefined,
      }];
    }
    return [];
  }, [assignment.schedule]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      academicPeriodId: assignment.academicPeriodId || "",
      subjectId: assignment.subject?.id || "",
      classGroupId: assignment.classGroup?.id || "",
      workloadHours: assignment.workloadHours || 0,
      notes: assignment.notes || "",
      includeSchedule: existingSchedules.length > 0,
      schedules: existingSchedules,
      status: assignment.status,
    },
  });

  // Reset form when assignment changes
  React.useEffect(() => {
    if (open) {
      form.reset({
        academicPeriodId: assignment.academicPeriodId || "",
        subjectId: assignment.subject?.id || "",
        classGroupId: assignment.classGroup?.id || "",
        workloadHours: assignment.workloadHours || 0,
        notes: assignment.notes || "",
        includeSchedule: existingSchedules.length > 0,
        schedules: existingSchedules,
        status: assignment.status,
      });
      setSelectedSubjectLabel(assignment.subject?.name || null);
      setSelectedClassLabel(assignment.classGroup?.label || assignment.classGroup?.name || null);
      setResult(null);
      setWarnings([]);
      setConflict(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, assignment.id]);

  const { mutateAsync, isPending } = useUpdateTeacherAssignment(teacher.id);
  const academicPeriodId = form.watch("academicPeriodId");
  const { data: workloadData } = useTeacherWorkload(teacher.id, academicPeriodId || undefined);
  const workload = workloadData?.data;

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

  const [selectedSubjectLabel, setSelectedSubjectLabel] = React.useState<string | null>(
    assignment.subject?.name || null
  );
  const [selectedClassLabel, setSelectedClassLabel] = React.useState<string | null>(
    assignment.classGroup?.label || assignment.classGroup?.name || null
  );

  // Location combobox state
  const [locationOpenIndex, setLocationOpenIndex] = React.useState<number | null>(null);
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
    schedule?: {
      dayOfWeek?: number;
      startTime?: string;
      endTime?: string;
    };
  } | null>(null);
  const [result, setResult] = React.useState<{ id: string } | null>(null);

  async function onSubmit(values: FormValues) {
    setWarnings([]);
    setConflict(null);

    // Check workload if class group is being changed
    if (workload && values.classGroupId !== assignment.classGroup?.id) {
      // If changing to a different class, check if it would exceed capacity
      // Note: We're replacing one class with another, so class count stays the same
      // But we should still check if the new class would push over student limits
      const wouldExceedStudents = workload.capacity.maxStudents && workload.current.students > workload.capacity.maxStudents;

      if (wouldExceedStudents) {
        const decision = await confirm({
          title: "Workload Warning",
          description: `This change may affect the teacher's student capacity. Current students: ${workload.current.students}. Max capacity: ${workload.capacity.maxStudents}. Do you want to proceed anyway?`,
          confirmLabel: "Proceed",
          cancelLabel: "Review Changes",
          intent: "warning",
        });
        if (decision !== "confirm") {
          return;
        }
      }
    }

    const payload: UpdateTeacherAssignmentInput = {};

    // Only include changed fields
    if (values.academicPeriodId !== assignment.academicPeriodId) {
      payload.academicPeriodId = values.academicPeriodId;
    }
    if (values.subjectId !== assignment.subject?.id) {
      payload.subjectId = values.subjectId;
    }
    if (values.classGroupId !== assignment.classGroup?.id) {
      payload.classGroupId = values.classGroupId;
    }
    if (values.workloadHours !== assignment.workloadHours) {
      payload.workloadHours = values.workloadHours;
    }
    if ((values.notes || "") !== (assignment.notes || "")) {
      payload.notes = values.notes || null;
    }
    if (values.status !== assignment.status) {
      payload.status = values.status;
    }

    // Handle schedules
    if (values.includeSchedule && values.schedules && values.schedules.length > 0) {
      payload.schedules = values.schedules;
    } else if (!values.includeSchedule && existingSchedules.length > 0) {
      // Clear schedules
      payload.schedules = null;
    }

    // If no changes, just close
    if (Object.keys(payload).length === 0) {
      onOpenChange(false);
      return;
    }

    try {
      const res = await mutateAsync({ assignmentId: assignment.id, payload });
      setWarnings(res.warnings ?? []);
      setResult({ id: res.data.id });

      toast.success("Assignment updated", {
        description: `${selectedSubjectLabel || "Assignment"} has been updated.`,
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
      toast.error(error?.message || "Failed to update assignment");
    }
  }

  const periodLabel = (pId: string) => {
    const p = periods.find((x) => x._id === pId);
    return p ? `${p.yearLabel} • ${p.term}` : "—";
  };

  const includeSchedule = form.watch("includeSchedule");

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

  // match CreateStudentModal behavior: if closed, render nothing (parent controls open)
  if (!open) return null;

  return (
    <>
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
                  <h1 className="text-lg font-semibold">Edit Assignment</h1>
                  <p className="text-sm text-white/60">
                    Update assignment for{" "}
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
            {/* conflict banner */}
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
                      • {conflict.schedule.startTime}-{conflict.schedule.endTime}
                    </div>
                  ) : null}
                  <p className="text-white/70">
                    Adjust the day/time or remove schedule from this assignment.
                  </p>
                </div>
              </Callout>
            ) : null}

            {/* success state */}
            {result ? (
              <div className="space-y-4">
                <Callout tone="success" title="Assignment updated">
                  <p className="text-sm text-white/80">
                    {periodLabel(form.getValues("academicPeriodId"))} •{" "}
                    {selectedSubjectLabel ?? "—"} • {selectedClassLabel ?? "—"}
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
                </Callout>

                <div className="flex items-center justify-end pt-2">
                  <Button
                    variant="outline"
                    className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                    onClick={() => onOpenChange(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            ) : (
              <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Academic period */}
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
                      <SelectTrigger className="border border-white/10 bg-white/5 text-white hover:bg-white/8">
                        <SelectValue
                          placeholder={
                            periodsLoading ? "Loading…" : "Select academic period"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className={premiumSelectContent}>
                        {periods.map((p) => (
                          <SelectItem
                            key={p._id}
                            value={p._id}
                            className={premiumMenuItem}
                          >
                            <div className="flex items-center gap-2">
                              <span>{p.yearLabel}</span>
                              <span className="text-neutral-500">•</span>
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
                      <p className="text-xs text-red-300/80">
                        {form.formState.errors.academicPeriodId.message}
                      </p>
                    ) : null}
                  </div>

                  {/* Status */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Status</Label>
                    <Select
                      value={form.watch("status")}
                      onValueChange={(v) =>
                        form.setValue("status", v as "active" | "inactive", {
                          shouldValidate: true,
                        })
                      }
                    >
                      <SelectTrigger className="border border-white/10 bg-white/5 text-white hover:bg-white/8">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent className={premiumSelectContent}>
                        <SelectItem value="active" className={premiumMenuItem}>
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-400" />
                            Active
                          </div>
                        </SelectItem>
                        <SelectItem value="inactive" className={premiumMenuItem}>
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-neutral-400" />
                            Inactive
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {/* Workload hours */}
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
                  {/* Subject */}
                  <Combobox
                    label="Subject"
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
                      form.setValue("subjectId", id, { shouldValidate: true });
                      setSelectedSubjectLabel(label);
                    }}
                  />
                  {form.formState.errors.subjectId ? (
                    <p className="text-xs text-red-300/80 -mt-2">
                      {form.formState.errors.subjectId.message}
                    </p>
                  ) : null}

                  {/* Class group */}
                  <Combobox
                    label="Class Group"
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
                      form.setValue("classGroupId", id, { shouldValidate: true });
                      setSelectedClassLabel(label);
                    }}
                  />
                  {form.formState.errors.classGroupId ? (
                    <p className="text-xs text-red-300/80 -mt-2">
                      {form.formState.errors.classGroupId.message}
                    </p>
                  ) : null}
                </div>

                <Accordion
                  type="single"
                  collapsible
                  className="rounded-2xl border border-white/10 bg-white/5"
                  defaultValue={existingSchedules.length > 0 ? "schedule" : undefined}
                  onValueChange={(v) =>
                    form.setValue("includeSchedule", v === "schedule")
                  }
                >
                  <AccordionItem value="schedule" className="border-none">
                    <AccordionTrigger className="px-4 py-3 text-sm">
                      Schedules {existingSchedules.length > 0 ? `(${existingSchedules.length} existing)` : "(optional)"}
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-4">
                        {(!form.watch("schedules") || form.watch("schedules")?.length === 0) && (
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full border-dashed border-white/20 hover:border-white/30"
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
                              if (!form.getValues("includeSchedule")) {
                                form.setValue("includeSchedule", true);
                              }
                            }}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add First Schedule
                          </Button>
                        )}
                        {(form.watch("schedules") || []).map((schedule, idx) => {
                          const selectedLocationId = schedule.location;
                          const selectedLocationLabel =
                            selectedLocationId &&
                            locationItems.find((i) => i.id === selectedLocationId)
                              ?.label || null;
                          return (
                            <div
                              key={idx}
                              className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4"
                            >
                              <div className="flex items-center justify-between">
                                <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                                  Schedule {idx + 1}
                                </Label>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-red-300 hover:text-red-200 hover:bg-red-500/10"
                                  onClick={() => {
                                    const current = form.getValues("schedules") || [];
                                    form.setValue(
                                      "schedules",
                                      current.filter((_, i) => i !== idx),
                                      { shouldValidate: true }
                                    );
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>

                              <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                  <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Day</Label>
                                  <Select
                                    value={String(schedule.dayOfWeek ?? 1)}
                                    onValueChange={(v) => {
                                      const current = form.getValues("schedules") || [];
                                      current[idx] = {
                                        ...current[idx],
                                        dayOfWeek: Number(v),
                                      };
                                      form.setValue("schedules", current, {
                                        shouldValidate: includeSchedule,
                                      });
                                    }}
                                  >
                                    <SelectTrigger className="border border-white/10 bg-white/5 text-white hover:bg-white/8">
                                      <SelectValue placeholder="Select day" />
                                    </SelectTrigger>
                                    <SelectContent className={premiumSelectContent}>
                                      {DOW.map((d) => (
                                        <SelectItem
                                          key={d.value}
                                          value={d.value}
                                          className={premiumMenuItem}
                                        >
                                          {d.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {form.formState.errors?.schedules?.[idx]?.dayOfWeek ? (
                                    <p className="text-xs text-red-300/80">
                                      {String(
                                        form.formState.errors.schedules[idx]
                                          ?.dayOfWeek?.message
                                      )}
                                    </p>
                                  ) : null}
                                </div>

                                <div className="space-y-2">
                                  <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Location (Class Group)</Label>
                                  <Combobox
                                    label=""
                                    placeholder="Select class group for location"
                                    valueLabel={selectedLocationLabel || null}
                                    open={locationOpenIndex === idx}
                                    onOpenChange={(v) =>
                                      setLocationOpenIndex(v ? idx : null)
                                    }
                                    query={locationQuery}
                                    setQuery={setLocationQuery}
                                    items={locationItems}
                                    isLoading={locationGroupsQ.isLoading}
                                    emptyText="No class groups found."
                                    onSelect={(id) => {
                                      const current = form.getValues("schedules") || [];
                                      current[idx] = {
                                        ...current[idx],
                                        location: id,
                                      };
                                      form.setValue("schedules", current, {
                                        shouldValidate: includeSchedule,
                                      });
                                      setLocationOpenIndex(null);
                                    }}
                                  />
                                  {form.formState.errors?.schedules?.[idx]?.location ? (
                                    <p className="text-xs text-red-300/80">
                                      {String(
                                        form.formState.errors.schedules[idx]
                                          ?.location?.message
                                      )}
                                    </p>
                                  ) : null}
                                </div>

                                <div className="space-y-2">
                                  <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Start time</Label>
                                  <Input
                                    type="time"
                                    className="border border-white/10 bg-white/5 text-white focus:border-brand focus:ring-1 focus:ring-brand"
                                    value={schedule.startTime || ""}
                                    onChange={(e) => {
                                      const current = form.getValues("schedules") || [];
                                      current[idx] = {
                                        ...current[idx],
                                        startTime: e.target.value,
                                      };
                                      form.setValue("schedules", current, {
                                        shouldValidate: includeSchedule,
                                      });
                                    }}
                                  />
                                  {form.formState.errors?.schedules?.[idx]?.startTime ? (
                                    <p className="text-xs text-red-300/80">
                                      {String(
                                        form.formState.errors.schedules[idx]
                                          ?.startTime?.message
                                      )}
                                    </p>
                                  ) : null}
                                </div>

                                <div className="space-y-2">
                                  <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">End time</Label>
                                  <Input
                                    type="time"
                                    className="border border-white/10 bg-white/5 text-white focus:border-brand focus:ring-1 focus:ring-brand"
                                    value={schedule.endTime || ""}
                                    onChange={(e) => {
                                      const current = form.getValues("schedules") || [];
                                      current[idx] = {
                                        ...current[idx],
                                        endTime: e.target.value,
                                      };
                                      form.setValue("schedules", current, {
                                        shouldValidate: includeSchedule,
                                      });
                                    }}
                                  />
                                  {form.formState.errors?.schedules?.[idx]?.endTime ? (
                                    <p className="text-xs text-red-300/80">
                                      {String(
                                        form.formState.errors.schedules[idx]
                                          ?.endTime?.message
                                      )}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {(form.watch("schedules") || []).length > 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full border-dashed border-white/20 hover:border-white/30"
                            onClick={() => {
                              const current = form.getValues("schedules") || [];
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
                            }}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Another Schedule
                          </Button>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Notes (optional)</Label>
                  <Textarea
                    className="min-h-[90px] border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                    {...form.register("notes")}
                  />
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
              </form>
            )}

            {!result && (
              <div className="flex items-center justify-between pt-6 border-t border-white/10">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isPending}
                  className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10"
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  onClick={form.handleSubmit(onSubmit)}
                  disabled={isPending}
                  className="gap-2 bg-brand text-black hover:opacity-90"
                >
                  {isPending ? (
                    "Saving…"
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            )}
              </div>
            </div>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>
      {confirmationDialog}
    </>
  );
}
