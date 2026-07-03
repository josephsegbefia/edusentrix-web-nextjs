// src/components/modals/CreateInvoiceModal.tsx
"use client";

import * as React from "react";
import { useForm, useFieldArray, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CreateInvoiceSchema,
  CreateInvoiceInput,
  InvoiceLineItemInput,
} from "@/schemas/invoice";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useFeeStructures } from "@/hooks/admin/useFeeStructures";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { ChevronLeft, ChevronRight, Check, X, Plus, Minus, Search, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatMoney, toMajorUnits } from "@/lib/fees/money";
import { InstallmentScheduleConfig } from "@/components/admin/fees/InstallmentScheduleConfig";
import { StudentAvatarStatus } from "@/components/admin/students/StudentAvatarStatus";
import { premiumMenuContent, premiumMenuItem } from "@/components/ui/premium";
import { cn } from "@/lib/utils";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";

type Props = {
  onClose: () => void;
  onSubmit: (payload: CreateInvoiceInput) => Promise<void>;
  isLoading?: boolean;
  mode?: "create" | "edit";
  initialValues?: CreateInvoiceInput;
  initialStudent?: any;
  lockStudentAndPeriod?: boolean;
  submitLabel?: string;
};

const STEPS = [
  {
    id: 1,
    title: "Student & Period",
    fields: ["studentId", "academicPeriodId", "dueDate"],
  },
  {
    id: 2,
    title: "Line Items",
    fields: ["lineItems"],
  },
  {
    id: 3,
    title: "Review & Notes",
    fields: ["notes", "terms"],
  },
] as const;

function parseLocalDate(value?: string | null): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatLocalDate(date: Date | null): string | null {
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateOnly(value?: string | Date | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const dateOnly = parseLocalDate(value);
  if (dateOnly) return dateOnly;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function findInstallmentPeriodWarnings(
  items: CreateInvoiceInput["lineItems"],
  periodEndDate: Date | null,
  fallbackStartDate?: string | null
): string[] {
  if (!periodEndDate) return [];
  const periodEndTime = periodEndDate.getTime();

  return items.flatMap((item, itemIndex) => {
    const installmentCount = Number(item.numberOfInstallments || 0);
    if (!item.allowsInstallments || installmentCount < 2) {
      return [];
    }

    const configuredSchedule = Array.isArray(item.installmentSchedule)
      ? item.installmentSchedule
      : [];
    const schedule =
      configuredSchedule.length > 0
        ? configuredSchedule
        : Array.from({ length: installmentCount }, (_, installmentIndex) => {
            const dueDate = parseDateOnly(fallbackStartDate) ?? new Date();
            dueDate.setDate(dueDate.getDate() + installmentIndex * 30);
            return {
              installmentNumber: installmentIndex + 1,
              dueDate: formatLocalDate(dueDate),
            };
          });

    return schedule.flatMap((installment, installmentIndex) => {
      const dueDate = parseDateOnly(installment?.dueDate);
      if (!dueDate || dueDate.getTime() <= periodEndTime) return [];

      const itemName = item.name?.trim() || `Line item ${itemIndex + 1}`;
      return `${itemName}, installment ${installment.installmentNumber || installmentIndex + 1}`;
    });
  });
}

export default function CreateInvoiceModal({
  onClose,
  onSubmit,
  isLoading,
  mode = "create",
  initialValues,
  initialStudent = null,
  lockStudentAndPeriod = false,
  submitLabel,
}: Props) {
  const [currentStep, setCurrentStep] = React.useState(1);
  const [periods, setPeriods] = React.useState<any[]>([]);
  const [currentPeriod, setCurrentPeriod] = React.useState<any>(null);
  const [pastPeriods, setPastPeriods] = React.useState<any[]>([]);
  const [studentSearchQuery, setStudentSearchQuery] = React.useState("");
  const [studentSearchResults, setStudentSearchResults] = React.useState<any[]>([]);
  const [studentSearchLoading, setStudentSearchLoading] = React.useState(false);
  const [selectedStudent, setSelectedStudent] = React.useState<any>(initialStudent);
  const { confirm, confirmationDialog } = useConfirmationDialog();

  const debouncedStudentSearch = useDebouncedValue(studentSearchQuery, 350);
  const { data: feeStructuresData, isLoading: feeStructuresLoading } =
    useFeeStructures({ isActive: true });

  React.useEffect(() => {
    fetch("/api/admin/periods")
      .then((res) => res.json())
      .then((data) => {
        const allPeriods = data.periods || [];

        // Find current period using isCurrent field
        const current = allPeriods.find((p: any) => p.isCurrent === true);

        // Sort periods by startDate (most recent first)
        const sortedPeriods = [...allPeriods].sort((a: any, b: any) =>
          new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
        );

        // If no current period marked, use the most recent one
        const currentPeriod = current || sortedPeriods[0] || null;
        const pastPeriods = sortedPeriods.filter((p: any) =>
          p._id !== currentPeriod?._id
        );

        setCurrentPeriod(currentPeriod);
        setPastPeriods(pastPeriods);
        setPeriods(allPeriods);
      })
      .catch(() => {
        setPeriods([]);
        setCurrentPeriod(null);
        setPastPeriods([]);
      });
  }, []);

  // Debounced student search
  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (debouncedStudentSearch.trim().length < 1) {
        setStudentSearchResults([]);
        return;
      }
      setStudentSearchLoading(true);
      try {
        const res = await fetch(
          `/api/admin/students?search=${encodeURIComponent(debouncedStudentSearch)}&limit=20`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (alive && json?.success) {
          setStudentSearchResults(json.data || []);
        }
      } catch {
      } finally {
        if (alive) setStudentSearchLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [debouncedStudentSearch]);

  const feeStructures = feeStructuresData?.structures || [];

  const {
    register,
    handleSubmit,
    control,
    trigger,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateInvoiceInput>({
    resolver: zodResolver(CreateInvoiceSchema),
    defaultValues: initialValues ?? {
      studentId: "",
      academicPeriodId: "",
      lineItems: [
        {
          name: "",
          amount: 0,
          allowsInstallments: false,
        },
      ],
      dueDate: undefined,
      notes: undefined,
      terms: undefined,
    },
    mode: "onChange",
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lineItems",
  });

  const studentId = watch("studentId");
  const academicPeriodId = watch("academicPeriodId");
  const dueDate = watch("dueDate");
  const lineItems = watch("lineItems");
  const selectedPeriod = React.useMemo(
    () =>
      [currentPeriod, ...pastPeriods].find(
        (period: any) => period?._id === academicPeriodId
      ) || null,
    [academicPeriodId, currentPeriod, pastPeriods]
  );
  const selectedPeriodEndDate = React.useMemo(
    () => parseDateOnly(selectedPeriod?.endDate),
    [selectedPeriod]
  );
  const installmentPeriodWarnings = React.useMemo(
    () =>
      findInstallmentPeriodWarnings(
        lineItems,
        selectedPeriodEndDate,
        dueDate || selectedPeriod?.endDate || null
      ),
    [dueDate, lineItems, selectedPeriod?.endDate, selectedPeriodEndDate]
  );

  const currentStepData = STEPS[currentStep - 1];
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === STEPS.length;

  const totalAmount = lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);

  async function internalSubmit(values: CreateInvoiceInput) {
    try {
      const warnings = findInstallmentPeriodWarnings(
        values.lineItems,
        selectedPeriodEndDate,
        values.dueDate || selectedPeriod?.endDate || null
      );
      if (warnings.length > 0) {
        const decision = await confirm({
          title: "Installment schedule cannot be issued",
          description: `The generated installment schedule would go beyond the selected academic period end date. Review these items before creating the bill: ${warnings.join(", ")}.`,
          confirmLabel: "Review Installments",
          cancelLabel: "Stay Here",
          intent: "warning",
          zIndexClass: "z-[80]",
        });
        if (decision === "confirm") {
          setCurrentStep(2);
        }
        return;
      }
      await onSubmit(values);
      onClose();
    } catch (e: unknown) {
      console.error("Bill creation error:", e);
    }
  }

  async function handleNext() {
    const fieldsToValidate = currentStepData.fields;
    const isValid = await trigger([...fieldsToValidate] as (keyof CreateInvoiceInput)[]);
    if (isValid && currentStep === 2 && installmentPeriodWarnings.length > 0) {
      const decision = await confirm({
        title: "Installment schedule needs attention",
        description: `The generated installment schedule would go beyond the selected academic period end date. Review these items before continuing: ${installmentPeriodWarnings.join(", ")}.`,
        confirmLabel: "Review Installments",
        cancelLabel: "Stay Here",
        intent: "warning",
        zIndexClass: "z-[80]",
      });
      if (decision === "confirm") {
        setCurrentStep(2);
      }
      return;
    }
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
      amount: 0,
      allowsInstallments: false,
    });
  };

  const handleFeeStructureSelect = (index: number, feeStructureId: string) => {
    if (!feeStructureId || feeStructureId === "none") {
      setValue(`lineItems.${index}.feeStructureId`, undefined);
      return;
    }

    const structure = feeStructures.find((s) => s._id === feeStructureId);
    if (structure) {
      setValue(`lineItems.${index}.feeStructureId`, feeStructureId);
      setValue(`lineItems.${index}.name`, structure.name);
      if (structure.defaultAmountMinor) {
        setValue(`lineItems.${index}.amount`, toMajorUnits(structure.defaultAmountMinor));
      }
      setValue(`lineItems.${index}.allowsInstallments`, structure.allowsInstallments);
      if (structure.maxInstallments) {
        setValue(`lineItems.${index}.numberOfInstallments`, structure.maxInstallments);
      }
    }
  };

  const handleStudentSelect = (student: any) => {
    setSelectedStudent(student);
    setValue("studentId", student.id);
    setStudentSearchQuery("");
    setStudentSearchResults([]);
  };

  return (
    <>
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
          {/* Step 1: Student & Period */}
          {currentStep === 1 && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                Bill Details
              </h2>

              {/* Student Selection with Search */}
              <div className="space-y-3">
                <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                  Student *
                </Label>

                {selectedStudent ? (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-brand/30 bg-brand/10 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <StudentAvatarStatus
                          fullName={selectedStudent.fullName}
                          photoUrl={selectedStudent.photoUrl}
                          status={selectedStudent.status}
                          size="md"
                        />
                        <div>
                          <p className="font-semibold text-white">
                            {selectedStudent.fullName}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-white/60">
                            {selectedStudent.admissionNumber && (
                              <span>Adm. No: {selectedStudent.admissionNumber}</span>
                            )}
                            {selectedStudent.gradeName && (
                              <span>• {selectedStudent.gradeName}</span>
                            )}
                            {selectedStudent.classGroupName && (
                              <span>• {selectedStudent.classGroupName}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedStudent(null);
                          setValue("studentId", "");
                        }}
                        className={cn(
                          "text-white/60 hover:text-white",
                          lockStudentAndPeriod && "hidden"
                        )}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40" />
                      <Input
                        type="text"
                        placeholder="Search students by name or admission number..."
                        value={studentSearchQuery}
                        onChange={(e) => setStudentSearchQuery(e.target.value)}
                        className="pl-10 border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                      />
                    </div>

                    {studentSearchLoading && (
                      <div className="text-xs text-white/50 py-4 text-center">
                        Searching...
                      </div>
                    )}

                    {!studentSearchLoading && studentSearchResults.length > 0 && (
                      <div className="max-h-64 overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
                        {studentSearchResults.map((student: any) => (
                          <motion.button
                            key={student.id}
                            type="button"
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => handleStudentSelect(student)}
                            className="w-full rounded-lg border border-white/10 bg-white/5 p-3 text-left transition-all hover:border-white/20 hover:bg-white/10"
                          >
                            <div className="flex items-center gap-3">
                              <StudentAvatarStatus
                                fullName={student.fullName}
                                photoUrl={student.photoUrl}
                                status={student.status}
                                size="sm"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">
                                  {student.fullName}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-white/60">
                                  {student.admissionNumber && (
                                    <span>Adm. No: {student.admissionNumber}</span>
                                  )}
                                  {student.gradeName && (
                                    <span>• {student.gradeName}</span>
                                  )}
                                  {student.classGroupName && (
                                    <span>• {student.classGroupName}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    )}

                    {!studentSearchLoading && studentSearchQuery.trim().length > 0 && studentSearchResults.length === 0 && (
                      <div className="text-xs text-white/50 py-4 text-center">
                        No students found
                      </div>
                    )}
                  </div>
                )}

                {errors.studentId && (
                  <div className="text-xs text-rose-300">
                    {errors.studentId.message}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                    Academic Period *
                  </Label>
                  {watch("academicPeriodId") && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setValue("academicPeriodId", "")}
                      className={cn(
                        "text-xs text-white/60 hover:text-white h-auto py-1",
                        lockStudentAndPeriod && "hidden"
                      )}
                    >
                      Clear
                    </Button>
                  )}
                </div>

                <Controller
                  name="academicPeriodId"
                  control={control}
                  render={({ field }) => {
                    const isCurrentPeriodSelected = field.value === currentPeriod?._id;
                    const isPastPeriodSelected = field.value && field.value !== currentPeriod?._id;
                    const lockedPeriod = periods.find((p: any) => p._id === field.value);

                    if (lockStudentAndPeriod) {
                      return (
                        <div className="rounded-lg border border-brand/30 bg-brand/10 p-3">
                          <p className="text-sm font-semibold text-brand">
                            {lockedPeriod
                              ? `${lockedPeriod.yearLabel} • ${lockedPeriod.term}`
                              : "Selected period"}
                          </p>
                          <p className="mt-1 text-xs text-brand/80">
                            Student and period stay fixed while editing a draft bill.
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-3">
                        {/* Current Period Card - Show only if not a past period is selected */}
                        {currentPeriod && !isPastPeriodSelected && (
                          <div className="space-y-2">
                            <Label className="text-xs font-medium text-white/60">
                              Current Period
                            </Label>
                            <motion.button
                              type="button"
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                              onClick={() => field.onChange(currentPeriod._id)}
                              className={`w-full rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all text-left ${
                                isCurrentPeriodSelected
                                  ? "border-brand bg-brand/20 text-brand shadow-lg shadow-brand/20"
                                  : "border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="font-semibold">
                                    {currentPeriod.yearLabel} • {currentPeriod.term}
                                  </span>
                                  <p className="text-xs text-white/60 mt-1">
                                    {new Date(currentPeriod.startDate).toLocaleDateString()} - {new Date(currentPeriod.endDate).toLocaleDateString()}
                                  </p>
                                </div>
                                {isCurrentPeriodSelected && (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="w-6 h-6 rounded-full bg-brand text-black flex items-center justify-center"
                                  >
                                    <Check className="h-4 w-4" />
                                  </motion.div>
                                )}
                              </div>
                            </motion.button>
                          </div>
                        )}

                        {/* Past Periods Dropdown - Show only if current period is not selected */}
                        {pastPeriods.length > 0 && !isCurrentPeriodSelected && (
                          <div className="space-y-2">
                            <Label className="text-xs font-medium text-white/60">
                              {currentPeriod ? "Past Periods" : "Select Period"}
                            </Label>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full justify-between border border-white/10 bg-white/5 text-white",
                                    "hover:bg-white/10 hover:border-white/20"
                                  )}
                                >
                                  <span>
                                    {isPastPeriodSelected
                                      ? pastPeriods.find((p: any) => p._id === field.value)?.yearLabel + " • " + pastPeriods.find((p: any) => p._id === field.value)?.term
                                      : currentPeriod ? "Select past period..." : "Select period..."}
                                  </span>
                                  <ChevronDown className="h-4 w-4 opacity-50" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className={premiumMenuContent} align="start">
                                {pastPeriods.map((period: any) => (
                                  <DropdownMenuItem
                                    key={period._id}
                                    onClick={() => field.onChange(period._id)}
                                    className={cn(
                                      premiumMenuItem,
                                      field.value === period._id && "bg-white/10"
                                    )}
                                  >
                                    <div className="flex items-center justify-between w-full">
                                      <span>{period.yearLabel} • {period.term}</span>
                                      {field.value === period._id && (
                                        <Check className="h-4 w-4" />
                                      )}
                                    </div>
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}

                        {/* Selected Period Display (when one is selected) */}
                        {(isCurrentPeriodSelected || isPastPeriodSelected) && (
                          <div className="rounded-lg border border-brand/30 bg-brand/10 p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-semibold text-brand">
                                  {isCurrentPeriodSelected
                                    ? `${currentPeriod.yearLabel} • ${currentPeriod.term}`
                                    : pastPeriods.find((p: any) => p._id === field.value)?.yearLabel + " • " + pastPeriods.find((p: any) => p._id === field.value)?.term}
                                </p>
                                {isCurrentPeriodSelected && (
                                  <p className="text-xs text-brand/80 mt-1">
                                    Current Period
                                  </p>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => field.onChange("")}
                                className="h-6 w-6 p-0 text-white/60 hover:text-white"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}

                        {!currentPeriod && pastPeriods.length === 0 && periods.length === 0 && (
                          <p className="text-xs text-white/50 py-4 text-center">
                            No academic periods available. Please create periods first.
                          </p>
                        )}
                      </div>
                    );
                  }}
                />
                {errors.academicPeriodId && (
                  <div className="text-xs text-rose-300">
                    {errors.academicPeriodId.message}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Controller
                  name="dueDate"
                  control={control}
                  render={({ field }) => (
                    <CustomDatePicker
                      label="Due Date"
                      value={parseLocalDate(field.value)}
                      onChange={(date) => field.onChange(formatLocalDate(date))}
                      placeholder="Select due date"
                      className="border-white/10 bg-white/5 text-white"
                      error={errors.dueDate?.message}
                    />
                  )}
                />
              </div>
            </section>
          )}

          {/* Step 2: Line Items */}
          {currentStep === 2 && (
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                  Line Items
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
                        Line Item {index + 1}
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

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                          Fee Structure (Optional)
                        </Label>
                        <Controller
                          name={`lineItems.${index}.feeStructureId`}
                          control={control}
                          render={({ field }) => {
                            const selectedStructure = feeStructures.find((s) => s._id === field.value);
                            return (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "w-full justify-between border border-white/10 bg-white/5 text-white",
                                      "hover:bg-white/10 hover:border-white/20"
                                    )}
                                  >
                                    <span>
                                      {selectedStructure
                                        ? `${selectedStructure.name} (${selectedStructure.code})`
                                        : "Select fee structure"}
                                    </span>
                                    <ChevronDown className="h-4 w-4 opacity-50" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  className={cn(premiumMenuContent, "max-h-72 overflow-y-auto")}
                                  align="start"
                                >
                                  <DropdownMenuItem
                                    onClick={() => handleFeeStructureSelect(index, "")}
                                    className={cn(
                                      premiumMenuItem,
                                      !field.value && "bg-white/10"
                                    )}
                                  >
                                    <div className="flex items-center justify-between w-full">
                                      <span>None</span>
                                      {!field.value && <Check className="h-4 w-4" />}
                                    </div>
                                  </DropdownMenuItem>
                                  {feeStructuresLoading ? (
                                    <DropdownMenuItem disabled className={premiumMenuItem}>
                                      Loading fee structures...
                                    </DropdownMenuItem>
                                  ) : feeStructures.length > 0 ? (
                                    feeStructures.map((structure) => (
                                      <DropdownMenuItem
                                        key={structure._id}
                                        onClick={() => handleFeeStructureSelect(index, structure._id)}
                                        className={cn(
                                          premiumMenuItem,
                                          field.value === structure._id && "bg-white/10"
                                        )}
                                      >
                                        <div className="flex w-full items-center justify-between gap-3">
                                          <span className="truncate">
                                            {structure.name} ({structure.code})
                                          </span>
                                          {field.value === structure._id && (
                                            <Check className="h-4 w-4 shrink-0" />
                                          )}
                                        </div>
                                      </DropdownMenuItem>
                                    ))
                                  ) : (
                                    <DropdownMenuItem disabled className={premiumMenuItem}>
                                      No active fee structures found
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            );
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                          Name *
                        </Label>
                        <Input
                          {...register(`lineItems.${index}.name` as const)}
                          placeholder="e.g., Tuition Fee"
                          className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                        />
                        {errors.lineItems?.[index]?.name && (
                          <div className="text-xs text-rose-300">
                            {errors.lineItems[index]?.name?.message}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                        Description
                      </Label>
                      <Input
                        {...register(`lineItems.${index}.description` as const)}
                        placeholder="Optional description..."
                        className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                          className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                        />
                        {errors.lineItems?.[index]?.amount && (
                          <div className="text-xs text-rose-300">
                            {errors.lineItems[index]?.amount?.message}
                          </div>
                        )}
                      </div>
                      <div className="flex items-end">
                        <Controller
                          name={`lineItems.${index}.allowsInstallments`}
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
                    </div>

                    {watch(`lineItems.${index}.allowsInstallments`) && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-2"
                      >
                        <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                          Number of Installments
                        </Label>
                        <Input
                          type="number"
                          min="2"
                          max="12"
                          {...register(`lineItems.${index}.numberOfInstallments` as const, {
                            valueAsNumber: true,
                          })}
                          placeholder="e.g., 3"
                          className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                        />
                        {watch(`lineItems.${index}.numberOfInstallments`) &&
                          watch(`lineItems.${index}.numberOfInstallments`)! >= 2 && (
                            <InstallmentScheduleConfig
                              control={control}
                              register={register}
                              lineItemIndex={index}
                              totalAmount={watch(`lineItems.${index}.amount`) || 0}
                              numberOfInstallments={watch(`lineItems.${index}.numberOfInstallments`) || 2}
                              startDate={watch("dueDate") || undefined}
                              maxDueDate={selectedPeriodEndDate}
                            />
                          )}
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </div>

              {errors.lineItems && (
                <div className="text-xs text-rose-300">
                  {errors.lineItems.message || "Please fix line item errors"}
                </div>
              )}

              {installmentPeriodWarnings.length > 0 && selectedPeriodEndDate ? (
                <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-4 text-sm text-amber-100">
                  <p className="font-semibold">Installment dates need attention</p>
                  <p className="mt-1 text-xs text-amber-100/80">
                    Installment due dates must fall on or before{" "}
                    {selectedPeriodEndDate.toLocaleDateString()} for the selected academic period.
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
                    {installmentPeriodWarnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="pt-4 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white/80">
                    Total Amount:
                  </span>
                  <span className="text-lg font-bold text-white">
                    GHS {totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* Step 3: Review & Notes */}
          {currentStep === 3 && (
            <section className="space-y-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                Additional Information
              </h2>

              <div className="space-y-4">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                    Student
                  </p>
                  <p className="text-sm text-white">
                    {selectedStudent
                      ? `${selectedStudent.fullName}${selectedStudent.admissionNumber ? ` • ${selectedStudent.admissionNumber}` : ""}`
                      : "Not selected"}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                    Academic Period
                  </p>
                  <p className="text-sm text-white">
                    {periods.find((p: any) => p._id === academicPeriodId)?.yearLabel}{" "}
                    • {periods.find((p: any) => p._id === academicPeriodId)?.term}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                    Total Amount
                  </p>
                  <p className="text-2xl font-bold text-white">
                    GHS {totalAmount.toFixed(2)}
                  </p>
                </div>
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

              <div className="space-y-2">
                <Label
                  htmlFor="terms"
                  className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                >
                  Payment Terms (Optional)
                </Label>
                <Input
                  id="terms"
                  {...register("terms")}
                  placeholder="Payment terms..."
                  className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                />
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
            {submitLabel || (mode === "edit" ? "Save Draft Bill" : "Create Bill")}
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
    {confirmationDialog}
    </>
  );
}
