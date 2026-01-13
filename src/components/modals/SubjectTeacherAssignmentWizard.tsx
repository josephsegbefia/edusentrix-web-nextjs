// src/components/modals/SubjectTeacherAssignmentWizard.tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  Search,
  X,
  AlertCircle,
  UserCheck,
  AlertTriangle,
} from "lucide-react";
import { useSubjects } from "@/hooks/admin/useSubjects";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useBusyToast } from "@/hooks/useBusyToast";
import { motion, AnimatePresence } from "framer-motion";

type SubjectTeacherAssignmentWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  className: string;
  existingSubjectIds: string[];
};

type Step = 1 | 2 | 3;

type SubjectSelection = {
  id: string;
  name: string;
  code: string | null;
  teacherId: string | null;
  teacherName: string | null;
};

type TeacherOption = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  photoUrl: string | null;
};

const STEPS = [
  { id: 1, title: "Select Subjects" },
  { id: 2, title: "Assign Teachers" },
  { id: 3, title: "Review & Confirm" },
] as const;

export function SubjectTeacherAssignmentWizard({
  open,
  onOpenChange,
  classId,
  className,
  existingSubjectIds,
}: SubjectTeacherAssignmentWizardProps) {
  const [step, setStep] = React.useState<Step>(1);
  const [selectedSubjects, setSelectedSubjects] = React.useState<SubjectSelection[]>([]);
  const [teacherSearch, setTeacherSearch] = React.useState("");
  const [activeSubjectIndex, setActiveSubjectIndex] = React.useState(0);

  const queryClient = useQueryClient();
  const busy = useBusyToast();

  const debouncedTeacherSearch = useDebouncedValue(teacherSearch, 300);

  // Reset when modal opens
  React.useEffect(() => {
    if (open) {
      setStep(1);
      setSelectedSubjects([]);
      setTeacherSearch("");
      setActiveSubjectIndex(0);
    }
  }, [open]);

  // Fetch subjects
  const { data: subjectsData, isLoading: subjectsLoading } = useSubjects();
  const allSubjects = subjectsData?.data || [];

  // Fetch teachers for assignment
  const { data: teachersData, isLoading: teachersLoading } = useQuery<{
    success: boolean;
    data: TeacherOption[];
  }>({
    queryKey: ["teachers-for-assignment", debouncedTeacherSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedTeacherSearch) params.set("q", debouncedTeacherSearch);
      params.set("limit", "20");

      const res = await fetch(`/api/admin/teachers/search?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch teachers");
      return res.json();
    },
    enabled: step === 2,
    staleTime: 30_000,
  });

  const teachers = teachersData?.data || [];

  // Assignment mutation
  const assignMutation = useMutation({
    mutationFn: async (assignments: { subjectId: string; teacherId: string }[]) => {
      const results = await Promise.all(
        assignments.map(async (a) => {
          const res = await fetch("/api/admin/subjects/assign-teacher", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              teacherId: a.teacherId,
              subjectId: a.subjectId,
              classGroupId: classId,
            }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "Assignment failed");
          }
          return res.json();
        })
      );
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-subject-teachers"] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
    },
  });

  // Toggle subject selection
  const toggleSubject = (subject: { id: string; name: string; code: string | null }) => {
    setSelectedSubjects((prev) => {
      const exists = prev.find((s) => s.id === subject.id);
      if (exists) {
        return prev.filter((s) => s.id !== subject.id);
      }
      return [
        ...prev,
        { ...subject, teacherId: null, teacherName: null },
      ];
    });
  };

  // Assign teacher to subject
  const assignTeacherToSubject = (
    subjectIndex: number,
    teacher: TeacherOption | null
  ) => {
    setSelectedSubjects((prev) => {
      const updated = [...prev];
      if (updated[subjectIndex]) {
        updated[subjectIndex] = {
          ...updated[subjectIndex],
          teacherId: teacher?.id || null,
          teacherName: teacher?.fullName || null,
        };
      }
      return updated;
    });
  };

  // Navigation
  const canProceedToStep2 = selectedSubjects.length > 0;
  const assignmentsToMake = selectedSubjects.filter((s) => s.teacherId);

  const handleNext = () => {
    if (step === 1 && canProceedToStep2) {
      setStep(2);
      setActiveSubjectIndex(0);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step === 2) setStep(1);
    if (step === 3) setStep(2);
  };

  const handleConfirm = async () => {
    if (assignmentsToMake.length === 0) return;

    const assignments = assignmentsToMake.map((s) => ({
      subjectId: s.id,
      teacherId: s.teacherId!,
    }));

    try {
      await busy.promise(assignMutation.mutateAsync(assignments), {
        loading: `Assigning ${assignments.length} teacher${assignments.length !== 1 ? "s" : ""}...`,
        success: "Teachers assigned successfully!",
        error: (e: Error) => e.message || "Failed to assign teachers",
      });
      onOpenChange(false);
    } catch {
      // Error handled by busy toast
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase() || "?";
  };

  const activeSubject = selectedSubjects[activeSubjectIndex];
  const isFirstStep = step === 1;
  const isLastStep = step === 3;

  // ESC close
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-70 bg-black/60 backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
        >
          {/* Desktop dialog */}
          <div
            className="hidden sm:grid h-full place-items-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              className="w-full max-w-4xl max-h-[90vh] rounded-2xl border border-white/10 bg-card/95 shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/20">
                    <BookOpen className="h-5 w-5 text-brand" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold">Assign Teachers to Subjects</div>
                    <div className="text-xs text-muted">{className}</div>
                  </div>
                </div>
                <button
                  onClick={() => onOpenChange(false)}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto flex-1 min-h-0 space-y-8">
                {/* Step Indicator - Simple dots like CreateStudentModal */}
                <div className="flex items-center justify-between pb-2">
                  <div className="text-sm text-white/70">
                    Step <span className="font-semibold">{step}</span> of {STEPS.length}
                  </div>
                  <div className="flex gap-1">
                    {STEPS.map((_, i) => (
                      <span
                        key={i}
                        className={`h-1.5 w-8 rounded-full transition-all ${
                          i + 1 <= step ? "bg-brand" : "bg-white/20"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Step Content */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6"
                  >
                    {/* Step 1: Select Subjects */}
                    {step === 1 && (
                      <section className="space-y-4">
                        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                          Select Subjects
                        </h2>
                        <p className="text-sm text-white/60">
                          Choose the subjects you want to assign teachers to for this class.
                        </p>

                        {subjectsLoading ? (
                          <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-brand" />
                          </div>
                        ) : allSubjects.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 border border-white/10 bg-white/5 rounded-lg">
                            <AlertCircle className="h-8 w-8 text-white/30" />
                            <p className="mt-2 text-sm text-white/50">No subjects available</p>
                          </div>
                        ) : (
                          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                            {allSubjects.map((subject) => {
                              const isSelected = selectedSubjects.some((s) => s.id === subject.id);
                              const isExisting = existingSubjectIds.includes(subject.id);

                              return (
                                <motion.label
                                  key={subject.id}
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  className={cn(
                                    "relative flex items-center gap-3 rounded-lg border-2 p-3 cursor-pointer transition-all",
                                    isSelected
                                      ? "border-brand bg-brand/20 text-brand shadow-lg shadow-brand/20"
                                      : "border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10"
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleSubject(subject)}
                                    className="sr-only"
                                  />
                                  {isSelected && (
                                    <motion.div
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-brand text-black flex items-center justify-center"
                                    >
                                      <Check className="h-4 w-4" />
                                    </motion.div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{subject.name}</p>
                                    {subject.code && (
                                      <p className="text-xs text-white/50">{subject.code}</p>
                                    )}
                                  </div>
                                  {isExisting && (
                                    <span className="text-[10px] text-emerald-400 shrink-0">Assigned</span>
                                  )}
                                </motion.label>
                              );
                            })}
                          </div>
                        )}

                        {selectedSubjects.length > 0 && (
                          <div className="rounded-lg border border-brand/30 bg-brand/10 p-3 text-sm text-brand">
                            <strong>{selectedSubjects.length}</strong> subject
                            {selectedSubjects.length !== 1 ? "s" : ""} selected
                          </div>
                        )}
                      </section>
                    )}

                    {/* Step 2: Assign Teachers */}
                    {step === 2 && (
                      <section className="space-y-4">
                        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                          Assign Teachers
                        </h2>

                        {/* Subject tabs */}
                        <div className="flex gap-2 overflow-x-auto pb-2">
                          {selectedSubjects.map((subject, idx) => (
                            <motion.button
                              key={subject.id}
                              type="button"
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setActiveSubjectIndex(idx)}
                              className={cn(
                                "flex shrink-0 items-center gap-2 rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all",
                                activeSubjectIndex === idx
                                  ? "border-brand bg-brand/20 text-brand shadow-lg shadow-brand/20"
                                  : "border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:bg-white/10"
                              )}
                            >
                              <span className="truncate max-w-[120px]">{subject.name}</span>
                              {subject.teacherId ? (
                                <Check className="h-4 w-4 text-emerald-400" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-amber-400" />
                              )}
                            </motion.button>
                          ))}
                        </div>

                        {/* Teacher selection for active subject */}
                        {activeSubject && (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="font-medium text-white">{activeSubject.name}</h3>
                                <p className="text-xs text-muted">
                                  Select a teacher for this subject
                                </p>
                              </div>
                              {activeSubject.teacherId && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => assignTeacherToSubject(activeSubjectIndex, null)}
                                  className="gap-1 text-xs text-white/60 hover:text-white"
                                >
                                  <X className="h-3 w-3" />
                                  Clear
                                </Button>
                              )}
                            </div>

                            {/* Search */}
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                              <input
                                type="text"
                                value={teacherSearch}
                                onChange={(e) => setTeacherSearch(e.target.value)}
                                placeholder="Search teachers..."
                                className="h-10 w-full rounded-lg border border-white/10 bg-white/5 pl-10 pr-4 text-sm text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                              />
                            </div>

                            {/* Teacher list */}
                            {teachersLoading ? (
                              <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-brand" />
                              </div>
                            ) : teachers.length === 0 ? (
                              <div className="flex flex-col items-center justify-center py-8 border border-white/10 bg-white/5 rounded-lg">
                                <UserCheck className="h-8 w-8 text-white/30" />
                                <p className="mt-2 text-sm text-white/50">
                                  {teacherSearch ? "No teachers found" : "Start typing to search"}
                                </p>
                              </div>
                            ) : (
                              <div className="max-h-[250px] space-y-2 overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-3">
                                {teachers.map((teacher) => {
                                  const isSelected = activeSubject.teacherId === teacher.id;

                                  return (
                                    <motion.button
                                      key={teacher.id}
                                      type="button"
                                      whileHover={{ scale: 1.01 }}
                                      whileTap={{ scale: 0.99 }}
                                      onClick={() =>
                                        assignTeacherToSubject(activeSubjectIndex, teacher)
                                      }
                                      className={cn(
                                        "relative flex w-full items-center gap-3 rounded-lg border-2 p-3 text-left transition-all",
                                        isSelected
                                          ? "border-brand bg-brand/20 text-brand shadow-lg shadow-brand/20"
                                          : "border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10"
                                      )}
                                    >
                                      {isSelected && (
                                        <motion.div
                                          initial={{ scale: 0 }}
                                          animate={{ scale: 1 }}
                                          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-brand text-black flex items-center justify-center"
                                        >
                                          <Check className="h-4 w-4" />
                                        </motion.div>
                                      )}
                                      <Avatar className="h-10 w-10 border border-white/20">
                                        <AvatarImage
                                          src={teacher.photoUrl || ""}
                                          alt={teacher.fullName}
                                        />
                                        <AvatarFallback className="bg-linear-to-br from-brand/60 to-brand/40 text-xs font-semibold text-white">
                                          {getInitials(teacher.firstName, teacher.lastName)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">
                                          {teacher.fullName}
                                        </p>
                                        {teacher.email && (
                                          <p className="text-xs text-muted truncate">
                                            {teacher.email}
                                          </p>
                                        )}
                                      </div>
                                    </motion.button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Progress summary */}
                        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted">Progress:</span>
                            <span className="font-medium text-white">
                              {selectedSubjects.filter((s) => s.teacherId).length} /{" "}
                              {selectedSubjects.length} assigned
                            </span>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                            <motion.div
                              className="h-full rounded-full bg-brand"
                              initial={{ width: 0 }}
                              animate={{
                                width: `${(selectedSubjects.filter((s) => s.teacherId).length / selectedSubjects.length) * 100}%`,
                              }}
                              transition={{ duration: 0.3 }}
                            />
                          </div>
                        </div>
                      </section>
                    )}

                    {/* Step 3: Review */}
                    {step === 3 && (
                      <section className="space-y-4">
                        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                          Review & Confirm
                        </h2>
                        <p className="text-sm text-white/60">
                          Review the assignments before confirming:
                        </p>

                        <div className="space-y-2 max-h-[300px] overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-3">
                          {selectedSubjects.map((subject) => (
                            <div
                              key={subject.id}
                              className={cn(
                                "flex items-center justify-between rounded-lg border-2 p-4 transition-all",
                                subject.teacherId
                                  ? "border-emerald-500/30 bg-emerald-500/5"
                                  : "border-amber-500/30 bg-amber-500/5"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={cn(
                                    "flex h-10 w-10 items-center justify-center rounded-xl",
                                    subject.teacherId
                                      ? "bg-emerald-500/20 text-emerald-300"
                                      : "bg-amber-500/20 text-amber-300"
                                  )}
                                >
                                  <BookOpen className="h-5 w-5" />
                                </div>
                                <div>
                                  <p className="font-medium text-white">{subject.name}</p>
                                  {subject.code && (
                                    <p className="text-xs text-muted">{subject.code}</p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                {subject.teacherId ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-emerald-300">
                                      {subject.teacherName}
                                    </span>
                                    <Check className="h-4 w-4 text-emerald-400" />
                                  </div>
                                ) : (
                                  <span className="text-sm text-amber-300">No teacher assigned</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Summary */}
                        <div className="rounded-lg border border-brand/30 bg-brand/10 p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/20">
                              <UserCheck className="h-5 w-5 text-brand" />
                            </div>
                            <div>
                              <p className="font-medium text-brand">
                                {assignmentsToMake.length} assignment
                                {assignmentsToMake.length !== 1 ? "s" : ""} will be created
                              </p>
                              <p className="text-xs text-brand/70">
                                Subjects without teachers will be skipped
                              </p>
                            </div>
                          </div>
                        </div>
                      </section>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Footer Navigation */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={isFirstStep ? () => onOpenChange(false) : handleBack}
                  disabled={assignMutation.isPending}
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
                      disabled={step === 1 ? !canProceedToStep2 : false}
                      className="gap-2 bg-brand text-black hover:opacity-90"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={handleConfirm}
                      disabled={assignmentsToMake.length === 0 || assignMutation.isPending}
                      className="gap-2 bg-brand text-black hover:opacity-90"
                    >
                      {assignMutation.isPending ? (
                        "Assigning…"
                      ) : (
                        <>
                          <Check className="h-4 w-4" />
                          Confirm Assignments
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Mobile bottom sheet */}
          <div
            className="sm:hidden fixed inset-x-0 bottom-0"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 250, damping: 28 }}
              className="rounded-t-2xl border border-white/10 bg-card/95 shadow-2xl max-h-[90vh] flex flex-col"
            >
              {/* Mobile drag handle */}
              <div className="py-2 shrink-0">
                <div className="mx-auto h-1.5 w-12 rounded-full bg-white/20" />
              </div>

              {/* Mobile Header */}
              <div className="px-5 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/20">
                    <BookOpen className="h-4 w-4 text-brand" />
                  </div>
                  <div>
                    <div className="text-base font-semibold">Assign Teachers</div>
                    <div className="text-xs text-muted">{className}</div>
                  </div>
                </div>

                {/* Mobile Step Indicator */}
                <div className="flex items-center justify-between pt-4">
                  <div className="text-xs text-white/70">
                    Step <span className="font-semibold">{step}</span> of {STEPS.length}
                  </div>
                  <div className="flex gap-1">
                    {STEPS.map((_, i) => (
                      <span
                        key={i}
                        className={`h-1 w-6 rounded-full transition-all ${
                          i + 1 <= step ? "bg-brand" : "bg-white/20"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Mobile Content */}
              <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    {/* Step 1: Select Subjects (Mobile) */}
                    {step === 1 && (
                      <section className="space-y-3">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                          Select Subjects
                        </h2>

                        {subjectsLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-5 w-5 animate-spin text-brand" />
                          </div>
                        ) : allSubjects.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-8 border border-white/10 bg-white/5 rounded-lg">
                            <AlertCircle className="h-6 w-6 text-white/30" />
                            <p className="mt-2 text-xs text-white/50">No subjects available</p>
                          </div>
                        ) : (
                          <div className="grid gap-2">
                            {allSubjects.map((subject) => {
                              const isSelected = selectedSubjects.some((s) => s.id === subject.id);

                              return (
                                <label
                                  key={subject.id}
                                  className={cn(
                                    "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all",
                                    isSelected
                                      ? "border-brand bg-brand/20 text-brand"
                                      : "border-white/10 bg-white/5 text-white/80"
                                  )}
                                >
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleSubject(subject)}
                                    className="h-4 w-4 border-white/30 data-[state=checked]:bg-brand data-[state=checked]:border-brand"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{subject.name}</p>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        )}

                        {selectedSubjects.length > 0 && (
                          <div className="rounded-lg border border-brand/30 bg-brand/10 p-2 text-xs text-brand text-center">
                            <strong>{selectedSubjects.length}</strong> selected
                          </div>
                        )}
                      </section>
                    )}

                    {/* Step 2: Assign Teachers (Mobile) */}
                    {step === 2 && activeSubject && (
                      <section className="space-y-3">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                          Assign Teacher
                        </h2>

                        {/* Subject tabs (scrollable) */}
                        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                          {selectedSubjects.map((subject, idx) => (
                            <button
                              key={subject.id}
                              type="button"
                              onClick={() => setActiveSubjectIndex(idx)}
                              className={cn(
                                "flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                                activeSubjectIndex === idx
                                  ? "border-brand bg-brand/20 text-brand"
                                  : "border-white/10 bg-white/5 text-white/60"
                              )}
                            >
                              <span className="truncate max-w-[80px]">{subject.name}</span>
                              {subject.teacherId ? (
                                <Check className="h-3 w-3 text-emerald-400" />
                              ) : (
                                <AlertTriangle className="h-3 w-3 text-amber-400" />
                              )}
                            </button>
                          ))}
                        </div>

                        <div className="text-sm font-medium text-white">{activeSubject.name}</div>

                        {/* Search */}
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                          <input
                            type="text"
                            value={teacherSearch}
                            onChange={(e) => setTeacherSearch(e.target.value)}
                            placeholder="Search teachers..."
                            className="h-9 w-full rounded-lg border border-white/10 bg-white/5 pl-10 pr-4 text-sm text-white placeholder:text-muted focus:border-brand"
                          />
                        </div>

                        {/* Teacher list */}
                        {teachersLoading ? (
                          <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-5 w-5 animate-spin text-brand" />
                          </div>
                        ) : teachers.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-6 border border-white/10 bg-white/5 rounded-lg">
                            <UserCheck className="h-6 w-6 text-white/30" />
                            <p className="mt-1 text-xs text-white/50">
                              {teacherSearch ? "No teachers found" : "Type to search"}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[200px] overflow-y-auto">
                            {teachers.map((teacher) => {
                              const isSelected = activeSubject.teacherId === teacher.id;

                              return (
                                <button
                                  key={teacher.id}
                                  type="button"
                                  onClick={() =>
                                    assignTeacherToSubject(activeSubjectIndex, teacher)
                                  }
                                  className={cn(
                                    "flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-all",
                                    isSelected
                                      ? "border-brand bg-brand/20"
                                      : "border-white/10 bg-white/5"
                                  )}
                                >
                                  <Avatar className="h-8 w-8 border border-white/20">
                                    <AvatarImage src={teacher.photoUrl || ""} alt={teacher.fullName} />
                                    <AvatarFallback className="bg-brand/40 text-xs font-semibold text-white">
                                      {getInitials(teacher.firstName, teacher.lastName)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white truncate">
                                      {teacher.fullName}
                                    </p>
                                  </div>
                                  {isSelected && <Check className="h-4 w-4 text-brand" />}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Progress */}
                        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted">Progress:</span>
                            <span className="font-medium text-white">
                              {selectedSubjects.filter((s) => s.teacherId).length} / {selectedSubjects.length}
                            </span>
                          </div>
                          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-brand transition-all"
                              style={{
                                width: `${(selectedSubjects.filter((s) => s.teacherId).length / selectedSubjects.length) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      </section>
                    )}

                    {/* Step 3: Review (Mobile) */}
                    {step === 3 && (
                      <section className="space-y-3">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                          Review
                        </h2>

                        <div className="space-y-2 max-h-[250px] overflow-y-auto">
                          {selectedSubjects.map((subject) => (
                            <div
                              key={subject.id}
                              className={cn(
                                "flex items-center justify-between rounded-lg border p-3",
                                subject.teacherId
                                  ? "border-emerald-500/30 bg-emerald-500/5"
                                  : "border-amber-500/30 bg-amber-500/5"
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <BookOpen
                                  className={cn(
                                    "h-4 w-4",
                                    subject.teacherId ? "text-emerald-400" : "text-amber-400"
                                  )}
                                />
                                <span className="text-sm font-medium text-white">{subject.name}</span>
                              </div>
                              <span
                                className={cn(
                                  "text-xs",
                                  subject.teacherId ? "text-emerald-300" : "text-amber-300"
                                )}
                              >
                                {subject.teacherName || "Unassigned"}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="rounded-lg border border-brand/30 bg-brand/10 p-3 text-center">
                          <p className="text-sm font-medium text-brand">
                            {assignmentsToMake.length} assignment{assignmentsToMake.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </section>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Mobile Footer */}
              <div className="flex items-center justify-between px-5 py-4 border-t border-white/10 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={isFirstStep ? () => onOpenChange(false) : handleBack}
                  disabled={assignMutation.isPending}
                  className="gap-1 border-white/10 bg-white/5 text-white text-xs"
                >
                  <ChevronLeft className="h-3 w-3" />
                  {isFirstStep ? "Cancel" : "Back"}
                </Button>

                {!isLastStep ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleNext}
                    disabled={step === 1 ? !canProceedToStep2 : false}
                    className="gap-1 bg-brand text-black text-xs"
                  >
                    Next
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleConfirm}
                    disabled={assignmentsToMake.length === 0 || assignMutation.isPending}
                    className="gap-1 bg-brand text-black text-xs"
                  >
                    {assignMutation.isPending ? (
                      "Assigning…"
                    ) : (
                      <>
                        <Check className="h-3 w-3" />
                        Confirm
                      </>
                    )}
                  </Button>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
