/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/modals/BulkCreateInvoiceModal.tsx
"use client";

import * as React from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  BulkCreateInvoiceSchema,
  BulkCreateInvoiceInput,
} from "@/schemas/bulk-invoice";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useFeeStructures } from "@/hooks/admin/useFeeStructures";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Plus,
  Minus,
  Search,
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatMoney, toMajorUnits, toMinorUnits } from "@/lib/fees/money";
import { InstallmentScheduleConfig } from "@/components/admin/fees/InstallmentScheduleConfig";
import { premiumMenuContent, premiumMenuItem } from "@/components/ui/premium";
import { cn } from "@/lib/utils";

type Props = {
  onClose: () => void;
  onSubmit: (payload: BulkCreateInvoiceInput) => Promise<void>;
  isLoading?: boolean;
};

const STEPS = [
  {
    id: 1,
    title: "Period & Students",
    fields: ["academicPeriodId", "studentIds", "dueDate"],
  },
  {
    id: 2,
    title: "Line Items",
    fields: ["lineItems"],
  },
  {
    id: 3,
    title: "Review",
    fields: ["notes", "terms"],
  },
] as const;

export default function BulkCreateInvoiceModal({
  onClose,
  onSubmit,
  isLoading,
}: Props) {
  const [currentStep, setCurrentStep] = React.useState(1);
  const [periods, setPeriods] = React.useState<any[]>([]);
  const [grades, setGrades] = React.useState<any[]>([]);
  const [classGroups, setClassGroups] = React.useState<any[]>([]);
  const [studentSearchQuery, setStudentSearchQuery] = React.useState("");
  const [selectedGradeId, setSelectedGradeId] = React.useState<string>("all");
  const [selectedClassGroupId, setSelectedClassGroupId] =
    React.useState<string>("all");
  const [selectedStudentIds, setSelectedStudentIds] = React.useState<
    Set<string>
  >(new Set());
  const [studentSearchResults, setStudentSearchResults] = React.useState<any[]>(
    []
  );
  const [studentSearchLoading, setStudentSearchLoading] = React.useState(false);

  const debouncedStudentSearch = useDebouncedValue(studentSearchQuery, 350);
  const { data: feeStructuresData } = useFeeStructures({ isActive: true });

  React.useEffect(() => {
    fetch("/api/admin/periods")
      .then((res) => res.json())
      .then((data) => setPeriods(data.periods || []))
      .catch(() => setPeriods([]));

    fetch("/api/admin/grades")
      .then((res) => res.json())
      .then((data) => setGrades(data.grades || []))
      .catch(() => setGrades([]));
  }, []);

  // Fetch class groups when grade is selected
  React.useEffect(() => {
    if (selectedGradeId) {
      fetch(`/api/admin/class-groups?gradeId=${selectedGradeId}`)
        .then((res) => res.json())
        .then((data) => setClassGroups(data.data || []))
        .catch(() => setClassGroups([]));
    } else {
      setClassGroups([]);
      setSelectedClassGroupId("all");
    }
  }, [selectedGradeId]);

  const feeStructures = feeStructuresData?.structures || [];

  // Debounced student search with filters
  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (
        debouncedStudentSearch.trim().length < 1 &&
        selectedGradeId === "all" &&
        selectedClassGroupId === "all"
      ) {
        setStudentSearchResults([]);
        return;
      }
      setStudentSearchLoading(true);
      try {
        const params = new URLSearchParams();
        if (debouncedStudentSearch.trim()) {
          params.append("search", debouncedStudentSearch);
        }
        if (selectedGradeId && selectedGradeId !== "all") {
          params.append("gradeId", selectedGradeId);
        }
        if (selectedClassGroupId && selectedClassGroupId !== "all") {
          params.append("classGroupId", selectedClassGroupId);
        }
        params.append("limit", "100");

        const res = await fetch(`/api/admin/students?${params}`, {
          cache: "no-store",
        });
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
  }, [debouncedStudentSearch, selectedGradeId, selectedClassGroupId]);

  const filteredStudents = studentSearchResults;

  const {
    register,
    handleSubmit,
    control,
    trigger,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<BulkCreateInvoiceInput>({
    resolver: zodResolver(BulkCreateInvoiceSchema),
    defaultValues: {
      academicPeriodId: "",
      studentIds: [],
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

  const academicPeriodId = watch("academicPeriodId");
  const lineItems = watch("lineItems");

  React.useEffect(() => {
    setValue("studentIds", Array.from(selectedStudentIds));
  }, [selectedStudentIds, setValue]);

  const currentStepData = STEPS[currentStep - 1];
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === STEPS.length;

  const totalAmount = lineItems.reduce(
    (sum, item) => sum + (item.amount || 0),
    0
  );
  const totalInvoices = selectedStudentIds.size;

  async function internalSubmit(values: BulkCreateInvoiceInput) {
    try {
      await onSubmit(values);
      onClose();
    } catch (e: unknown) {
      console.error("Bulk invoice creation error:", e);
    }
  }

  async function handleNext() {
    const fieldsToValidate = currentStepData.fields;
    const isValid = await trigger([
      ...fieldsToValidate,
    ] as (keyof BulkCreateInvoiceInput)[]);
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

  const toggleStudent = (studentId: string) => {
    const newSet = new Set(selectedStudentIds);
    if (newSet.has(studentId)) {
      newSet.delete(studentId);
    } else {
      newSet.add(studentId);
    }
    setSelectedStudentIds(newSet);
  };

  const handleSelectAll = () => {
    if (selectedStudentIds.size === filteredStudents.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(filteredStudents.map((s: any) => s.id)));
    }
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
        setValue(
          `lineItems.${index}.amount`,
          toMajorUnits(structure.defaultAmountMinor)
        );
      }
      setValue(
        `lineItems.${index}.allowsInstallments`,
        structure.allowsInstallments
      );
      if (structure.maxInstallments) {
        setValue(
          `lineItems.${index}.numberOfInstallments`,
          structure.maxInstallments
        );
      }
    }
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
          {/* Step 1: Period & Students */}
          {currentStep === 1 && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                Bulk Invoice Details
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                    Academic Period *
                  </Label>
                  <Controller
                    name="academicPeriodId"
                    control={control}
                    render={({ field }) => {
                      const selectedPeriod = periods.find(
                        (p: any) => p._id === field.value
                      );
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
                                {selectedPeriod
                                  ? `${selectedPeriod.yearLabel} • ${selectedPeriod.term}`
                                  : "Select period"}
                              </span>
                              <ChevronDown className="h-4 w-4 opacity-50" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            className={premiumMenuContent}
                            align="start"
                          >
                            {periods.map((period: any) => (
                              <DropdownMenuItem
                                key={period._id}
                                onClick={() => field.onChange(period._id)}
                                className={cn(
                                  premiumMenuItem,
                                  field.value === period._id && "bg-white/10"
                                )}
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span>
                                    {period.yearLabel} • {period.term}
                                  </span>
                                  {field.value === period._id && (
                                    <Check className="h-4 w-4" />
                                  )}
                                </div>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
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
                  <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                    Due Date
                  </Label>
                  <Input
                    type="date"
                    {...register("dueDate")}
                    className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                    Select Students * ({selectedStudentIds.size} selected)
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    className="border-white/10 bg-white/5 text-white hover:bg-white/10 text-xs"
                  >
                    {selectedStudentIds.size === filteredStudents.length
                      ? "Deselect All"
                      : "Select All"}
                  </Button>
                </div>

                {/* Grade and Class Group Filters */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                      Filter by Grade (Optional)
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
                            {selectedGradeId === "all"
                              ? "All grades"
                              : grades.find(
                                  (g: any) => g._id === selectedGradeId
                                )?.name || "All grades"}
                          </span>
                          <ChevronDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        className={premiumMenuContent}
                        align="start"
                      >
                        <DropdownMenuItem
                          onClick={() => setSelectedGradeId("all")}
                          className={cn(
                            premiumMenuItem,
                            selectedGradeId === "all" && "bg-white/10"
                          )}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span>All grades</span>
                            {selectedGradeId === "all" && (
                              <Check className="h-4 w-4" />
                            )}
                          </div>
                        </DropdownMenuItem>
                        {grades.map((grade: any) => (
                          <DropdownMenuItem
                            key={grade._id}
                            onClick={() => setSelectedGradeId(grade._id)}
                            className={cn(
                              premiumMenuItem,
                              selectedGradeId === grade._id && "bg-white/10"
                            )}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span>{grade.name}</span>
                              {selectedGradeId === grade._id && (
                                <Check className="h-4 w-4" />
                              )}
                            </div>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                      Filter by Class Group (Optional)
                    </Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          disabled={
                            selectedGradeId === "all" || !selectedGradeId
                          }
                          className={cn(
                            "w-full justify-between border border-white/10 bg-white/5 text-white",
                            "hover:bg-white/10 hover:border-white/20",
                            (selectedGradeId === "all" || !selectedGradeId) &&
                              "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <span>
                            {selectedGradeId === "all" || !selectedGradeId
                              ? "Select grade first"
                              : selectedClassGroupId === "all"
                              ? "All classes"
                              : classGroups.find(
                                  (cg: any) => cg._id === selectedClassGroupId
                                )?.name || "All classes"}
                          </span>
                          <ChevronDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        className={premiumMenuContent}
                        align="start"
                      >
                        <DropdownMenuItem
                          onClick={() => setSelectedClassGroupId("all")}
                          className={cn(
                            premiumMenuItem,
                            selectedClassGroupId === "all" && "bg-white/10"
                          )}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span>All classes</span>
                            {selectedClassGroupId === "all" && (
                              <Check className="h-4 w-4" />
                            )}
                          </div>
                        </DropdownMenuItem>
                        {classGroups.map((cg: any) => (
                          <DropdownMenuItem
                            key={cg._id}
                            onClick={() => setSelectedClassGroupId(cg._id)}
                            className={cn(
                              premiumMenuItem,
                              selectedClassGroupId === cg._id && "bg-white/10"
                            )}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span>{cg.name}</span>
                              {selectedClassGroupId === cg._id && (
                                <Check className="h-4 w-4" />
                              )}
                            </div>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Student Search */}
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

                {/* Student Results */}
                {studentSearchLoading && (
                  <div className="text-xs text-white/50 py-4 text-center">
                    Searching...
                  </div>
                )}

                {!studentSearchLoading && (
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
                    {filteredStudents.length === 0 ? (
                      <p className="text-xs text-white/50 text-center py-4">
                        {studentSearchQuery.trim() ||
                        selectedGradeId !== "all" ||
                        selectedClassGroupId !== "all"
                          ? "No students found"
                          : "Start typing to search or select filters"}
                      </p>
                    ) : (
                      filteredStudents.map((student: any) => (
                        <label
                          key={student.id}
                          className={`flex items-center gap-3 rounded-md p-2.5 cursor-pointer transition-colors ${
                            selectedStudentIds.has(student.id)
                              ? "bg-brand/20 border border-brand/30"
                              : "hover:bg-white/5"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedStudentIds.has(student.id)}
                            onChange={() => toggleStudent(student.id)}
                            className="h-4 w-4 rounded border-white/20 bg-white/5 accent-brand cursor-pointer"
                          />
                          <div className="flex-1">
                            <span className="text-sm text-white/80">
                              {student.fullName}
                            </span>
                            <div className="flex items-center gap-2 text-xs text-white/50">
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
                        </label>
                      ))
                    )}
                  </div>
                )}
                {errors.studentIds && (
                  <div className="text-xs text-rose-300">
                    {errors.studentIds.message}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Step 2: Line Items - Same as CreateInvoiceModal */}
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
                            const selectedStructure = feeStructures.find(
                              (s) => s._id === field.value
                            );
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
                                  className={premiumMenuContent}
                                  align="start"
                                >
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleFeeStructureSelect(index, "")
                                    }
                                    className={cn(
                                      premiumMenuItem,
                                      !field.value && "bg-white/10"
                                    )}
                                  >
                                    <div className="flex items-center justify-between w-full">
                                      <span>None</span>
                                      {!field.value && (
                                        <Check className="h-4 w-4" />
                                      )}
                                    </div>
                                  </DropdownMenuItem>
                                  {feeStructures.map((structure) => (
                                    <DropdownMenuItem
                                      key={structure._id}
                                      onClick={() =>
                                        handleFeeStructureSelect(
                                          index,
                                          structure._id
                                        )
                                      }
                                      className={cn(
                                        premiumMenuItem,
                                        field.value === structure._id &&
                                          "bg-white/10"
                                      )}
                                    >
                                      <div className="flex items-center justify-between w-full">
                                        <span>
                                          {structure.name} ({structure.code})
                                        </span>
                                        {field.value === structure._id && (
                                          <Check className="h-4 w-4" />
                                        )}
                                      </div>
                                    </DropdownMenuItem>
                                  ))}
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
                                onChange={(e) =>
                                  field.onChange(e.target.checked)
                                }
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

                    {watch(`lineItems.${index}.allowsInstallments`) &&
                      watch(`lineItems.${index}.numberOfInstallments`) &&
                      watch(`lineItems.${index}.numberOfInstallments`)! >=
                        2 && (
                        <InstallmentScheduleConfig
                          control={control}
                          lineItemIndex={index}
                          totalAmount={watch(`lineItems.${index}.amount`) || 0}
                          numberOfInstallments={
                            watch(`lineItems.${index}.numberOfInstallments`) ||
                            2
                          }
                          startDate={watch("dueDate") || undefined}
                        />
                      )}
                  </motion.div>
                ))}
              </div>

              {errors.lineItems && (
                <div className="text-xs text-rose-300">
                  {errors.lineItems.message || "Please fix line item errors"}
                </div>
              )}

              <div className="pt-4 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white/80">
                    Total Amount per Invoice:
                  </span>
                  <span className="text-lg font-bold text-white">
                    {formatMoney(toMinorUnits(totalAmount))}
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* Step 3: Review */}
          {currentStep === 3 && (
            <section className="space-y-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                Review Bulk Invoice Creation
              </h2>

              <div className="space-y-4">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                    Academic Period
                  </p>
                  <p className="text-sm text-white">
                    {
                      periods.find((p: any) => p._id === academicPeriodId)
                        ?.yearLabel
                    }{" "}
                    •{" "}
                    {periods.find((p: any) => p._id === academicPeriodId)?.term}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                    Number of Invoices
                  </p>
                  <p className="text-2xl font-bold text-white">
                    {totalInvoices} invoice{totalInvoices !== 1 ? "s" : ""}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                    Total Amount per Invoice
                  </p>
                  <p className="text-2xl font-bold text-white">
                    {formatMoney(toMinorUnits(totalAmount))}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted mb-2">
                    Selected Students ({selectedStudentIds.size})
                  </p>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {Array.from(selectedStudentIds).map((id) => {
                      const student = filteredStudents.find(
                        (s: any) => s.id === id
                      );
                      return student ? (
                        <div key={id} className="text-xs text-white/80">
                          {student.fullName}
                          {student.admissionNumber &&
                            ` • ${student.admissionNumber}`}
                        </div>
                      ) : null;
                    })}
                  </div>
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
            disabled={isSubmitting || isLoading || totalInvoices === 0}
            className="bg-brand hover:bg-brand/90 text-white"
          >
            <Check className="h-4 w-4 mr-2" />
            Create {totalInvoices} Invoice{totalInvoices !== 1 ? "s" : ""}
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
