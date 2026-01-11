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
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
        "rounded-2xl border p-4 backdrop-blur",
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
      <Label className="text-sm">{label}</Label>
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
            "w-[var(--radix-popover-trigger-width)] p-1"
          )}
        >
          <Command shouldFilter={false} className="bg-transparent">
            <CommandInput
              placeholder="Search…"
              value={query}
              onValueChange={setQuery}
              className="border-b border-neutral-800/60 bg-transparent"
            />
            <CommandList>
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
  const periods = periodsRes?.periods ?? [];

  const currentPeriod = React.useMemo(
    () => periods.find((p) => p.isCurrent) || periods[0] || null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [periods.length, periods.find((p) => p.isCurrent)?._id]
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
  });

  // set default academic period when modal opens
  React.useEffect(() => {
    if (!open) return;
    if (!form.getValues("academicPeriodId") && currentPeriod?._id) {
      form.setValue("academicPeriodId", currentPeriod._id, {
        shouldValidate: true,
      });
    }
    // reset UI state each open
    setResult(null);
    setWarnings([]);
    setConflict(null);
    setLocationOpenIndex(null);
    setLocationQuery("");
    if (!open) {
      form.reset({
        academicPeriodId: "",
        subjectId: "",
        classGroupId: "",
        workloadHours: 0,
        notes: "",
        includeSchedule: false,
        schedules: [],
      });
      setSelectedSubjectLabel(null);
      setSelectedClassLabel(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentPeriod?._id]);

  const { mutateAsync, isPending } = useCreateTeacherAssignment(teacher.id);

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
  // Track which schedule index is being edited for location
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

  const maxClasses = teacher.maxClasses;
  const atCapacity =
    typeof maxClasses === "number" &&
    maxClasses >= 0 &&
    currentActiveAssignmentsCount >= maxClasses;

  async function onSubmit(values: FormValues) {
    setWarnings([]);
    setConflict(null);

    const payload = {
      academicPeriodId: values.academicPeriodId,
      subjectId: values.subjectId,
      classGroupId: values.classGroupId,
      workloadHours: values.workloadHours ?? 0,
      notes: values.notes || undefined,
      schedules: values.includeSchedule && values.schedules && values.schedules.length > 0
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

  const periodLabel = (pId: string) => {
    const p = periods.find((x) => x._id === pId);
    return p ? `${p.yearLabel} • ${p.term}` : "—";
  };

  const includeSchedule = form.watch("includeSchedule");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] border border-white/10 bg-linear-to-br from-white/10 to-transparent shadow-2xl shadow-black/30 backdrop-blur flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-xl">Create Assignment</DialogTitle>
          <DialogDescription className="text-sm">
            Assign a subject and class group to{" "}
            <span className="font-medium text-white/90">
              {teacher.fullName}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-1 -mx-1">
          <div className="px-1 space-y-5">
            {/* capacity banner */}
            {atCapacity ? (
          <Callout tone="warning" title="Capacity warning">
            This teacher already has <b>{currentActiveAssignmentsCount}</b>{" "}
            active assignments
            {typeof maxClasses === "number" ? (
              <>
                {" "}
                (limit: <b>{maxClasses}</b>)
              </>
            ) : null}
            . You can still proceed, but consider rebalancing workloads.
          </Callout>
        ) : null}

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
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-emerald-100">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5">
                  <Check className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Assignment created</p>
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
                </div>
              </div>
            </div>

              <DialogFooter className="flex-shrink-0 mt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    form.reset();
                    onOpenChange(false);
                  }}
                >
                  Close
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Academic period */}
              <div className="space-y-2">
                <Label>Academic Period</Label>
                <Select
                  value={form.watch("academicPeriodId")}
                  onValueChange={(v) =>
                    form.setValue("academicPeriodId", v, {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger className="border-white/10 bg-white/5">
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

              {/* Workload hours */}
              <div className="space-y-2">
                <Label>Workload (hours/week)</Label>
                <Input
                  type="number"
                  min={0}
                  max={80}
                  step={1}
                  className="border-white/10 bg-white/5"
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
              onValueChange={(v) =>
                form.setValue("includeSchedule", v === "schedule")
              }
            >
              <AccordionItem value="schedule" className="border-none">
                              <AccordionTrigger className="px-4 py-3 text-sm">
                  Optional schedules (recommended)
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
                            <Label className="text-sm font-medium">
                              Schedule {idx + 1}
                            </Label>
                            {(form.watch("schedules") || []).length > 1 && (
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
                            )}
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Day</Label>
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
                                <SelectTrigger className="border-white/10 bg-white/5">
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
                              <Label>Location (Class Group)</Label>
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
                              <Label>Start time</Label>
                              <Input
                                type="time"
                                className="border-white/10 bg-white/5"
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
                              <Label>End time</Label>
                              <Input
                                type="time"
                                className="border-white/10 bg-white/5"
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
                        if (!form.getValues("includeSchedule")) {
                          form.setValue("includeSchedule", true);
                        }
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Another Schedule
                    </Button>
                  </div>

                  <div className="mt-4 space-y-2 rounded-lg border border-sky-400/20 bg-sky-500/10 p-3">
                    <p className="text-xs font-semibold text-sky-100">
                      Why add schedules?
                    </p>
                    <div className="space-y-1.5 text-xs text-sky-100/80">
                      <p>
                        <span className="font-medium">Multiple Time Slots:</span>{" "}
                        If this teacher teaches the same subject and class group
                        at different times (e.g., Monday 9am and Wednesday 2pm),
                        you can add multiple schedules for the same assignment.
                        This allows one assignment to have multiple time slots.
                      </p>
                      <p>
                        <span className="font-medium">Conflict Detection:</span>{" "}
                        When you specify the day, time, and location for each
                        schedule, the system can automatically detect if this
                        teacher would have overlapping classes. This prevents
                        scheduling conflicts before they happen.
                      </p>
                      <p>
                        <span className="font-medium">Cleaner Timetables:</span>{" "}
                        Assignments with schedules will appear properly
                        organized in timetable views, making it easier to see
                        when and where classes occur. Without schedules,
                        assignments appear as general assignments without
                        specific time slots.
                      </p>
                      <p className="mt-2 text-sky-100/70">
                        <span className="font-medium">Note:</span> Location
                        refers to the class group where the class takes place.
                        You can create assignments without schedules, but adding
                        them now saves time later when building class timetables.
                      </p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                className="min-h-[90px] border-white/10 bg-white/5"
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
          </div>
        </div>

        {!result && (
          <DialogFooter className="flex-shrink-0 gap-2 mt-4 pt-4 border-t border-white/10">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={form.handleSubmit(onSubmit)}
              className="gap-2"
              disabled={isPending}
            >
              {isPending ? "Creating…" : "Create Assignment"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
