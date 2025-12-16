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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
} from "@/components/ui/dialog";
import { formatMoney, toMajorUnits, toMinorUnits } from "@/lib/fees/money";
import { InstallmentScheduleConfig } from "@/components/admin/fees/InstallmentScheduleConfig";
import { premiumMenuContent, premiumMenuItem } from "@/components/ui/premium";
import { cn } from "@/lib/utils";
import { StudentAvatarStatus } from "@/components/admin/students/StudentAvatarStatus";

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
  const [currentPeriod, setCurrentPeriod] = React.useState<any>(null);
  const [pastPeriods, setPastPeriods] = React.useState<any[]>([]);
  const [grades, setGrades] = React.useState<any[]>([]);
  const [classGroups, setClassGroups] = React.useState<any[]>([]);
  const [unifiedSearchQuery, setUnifiedSearchQuery] = React.useState("");
  const [selectedGradeIds, setSelectedGradeIds] = React.useState<Set<string>>(
    new Set()
  );
  const [selectedClassGroupIds, setSelectedClassGroupIds] = React.useState<
    Set<string>
  >(new Set());
  const [selectedStudentIds, setSelectedStudentIds] = React.useState<
    Set<string>
  >(new Set());
  const [classGroupModalOpen, setClassGroupModalOpen] = React.useState(false);
  const [activeClassGroup, setActiveClassGroup] = React.useState<{
    id: string;
    name: string;
    students: any[];
  } | null>(null);
  const [classGroupStudents, setClassGroupStudents] = React.useState<
    Map<string, any[]>
  >(new Map()); // Track students per class group
  const [searchResults, setSearchResults] = React.useState<{
    students: any[];
    grades: any[];
    classGroups: any[];
  }>({
    students: [],
    grades: [],
    classGroups: [],
  });
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [excludeModalOpen, setExcludeModalOpen] = React.useState(false);
  const [excludeModalClassGroupId, setExcludeModalClassGroupId] =
    React.useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(unifiedSearchQuery, 350);
  const { data: feeStructuresData } = useFeeStructures({ isActive: true });

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
        const pastPeriods = sortedPeriods.filter(
          (p: any) => p._id !== currentPeriod?._id
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

    fetch("/api/admin/grades")
      .then((res) => res.json())
      .then((data) => setGrades(data.data || []))
      .catch(() => setGrades([]));
  }, []);

  // Fetch class groups for selected grades
  React.useEffect(() => {
    if (selectedGradeIds.size > 0) {
      const gradeIdsArray = Array.from(selectedGradeIds);
      Promise.all(
        gradeIdsArray.map((gradeId) =>
          fetch(`/api/admin/class-groups?gradeId=${gradeId}`)
            .then((res) => res.json())
            .then((data) => data.data || [])
        )
      )
        .then((results) => {
          const allClassGroups = results.flat();
          // Deduplicate by _id
          const uniqueClassGroups = Array.from(
            new Map(allClassGroups.map((cg: any) => [cg._id, cg])).values()
          );
          setClassGroups(uniqueClassGroups);
        })
        .catch(() => setClassGroups([]));
    } else {
      setClassGroups([]);
    }
  }, [selectedGradeIds]);

  const feeStructures = feeStructuresData?.structures || [];

  // Unified search for students, grades, and class groups
  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (debouncedSearch.trim().length < 1) {
        setSearchResults({ students: [], grades: [], classGroups: [] });
        return;
      }

      setSearchLoading(true);
      try {
        const searchTerm = debouncedSearch.trim().toLowerCase();

        // Search students - search independently, don't filter by selected grades/class groups
        const studentParams = new URLSearchParams();
        studentParams.append("search", debouncedSearch);
        studentParams.append("limit", "50");

        const [studentsRes, gradesRes, classGroupsRes] = await Promise.all([
          fetch(`/api/admin/students?${studentParams}`, {
            cache: "no-store",
          }),
          fetch("/api/admin/grades", { cache: "no-store" }),
          selectedGradeIds.size > 0
            ? Promise.all(
                Array.from(selectedGradeIds).map((gradeId) =>
                  fetch(`/api/admin/class-groups?gradeId=${gradeId}`, {
                    cache: "no-store",
                  })
                )
              )
            : Promise.resolve([]),
        ]);

        const studentsJson = await studentsRes.json();
        const gradesJson = await gradesRes.json();
        const classGroupsData =
          selectedGradeIds.size > 0
            ? await Promise.all(
                (classGroupsRes as Promise<Response>[]).map((res) => res.json())
              )
            : [];

        if (alive) {
          // Filter grades by search term
          const filteredGrades =
            gradesJson.data?.filter((grade: any) =>
              grade.name?.toLowerCase().includes(searchTerm)
            ) || [];

          // Filter class groups by search term
          const allClassGroups = classGroupsData.flatMap(
            (data: any) => data.data || []
          );
          const uniqueClassGroups = Array.from(
            new Map(allClassGroups.map((cg: any) => [cg._id, cg])).values()
          );
          const filteredClassGroups = uniqueClassGroups.filter((cg: any) =>
            cg.name?.toLowerCase().includes(searchTerm)
          );

          setSearchResults({
            students: studentsJson.success ? studentsJson.data || [] : [],
            grades: filteredGrades,
            classGroups: filteredClassGroups,
          });
        }
      } catch {
        if (alive) {
          setSearchResults({ students: [], grades: [], classGroups: [] });
        }
      } finally {
        if (alive) setSearchLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [debouncedSearch, selectedGradeIds, selectedClassGroupIds]);

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

  const toggleGrade = async (gradeId: string) => {
    const newSet = new Set(selectedGradeIds);
    if (newSet.has(gradeId)) {
      newSet.delete(gradeId);
      // Fetch all students from this grade and remove them
      try {
        const res = await fetch(
          `/api/admin/students?gradeId=${gradeId}&limit=500`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (json?.success) {
          const studentsToRemove = new Set(
            json.data?.map((s: any) => s.id) || []
          );
          setSelectedStudentIds((prev) => {
            const updated = new Set(prev);
            studentsToRemove.forEach((id) => updated.delete(id));
            return updated;
          });
        }
      } catch {
        // Ignore errors
      }
    } else {
      newSet.add(gradeId);
    }
    setSelectedGradeIds(newSet);
  };

  const toggleClassGroup = async (classGroupId: string) => {
    const newSet = new Set(selectedClassGroupIds);
    if (newSet.has(classGroupId)) {
      newSet.delete(classGroupId);
      // Fetch all students from this class group and remove them
      try {
        const res = await fetch(
          `/api/admin/students?classGroupId=${classGroupId}&limit=500`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (json?.success) {
          const studentsToRemove = new Set(
            json.data?.map((s: any) => s.id) || []
          );
          setSelectedStudentIds((prev) => {
            const updated = new Set(prev);
            studentsToRemove.forEach((id) => updated.delete(id));
            return updated;
          });
          // Remove from classGroupStudents map
          setClassGroupStudents((prev) => {
            const updated = new Map(prev);
            updated.delete(classGroupId);
            return updated;
          });
        }
      } catch {
        // Ignore errors
      }
    } else {
      newSet.add(classGroupId);
      // Fetch all students from this class group and add them
      try {
        const res = await fetch(
          `/api/admin/students?classGroupId=${classGroupId}&limit=500`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (json?.success) {
          const students = json.data || [];
          setClassGroupStudents((prev) => {
            const updated = new Map(prev);
            updated.set(classGroupId, students);
            return updated;
          });
          setSelectedStudentIds((prev) => {
            const updated = new Set(prev);
            students.forEach((s: any) => updated.add(s.id));
            return updated;
          });
        }
      } catch {
        // Ignore errors
      }
    }
    setSelectedClassGroupIds(newSet);
  };

  // Get all students from selected grades
  React.useEffect(() => {
    if (selectedGradeIds.size === 0) {
      return;
    }

    let alive = true;
    (async () => {
      try {
        const params = new URLSearchParams();
        params.append("limit", "500");

        Array.from(selectedGradeIds).forEach((gradeId) => {
          params.append("gradeId", gradeId);
        });

        const res = await fetch(`/api/admin/students?${params}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (alive && json?.success) {
          // Add all students from selected grades
          setSelectedStudentIds((prev) => {
            const updated = new Set(prev);
            json.data?.forEach((student: any) => {
              updated.add(student.id);
            });
            return updated;
          });
        }
      } catch {
        // Ignore errors
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedGradeIds]);

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
                        className="text-xs text-white/60 hover:text-white h-auto py-1"
                      >
                        Clear
                      </Button>
                    )}
                  </div>

                  <Controller
                    name="academicPeriodId"
                    control={control}
                    render={({ field }) => {
                      const isCurrentPeriodSelected =
                        field.value === currentPeriod?._id;
                      const isPastPeriodSelected =
                        field.value && field.value !== currentPeriod?._id;

                      return (
                        <div className="space-y-3 flex-1">
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
                                className={`w-full rounded-lg border-2 px-4 py-2 h-10 text-sm font-medium transition-all text-left flex items-center justify-between ${
                                  isCurrentPeriodSelected
                                    ? "border-brand bg-brand/20 text-brand shadow-lg shadow-brand/20"
                                    : "border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10"
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <span className="font-semibold block truncate">
                                    {currentPeriod.yearLabel} •{" "}
                                    {currentPeriod.term}
                                  </span>
                                </div>
                                {isCurrentPeriodSelected && (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="w-5 h-5 rounded-full bg-brand text-black flex items-center justify-center flex-shrink-0 ml-2"
                                  >
                                    <Check className="h-3 w-3" />
                                  </motion.div>
                                )}
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
                                      "hover:bg-white/10 hover:border-white/20",
                                      "h-10"
                                    )}
                                  >
                                    <span>
                                      {isPastPeriodSelected
                                        ? pastPeriods
                                            .find((p: any) => p._id === field.value)
                                            ?.yearLabel +
                                          " • " +
                                          pastPeriods
                                            .find((p: any) => p._id === field.value)
                                            ?.term
                                        : currentPeriod
                                        ? "Select past period..."
                                        : "Select period..."}
                                    </span>
                                    <ChevronDown className="h-4 w-4 opacity-50" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  className={premiumMenuContent}
                                  align="start"
                                >
                                  {pastPeriods.map((period: any) => (
                                    <DropdownMenuItem
                                      key={period._id}
                                      onClick={() => field.onChange(period._id)}
                                      className={cn(
                                        premiumMenuItem,
                                        field.value === period._id &&
                                          "bg-white/10"
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
                                      : pastPeriods
                                          .find((p: any) => p._id === field.value)
                                          ?.yearLabel +
                                        " • " +
                                        pastPeriods
                                          .find((p: any) => p._id === field.value)
                                          ?.term}
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

                          {!currentPeriod &&
                            pastPeriods.length === 0 &&
                            periods.length === 0 && (
                              <p className="text-xs text-white/50 py-4 text-center">
                                No academic periods available. Please create
                                periods first.
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
                  <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                    Due Date
                  </Label>
                  <Input
                    type="date"
                    {...register("dueDate")}
                    className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand h-10"
                  />
                </div>
              </div>

              {/* Selected Items Display */}
              {(selectedStudentIds.size > 0 ||
                selectedGradeIds.size > 0 ||
                selectedClassGroupIds.size > 0) && (
                <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-4">
                  <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                    Selected ({selectedStudentIds.size} students,{" "}
                    {selectedGradeIds.size} grades, {selectedClassGroupIds.size}{" "}
                    classes)
                  </Label>

                  {/* Selected Grades */}
                  {selectedGradeIds.size > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-white/60">
                        Grades:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Array.from(selectedGradeIds).map((gradeId) => {
                          const grade = grades.find((g: any) => g._id === gradeId);
                          return grade ? (
                            <motion.div
                              key={gradeId}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="flex items-center gap-2 rounded-md bg-brand/20 border border-brand/30 px-3 py-1.5"
                            >
                              <span className="text-xs font-medium text-brand">
                                {grade.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleGrade(gradeId)}
                                className="text-brand hover:text-brand/80"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </motion.div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}

                  {/* Selected Class Groups */}
                  {selectedClassGroupIds.size > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-white/60">
                        Class Groups:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Array.from(selectedClassGroupIds).map(
                          (classGroupId) => {
                            const classGroup = classGroups.find(
                              (cg: any) => cg._id === classGroupId
                            );
                            const students = classGroupStudents.get(classGroupId) || [];
                            const studentCount = students.length;
                            return classGroup ? (
                              <motion.div
                                key={classGroupId}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex items-center gap-2 rounded-md bg-brand/20 border border-brand/30 px-3 py-1.5 cursor-pointer hover:bg-brand/30 transition-colors"
                                onClick={() => {
                                  if (studentCount > 0) {
                                    setExcludeModalClassGroupId(classGroupId);
                                    setExcludeModalOpen(true);
                                  }
                                }}
                              >
                                <span className="text-xs font-medium text-brand flex-1">
                                  {classGroup.name}
                                </span>
                                {studentCount > 0 && (
                                  <span
                                    className="text-xs text-brand/80 hover:text-brand"
                                    title="Click to exclude students from this class group"
                                  >
                                    {studentCount} student{studentCount !== 1 ? "s" : ""}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleClassGroup(classGroupId);
                                  }}
                                  className="text-brand hover:text-brand/80 ml-1"
                                  title="Remove class group"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </motion.div>
                            ) : null;
                          }
                        )}
                      </div>
                    </div>
                  )}

                  {/* Selected Students Preview */}
                  {selectedStudentIds.size > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-white/60">
                        Students ({selectedStudentIds.size}):
                      </p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {Array.from(selectedStudentIds)
                          .slice(0, 10)
                          .map((studentId) => {
                            const student = searchResults.students.find(
                              (s: any) => s.id === studentId
                            );
                            return student ? (
                              <div
                                key={studentId}
                                className="flex items-center gap-2 rounded-md bg-white/5 px-2 py-1"
                              >
                                <StudentAvatarStatus
                                  fullName={student.fullName}
                                  photoUrl={student.photoUrl}
                                  status={student.status}
                                  size="sm"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-white/80 truncate">
                                    {student.fullName}
                                  </p>
                                  {student.admissionNumber && (
                                    <p className="text-xs text-white/50">
                                      {student.admissionNumber}
                                    </p>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => toggleStudent(studentId)}
                                  className="text-white/60 hover:text-white"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ) : null;
                          })}
                        {selectedStudentIds.size > 10 && (
                          <p className="text-xs text-white/50 text-center py-1">
                            +{selectedStudentIds.size - 10} more students
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Unified Search */}
              <div className="space-y-3">
                <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                  Search Students, Grades & Class Groups *
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40" />
                  <Input
                    type="text"
                    placeholder="Search by student name, admission number, grade name, or class group name..."
                    value={unifiedSearchQuery}
                    onChange={(e) => setUnifiedSearchQuery(e.target.value)}
                    className="pl-10 border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                </div>

                {/* Search Results */}
                {searchLoading && (
                  <div className="text-xs text-white/50 py-4 text-center">
                    Searching...
                  </div>
                )}

                {!searchLoading &&
                  (searchResults.students.length > 0 ||
                    searchResults.grades.length > 0 ||
                    searchResults.classGroups.length > 0) && (
                    <div className="max-h-96 overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-3 space-y-4">
                      {/* Grades Results */}
                      {searchResults.grades.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                            Grades
                          </p>
                          {searchResults.grades.map((grade: any) => (
                            <motion.button
                              key={grade._id}
                              type="button"
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                              onClick={() => toggleGrade(grade._id)}
                              className={`w-full rounded-md p-2.5 text-left transition-colors ${
                                selectedGradeIds.has(grade._id)
                                  ? "bg-brand/20 border border-brand/30"
                                  : "hover:bg-white/5 border border-transparent"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-white/80">
                                  {grade.name}
                                </span>
                                {selectedGradeIds.has(grade._id) && (
                                  <Check className="h-4 w-4 text-brand" />
                                )}
                              </div>
                            </motion.button>
                          ))}
                        </div>
                      )}

                      {/* Class Groups Results */}
                      {searchResults.classGroups.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                            Class Groups
                          </p>
                          {searchResults.classGroups.map((classGroup: any) => (
                            <motion.button
                              key={classGroup._id}
                              type="button"
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                              onClick={() => toggleClassGroup(classGroup._id)}
                              className={`w-full rounded-md p-2.5 text-left transition-colors ${
                                selectedClassGroupIds.has(classGroup._id)
                                  ? "bg-brand/20 border border-brand/30"
                                  : "hover:bg-white/5 border border-transparent"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-white/80">
                                  {classGroup.name}
                                </span>
                                {selectedClassGroupIds.has(classGroup._id) && (
                                  <Check className="h-4 w-4 text-brand" />
                                )}
                              </div>
                            </motion.button>
                          ))}
                        </div>
                      )}

                      {/* Students Results */}
                      {searchResults.students.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                            Students
                          </p>
                          {searchResults.students.map((student: any) => (
                            <motion.button
                              key={student.id}
                              type="button"
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                              onClick={() => toggleStudent(student.id)}
                              className={`w-full rounded-md p-2.5 text-left transition-colors ${
                                selectedStudentIds.has(student.id)
                                  ? "bg-brand/20 border border-brand/30"
                                  : "hover:bg-white/5 border border-transparent"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <StudentAvatarStatus
                                  fullName={student.fullName}
                                  photoUrl={student.photoUrl}
                                  status={student.status}
                                  size="sm"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-white/80 truncate">
                                    {student.fullName}
                                  </p>
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
                                {selectedStudentIds.has(student.id) && (
                                  <Check className="h-4 w-4 text-brand flex-shrink-0" />
                                )}
                              </div>
                            </motion.button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                {!searchLoading &&
                  unifiedSearchQuery.trim().length > 0 &&
                  searchResults.students.length === 0 &&
                  searchResults.grades.length === 0 &&
                  searchResults.classGroups.length === 0 && (
                    <p className="text-xs text-white/50 text-center py-4">
                      No results found
                    </p>
                  )}

                {!searchLoading &&
                  unifiedSearchQuery.trim().length === 0 && (
                    <p className="text-xs text-white/50 text-center py-4">
                      Start typing to search for students, grades, or class groups
                    </p>
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
                    {Array.from(selectedStudentIds)
                      .slice(0, 20)
                      .map((id) => {
                        const student = searchResults.students.find(
                          (s: any) => s.id === id
                        );
                        return student ? (
                          <div
                            key={id}
                            className="flex items-center gap-2 text-xs text-white/80"
                          >
                            <StudentAvatarStatus
                              fullName={student.fullName}
                              photoUrl={student.photoUrl}
                              status={student.status}
                              size="sm"
                            />
                            <span>
                              {student.fullName}
                              {student.admissionNumber &&
                                ` • ${student.admissionNumber}`}
                            </span>
                          </div>
                        ) : (
                          <div key={id} className="text-xs text-white/50">
                            Student ID: {id}
                          </div>
                        );
                      })}
                    {selectedStudentIds.size > 20 && (
                      <p className="text-xs text-white/50 text-center py-1">
                        +{selectedStudentIds.size - 20} more students
                      </p>
                    )}
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

      {/* Exclude Students Modal */}
      <Dialog open={excludeModalOpen} onOpenChange={setExcludeModalOpen}>
        <DialogContent
          overlayClassName="z-[80]"
          className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col bg-card border-white/10 z-[80]"
        >
          <DialogHeader>
            <DialogTitle className="text-white">
              Exclude Students from Class Group
            </DialogTitle>
            <p className="text-sm text-white/60 mt-2">
              Select students to exclude from this class group selection. These
              students will be removed from the invoice creation.
            </p>
          </DialogHeader>
          {excludeModalClassGroupId && (
            <div className="flex-1 overflow-hidden flex flex-col space-y-4">
              <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                {classGroupStudents
                  .get(excludeModalClassGroupId)
                  ?.map((student: any) => {
                    const isSelected = selectedStudentIds.has(student.id);
                    return (
                      <motion.button
                        key={student.id}
                        type="button"
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => toggleStudent(student.id)}
                        className={`w-full rounded-md p-3 text-left transition-colors ${
                          !isSelected
                            ? "bg-rose-500/20 border border-rose-500/30"
                            : "bg-white/5 border border-transparent hover:bg-white/10"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <StudentAvatarStatus
                            fullName={student.fullName}
                            photoUrl={student.photoUrl}
                            status={student.status}
                            size="sm"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white/80 truncate">
                              {student.fullName}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-white/50">
                              {student.admissionNumber && (
                                <span>Adm. No: {student.admissionNumber}</span>
                              )}
                              {student.gradeName && (
                                <span>• {student.gradeName}</span>
                              )}
                            </div>
                          </div>
                          {!isSelected && (
                            <div className="flex items-center gap-2 text-xs text-rose-400">
                              <X className="h-4 w-4" />
                              <span>Excluded</span>
                            </div>
                          )}
                          {isSelected && (
                            <Check className="h-4 w-4 text-brand flex-shrink-0" />
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <p className="text-sm text-white/60">
                  {
                    classGroupStudents
                      .get(excludeModalClassGroupId)
                      ?.filter((s: any) => !selectedStudentIds.has(s.id))
                      .length || 0
                  }{" "}
                  student
                  {(classGroupStudents
                    .get(excludeModalClassGroupId)
                    ?.filter((s: any) => !selectedStudentIds.has(s.id))
                    .length || 0) !== 1
                    ? "s"
                    : ""}{" "}
                  excluded
                </p>
                <Button
                  type="button"
                  onClick={() => setExcludeModalOpen(false)}
                  className="bg-brand hover:bg-brand/90 text-white"
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </form>
  );
}
