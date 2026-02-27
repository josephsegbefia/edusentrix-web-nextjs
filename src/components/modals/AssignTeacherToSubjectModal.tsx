// src/components/modals/AssignTeacherToSubjectModal.tsx
"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  UserPlus,
  Check,
  Loader2,
  AlertTriangle,
  AlertCircle,
  Info,
  BookOpen,
  School,
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  useTeacherSearch,
  useSubjectSearch,
  useClassGroupSearch,
} from "@/hooks/admin/useDirectorySearch";
import { useQueryClient } from "@tanstack/react-query";
import { useAssignTeacherToSubject, useUnassignTeacher } from "@/hooks/admin/useSubjects";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useAcademicPeriods } from "@/hooks/admin/useAcademicPeriods";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import type { SubjectDTO } from "@/hooks/admin/useSubjects";

const STEPS = 4;

type AssignTeacherToSubjectModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject?: SubjectDTO;
  initialClassGroupId?: string;
  /** Edit mode: prefilled teacher and class, unassigns old assignment on save */
  editAssignment?: {
    assignmentId: string;
    teacherId: string;
    classGroupId: string;
    className?: string;
    teacherDisplay?: { firstName: string; lastName: string; fullName: string; email?: string | null; photoUrl?: string | null };
  };
};

export function AssignTeacherToSubjectModal({
  open,
  onOpenChange,
  subject,
  initialClassGroupId,
  editAssignment,
}: AssignTeacherToSubjectModalProps) {
  const queryClient = useQueryClient();
  const busy = useBusyToast();
  const assignTeacher = useAssignTeacherToSubject();
  const unassignTeacher = useUnassignTeacher(subject?.id);
  const isSubjectPrefilled = Boolean(subject?.id);
  const isEditMode = Boolean(editAssignment);

  const [step, setStep] = React.useState(1);
  const [selectedTeacherId, setSelectedTeacherId] = React.useState("");
  const [selectedSubjectId, setSelectedSubjectId] = React.useState(subject?.id || "");
  const [selectedClassIds, setSelectedClassIds] = React.useState<string[]>(
    initialClassGroupId ? [initialClassGroupId] : []
  );
  const [selectedClassLabels, setSelectedClassLabels] = React.useState<Record<string, string>>({});
  const [allowMultiple, setAllowMultiple] = React.useState(false);
  const [conflictError, setConflictError] = React.useState<string | null>(null);
  const [createdAssignments, setCreatedAssignments] = React.useState<
    { assignmentId: string; className: string }[]
  >([]);
  const [schedulePhase, setSchedulePhase] = React.useState<
    "idle" | "prompt" | "form" | "done"
  >("idle");
  const [assignmentSchedules, setAssignmentSchedules] = React.useState<
    Record<string, Array<{ dayOfWeek: number; startTime: string; endTime: string }>>
  >({});

  const [teacherQuery, setTeacherQuery] = React.useState("");
  const [subjectQuery, setSubjectQuery] = React.useState("");
  const [classQuery, setClassQuery] = React.useState("");

  const debouncedTeacherQuery = useDebouncedValue(teacherQuery, 300);
  const debouncedSubjectQuery = useDebouncedValue(subjectQuery, 300);
  const debouncedClassQuery = useDebouncedValue(classQuery, 300);

  const { data: teachersData, isLoading: isLoadingTeachers } = useTeacherSearch(
    debouncedTeacherQuery
  );
  const { data: subjectsData, isLoading: isLoadingSubjects } = useSubjectSearch(
    debouncedSubjectQuery
  );
  const { data: periodsData } = useAcademicPeriods();

  const teachers = React.useMemo(() => {
    const fetched = teachersData?.data || [];
    if (!editAssignment?.teacherId) return fetched;
    if (fetched.some((t) => t.id === editAssignment.teacherId)) return fetched;
    if (editAssignment.teacherDisplay) {
      return [
        {
          id: editAssignment.teacherId,
          firstName: editAssignment.teacherDisplay.firstName,
          lastName: editAssignment.teacherDisplay.lastName,
          fullName: editAssignment.teacherDisplay.fullName,
          email: editAssignment.teacherDisplay.email ?? null,
          photoUrl: editAssignment.teacherDisplay.photoUrl ?? null,
        },
        ...fetched,
      ];
    }
    return fetched;
  }, [teachersData?.data, editAssignment]);
  const periods = periodsData?.periods || [];
  const currentPeriod = periods.find((p) => p.isCurrent) || periods[0];

  const { data: classesData, isLoading: isLoadingClasses } = useClassGroupSearch(
    debouncedClassQuery,
    selectedSubjectId || undefined
  );

  const subjects = React.useMemo(() => {
    const fetched = subjectsData?.data || [];
    if (!subject?.id) return fetched;
    if (fetched.some((s) => s.id === subject.id)) return fetched;
    return [{ id: subject.id, name: subject.name }, ...fetched];
  }, [subjectsData?.data, subject?.id, subject?.name]);

  const classes = classesData?.data || [];

  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId);
  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);
  const selectedClasses = classes.filter((c) => selectedClassIds.includes(c.id));
  const displayTeacher = selectedTeacher ?? (editAssignment?.teacherDisplay
    ? {
        id: editAssignment.teacherId,
        firstName: editAssignment.teacherDisplay.firstName,
        lastName: editAssignment.teacherDisplay.lastName,
        fullName: editAssignment.teacherDisplay.fullName,
        email: editAssignment.teacherDisplay.email ?? null,
        photoUrl: editAssignment.teacherDisplay.photoUrl ?? null,
      }
    : null);

  React.useEffect(() => {
    if (open) {
      setStep(1);
      if (editAssignment) {
        setSelectedTeacherId(editAssignment.teacherId);
        setSelectedSubjectId(subject?.id || "");
        setSelectedClassIds([editAssignment.classGroupId]);
        setSelectedClassLabels(
          editAssignment.className ? { [editAssignment.classGroupId]: editAssignment.className } : {}
        );
        setStep(2);
      } else {
        setSelectedTeacherId("");
        setSelectedSubjectId(subject?.id || "");
        setSelectedClassIds(initialClassGroupId ? [initialClassGroupId] : []);
        setSelectedClassLabels({});
      }
      setAllowMultiple(false);
      setConflictError(null);
      setCreatedAssignments([]);
      setSchedulePhase("idle");
      setAssignmentSchedules({});
      setTeacherQuery("");
      setSubjectQuery("");
      setClassQuery("");
    }
  }, [open, subject?.id, initialClassGroupId, editAssignment]);

  // Populate labels for pre-selected classes when they load
  React.useEffect(() => {
    if (!open || selectedClassIds.length === 0) return;
    const missing = selectedClassIds.filter((id) => !selectedClassLabels[id]);
    if (missing.length === 0) return;
    const updates: Record<string, string> = {};
    for (const id of missing) {
      const c = classes.find((cls) => cls.id === id);
      if (c) updates[id] = c.label || c.name;
    }
    if (Object.keys(updates).length > 0) {
      setSelectedClassLabels((prev) => ({ ...prev, ...updates }));
    }
  }, [open, selectedClassIds, selectedClassLabels, classes]);

  const canProceed =
    step === 1
      ? !!selectedSubjectId
      : step === 2
      ? selectedClassIds.length > 0
      : step === 3
      ? !!selectedTeacherId
      : true;

  const handleNext = () => {
    if (step < STEPS) setStep(step + 1);
  };

  const handleBack = () => {
    if (step === 1) onOpenChange(false);
    else setStep(step - 1);
  };

  const handleConfirm = async () => {
    if (!selectedTeacherId || !selectedSubjectId || selectedClassIds.length === 0) return;
    setConflictError(null);
    const count = selectedClassIds.length;
    try {
      const results = await busy.promise(
        (async () => {
          if (editAssignment) {
            await unassignTeacher.mutateAsync(editAssignment.assignmentId);
          }
          const created: { assignmentId: string; className: string }[] = [];
          for (const classGroupId of selectedClassIds) {
            const res = await assignTeacher.mutateAsync({
              teacherId: selectedTeacherId,
              subjectId: selectedSubjectId,
              classGroupId,
              academicPeriodId: currentPeriod?._id || "",
              allowMultiple,
            });
            const className = selectedClassLabels[classGroupId] ?? classes.find((c) => c.id === classGroupId)?.label ?? classes.find((c) => c.id === classGroupId)?.name ?? "Class";
            created.push({ assignmentId: res.data.id, className });
          }
          return created;
        })(),
        {
          loading: isEditMode
            ? "Updating assignment..."
            : count > 1
            ? `Assigning teacher to ${count} classes...`
            : "Assigning teacher...",
          success: isEditMode
            ? "Assignment updated successfully"
            : count > 1
            ? `Teacher assigned to ${count} classes successfully`
            : "Teacher assigned successfully",
          error: (e: Error) => {
            if (e.message.includes("already assigned") || e.message.includes("Conflict")) {
              setConflictError(e.message);
              return e.message;
            }
            return e.message || "Failed to assign teacher";
          },
        }
      );
      if (isEditMode || !results || results.length === 0) {
        onOpenChange(false);
        return;
      }
      setCreatedAssignments(results);
      setSchedulePhase("prompt");
    } catch (e) {
      if (e instanceof Error && (e.message.includes("already assigned") || e.message.includes("Conflict"))) {
        setConflictError(e.message);
      }
    }
  };

  const handleSkipSchedule = () => {
    onOpenChange(false);
  };

  const handleSetSchedule = () => {
    setSchedulePhase("form");
    setAssignmentSchedules(
      Object.fromEntries(
        createdAssignments.map((a) => [a.assignmentId, [{ dayOfWeek: 1, startTime: "08:00", endTime: "08:40" }]])
      )
    );
  };

  const addScheduleSlot = (assignmentId: string) => {
    setAssignmentSchedules((prev) => {
      const current = prev[assignmentId] ?? [];
      return {
        ...prev,
        [assignmentId]: [...current, { dayOfWeek: 1, startTime: "09:00", endTime: "09:40" }],
      };
    });
  };

  const removeScheduleSlot = (assignmentId: string, idx: number) => {
    setAssignmentSchedules((prev) => {
      const current = prev[assignmentId] ?? [];
      return { ...prev, [assignmentId]: current.filter((_, i) => i !== idx) };
    });
  };

  const updateScheduleSlot = (
    assignmentId: string,
    idx: number,
    field: "dayOfWeek" | "startTime" | "endTime",
    value: number | string
  ) => {
    setAssignmentSchedules((prev) => {
      const current = [...(prev[assignmentId] ?? [])];
      current[idx] = { ...current[idx], [field]: value };
      return { ...prev, [assignmentId]: current };
    });
  };

  const handleSaveSchedules = async () => {
    setConflictError(null);
    try {
      await busy.promise(
        (async () => {
          for (const { assignmentId } of createdAssignments) {
            const schedules = assignmentSchedules[assignmentId];
            if (schedules?.length && schedules.every((s) => s.startTime && s.endTime)) {
              const res = await fetch(`/api/admin/teacher-assignments/${assignmentId}/schedule`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ schedules }),
              });
              const data = await res.json();
              if (!res.ok) {
                throw new Error(data.error || "Schedule conflict");
              }
            }
          }
        })(),
        {
          loading: "Saving schedules...",
          success: "Schedules saved successfully",
          error: (e: Error) => {
            setConflictError(e.message);
            return e.message;
          },
        }
      );
      queryClient.invalidateQueries({ queryKey: ["teachers", "assignments"] });
      if (subject?.id) {
        queryClient.invalidateQueries({ queryKey: ["subject", subject.id] });
      }
      onOpenChange(false);
    } catch {
      // Error handled by busy
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
          onClick={() => onOpenChange(false)}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="relative z-10 w-full max-w-lg max-h-[90vh] rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10">
                <UserPlus className="h-5 w-5 text-rose-300" />
              </div>
              <span className="text-base font-semibold text-white">
                {isEditMode ? "Edit Assignment" : "Assign Teacher to Subject"}
              </span>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="text-white/60 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Step Indicator */}
          <div className="px-5 pt-4 flex items-center justify-between">
            <div className="text-sm text-white/70">
              {schedulePhase === "idle" ? (
                <>
                  Step <span className="font-semibold">{step}</span> of {STEPS}
                </>
              ) : (
                <span>Set teaching schedule</span>
              )}
            </div>
            {schedulePhase === "idle" && (
              <div className="flex gap-1">
                {Array.from({ length: STEPS }, (_, i) => i + 1).map((s) => (
                  <span
                    key={s}
                    className={cn(
                      "h-1.5 w-6 rounded-full transition-all",
                      s <= step ? "bg-rose-500" : "bg-white/20"
                    )}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-5 overflow-y-auto flex-1 min-h-0">
            {/* Schedule prompt - after assignment created */}
            {schedulePhase === "prompt" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-5"
              >
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-4">
                  <p className="text-sm font-medium text-white">
                    Would you like to set the days and times this teacher will teach?
                  </p>
                  <p className="mt-1 text-xs text-white/60">
                    This helps build the master timetable and class timetables. Schedules are checked for conflicts.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    onClick={handleSetSchedule}
                    className="w-full gap-2 bg-rose-500 text-white hover:bg-rose-600"
                  >
                    <Clock className="h-4 w-4" />
                    Yes, set schedule
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSkipSchedule}
                    className="w-full gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10"
                  >
                    Skip for now
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Schedule form */}
            {schedulePhase === "form" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-5"
              >
                {conflictError && (
                  <Alert className="border-amber-400/20 bg-amber-500/10">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <AlertDescription className="text-amber-100">{conflictError}</AlertDescription>
                  </Alert>
                )}
                <p className="text-xs text-white/60">
                  Add the days and times for each class. No overlapping slots are allowed for the teacher or the class.
                </p>
                <div className="space-y-4 max-h-[50vh] overflow-y-auto">
                  {createdAssignments.map(({ assignmentId, className }) => (
                    <div
                      key={assignmentId}
                      className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="bg-rose-500/20 text-rose-200 border-rose-500/30">
                          {className}
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => addScheduleSlot(assignmentId)}
                          className="h-7 gap-1 text-xs text-white/70 hover:text-white"
                        >
                          <Plus className="h-3 w-3" />
                          Add slot
                        </Button>
                      </div>
                      {(assignmentSchedules[assignmentId] ?? []).map((slot, idx) => (
                        <div
                          key={idx}
                          className="flex flex-wrap items-center gap-2 rounded-lg border border-white/5 bg-black/20 p-3"
                        >
                          <select
                            value={slot.dayOfWeek}
                            onChange={(e) =>
                              updateScheduleSlot(assignmentId, idx, "dayOfWeek", Number(e.target.value))
                            }
                            className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white"
                          >
                            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                              <option key={i} value={i} className="bg-neutral-900">
                                {d}
                              </option>
                            ))}
                          </select>
                          <input
                            type="time"
                            value={slot.startTime}
                            onChange={(e) =>
                              updateScheduleSlot(assignmentId, idx, "startTime", e.target.value)
                            }
                            className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white"
                          />
                          <span className="text-white/50">–</span>
                          <input
                            type="time"
                            value={slot.endTime}
                            onChange={(e) =>
                              updateScheduleSlot(assignmentId, idx, "endTime", e.target.value)
                            }
                            className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-300 hover:bg-red-500/10"
                            onClick={() => removeScheduleSlot(assignmentId, idx)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSkipSchedule}
                    className="flex-1 border-white/10 bg-white/5 text-white hover:bg-white/10"
                  >
                    Skip
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSaveSchedules}
                    className="flex-1 gap-2 bg-rose-500 text-white hover:bg-rose-600"
                  >
                    <Check className="h-4 w-4" />
                    Save schedules
                  </Button>
                </div>
              </motion.div>
            )}

            {schedulePhase === "idle" && (
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* Step 1: Select Subject */}
                {step === 1 && (
                  <section className="space-y-4">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                      Select Subject
                    </h2>
                    {isSubjectPrefilled && subject ? (
                      <div className="flex h-14 w-full items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 text-white">
                        <BookOpen className="h-5 w-5 text-rose-300" />
                        <div>
                          <p className="font-medium">{subject.name}</p>
                          <p className="text-xs text-white/60">Prefilled from subject detail</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                          <input
                            type="text"
                            placeholder="Search subjects..."
                            value={subjectQuery}
                            onChange={(e) => setSubjectQuery(e.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/40 focus:border-rose-500/50 focus:outline-none focus:ring-1 focus:ring-rose-500/50"
                          />
                        </div>
                        {isLoadingSubjects ? (
                          <div className="flex justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-rose-400" />
                          </div>
                        ) : (
                          <div className="grid gap-2 max-h-[40vh] overflow-y-auto pr-1">
                            {subjects.map((s) => (
                              <motion.label
                                key={s.id}
                                htmlFor={`subject-${s.id}`}
                                className={cn(
                                  "relative flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all",
                                  selectedSubjectId === s.id
                                    ? "border-rose-500/40 bg-rose-500/15"
                                    : "border-white/10 bg-white/5 hover:border-white/20"
                                )}
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                              >
                                <input
                                  type="radio"
                                  id={`subject-${s.id}`}
                                  name="subjectId"
                                  value={s.id}
                                  checked={selectedSubjectId === s.id}
                                  onChange={() => setSelectedSubjectId(s.id)}
                                  className="sr-only"
                                />
                                <BookOpen className="h-5 w-5 text-rose-300" />
                                <span className="text-sm font-medium text-white truncate">{s.name}</span>
                                {selectedSubjectId === s.id && (
                                  <Check className="ml-auto h-5 w-5 text-rose-400" />
                                )}
                              </motion.label>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </section>
                )}

                {/* Step 2: Select Class Group(s) */}
                {step === 2 && (
                  <section className="space-y-4">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                      Select Class Group(s)
                    </h2>
                    <p className="text-xs text-white/60">
                      Select one or more classes. The teacher will be assigned to teach this subject in all selected classes.
                    </p>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                      <input
                        type="text"
                        placeholder="Search classes..."
                        value={classQuery}
                        onChange={(e) => setClassQuery(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/40 focus:border-rose-500/50 focus:outline-none focus:ring-1 focus:ring-rose-500/50"
                      />
                    </div>
                    {isLoadingClasses ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-rose-400" />
                      </div>
                    ) : classes.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8">
                        <AlertCircle className="h-6 w-6 text-white/30" />
                        <p className="mt-2 text-sm text-white/50">No classes found for this subject</p>
                        <p className="mt-1 text-xs text-white/40">Classes are filtered by grade stage</p>
                      </div>
                    ) : (
                      <div className="grid gap-2 max-h-[40vh] overflow-y-auto pr-1">
                        {classes.map((classGroup) => {
                          const isSelected = selectedClassIds.includes(classGroup.id);
                          return (
                            <motion.label
                              key={classGroup.id}
                              htmlFor={`class-${classGroup.id}`}
                              className={cn(
                                "relative flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all",
                                isSelected
                                  ? "border-rose-500/40 bg-rose-500/15"
                                  : "border-white/10 bg-white/5 hover:border-white/20"
                              )}
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                            >
                              <input
                                type="checkbox"
                                id={`class-${classGroup.id}`}
                                checked={isSelected}
                                onChange={() => {
                                  const label = classGroup.label || classGroup.name;
                                  setSelectedClassIds((prev) =>
                                    prev.includes(classGroup.id)
                                      ? prev.filter((id) => id !== classGroup.id)
                                      : [...prev, classGroup.id]
                                  );
                                  setSelectedClassLabels((prev) => {
                                    const next = { ...prev };
                                    if (next[classGroup.id]) delete next[classGroup.id];
                                    else next[classGroup.id] = label;
                                    return next;
                                  });
                                }}
                                className="sr-only"
                              />
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                                <School className="h-5 w-5 text-rose-300" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="truncate text-sm font-medium text-white">
                                  {classGroup.label || classGroup.name}
                                </p>
                                {classGroup.gradeName && (
                                  <p className="truncate text-xs text-white/50">{classGroup.gradeName}</p>
                                )}
                              </div>
                              {isSelected && (
                                <Check className="h-5 w-5 text-rose-400" />
                              )}
                            </motion.label>
                          );
                        })}
                      </div>
                    )}
                  </section>
                )}

                {/* Step 3: Select Teacher */}
                {step === 3 && (
                  <section className="space-y-4">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                      Select Teacher
                    </h2>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                      <input
                        type="text"
                        placeholder="Search teachers..."
                        value={teacherQuery}
                        onChange={(e) => setTeacherQuery(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/40 focus:border-rose-500/50 focus:outline-none focus:ring-1 focus:ring-rose-500/50"
                      />
                    </div>
                    {isLoadingTeachers ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-rose-400" />
                      </div>
                    ) : teachers.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8">
                        <AlertCircle className="h-6 w-6 text-white/30" />
                        <p className="mt-2 text-sm text-white/50">No teachers found</p>
                      </div>
                    ) : (
                      <div className="grid gap-2 max-h-[40vh] overflow-y-auto pr-1">
                        {teachers.map((teacher) => (
                          <motion.label
                            key={teacher.id}
                            htmlFor={`teacher-${teacher.id}`}
                            className={cn(
                              "relative flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all",
                              selectedTeacherId === teacher.id
                                ? "border-rose-500/40 bg-rose-500/15"
                                : "border-white/10 bg-white/5 hover:border-white/20"
                            )}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                          >
                            <input
                              type="radio"
                              id={`teacher-${teacher.id}`}
                              name="teacherId"
                              value={teacher.id}
                              checked={selectedTeacherId === teacher.id}
                              onChange={() => setSelectedTeacherId(teacher.id)}
                              className="sr-only"
                            />
                            <Avatar className="h-10 w-10 border-2 border-white/20">
                              <AvatarImage src={teacher.photoUrl || ""} alt={teacher.fullName} />
                              <AvatarFallback className="bg-linear-to-br from-indigo-500 to-purple-600 text-sm font-semibold text-white">
                                {teacher.firstName?.charAt(0) || ""}
                                {teacher.lastName?.charAt(0) || ""}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="truncate text-sm font-medium text-white">
                                {teacher.fullName}
                              </p>
                              <p className="truncate text-xs text-white/50">
                                {teacher.email || "Teacher"}
                              </p>
                            </div>
                            {selectedTeacherId === teacher.id && (
                              <Check className="h-5 w-5 text-rose-400" />
                            )}
                          </motion.label>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {/* Step 4: Review & Confirm */}
                {step === 4 && (
                  <section className="space-y-4">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                      Review Assignment
                    </h2>

                    {conflictError && (
                      <Alert className="border-amber-400/20 bg-amber-500/10">
                        <AlertTriangle className="h-4 w-4 text-amber-400" />
                        <AlertDescription className="text-amber-100">
                          {conflictError}
                        </AlertDescription>
                      </Alert>
                    )}

                    <Alert className="border-sky-400/20 bg-sky-500/10">
                      <Info className="h-4 w-4 text-sky-400" />
                      <AlertDescription className="text-sky-100">
                        By default, only one teacher can teach a subject in a class. Enable co-teaching below to allow multiple teachers.
                      </AlertDescription>
                    </Alert>

                    <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 space-y-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-14 w-14 border-2 border-white/20">
                          <AvatarImage src={displayTeacher?.photoUrl || ""} alt={displayTeacher?.fullName || ""} />
                          <AvatarFallback className="bg-linear-to-br from-indigo-500 to-purple-600 text-lg font-semibold text-white">
                            {displayTeacher?.firstName?.charAt(0) || ""}
                            {displayTeacher?.lastName?.charAt(0) || ""}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-lg font-semibold text-white">
                            {displayTeacher?.fullName}
                          </p>
                          <p className="text-sm text-white/60">
                            {displayTeacher?.email || "Teacher"}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-white/50 shrink-0" />
                          <span className="text-sm text-white">{selectedSubject?.name}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <School className="h-4 w-4 text-white/50 shrink-0 mt-0.5" />
                          <div className="flex flex-wrap gap-1.5">
                            {selectedClassIds.map((id) => (
                              <Badge
                                key={id}
                                variant="secondary"
                                className="bg-white/10 text-white border-white/20"
                              >
                                {selectedClassLabels[id] ?? selectedClasses.find((c) => c.id === id)?.label ?? selectedClasses.find((c) => c.id === id)?.name ?? id}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
                      <Checkbox
                        id="allowMultiple"
                        checked={allowMultiple}
                        onCheckedChange={(checked) => setAllowMultiple(checked === true)}
                      />
                      <Label
                        htmlFor="allowMultiple"
                        className="cursor-pointer text-sm text-white/90"
                      >
                        Allow multiple teachers (co-teaching)
                      </Label>
                    </div>
                  </section>
                )}
              </motion.div>
            </AnimatePresence>
            )}
          </div>

          {/* Footer - only when in assign steps */}
          {schedulePhase === "idle" && (
          <div className="flex items-center justify-between border-t border-white/10 p-5 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              <ChevronLeft className="h-4 w-4" />
              {step === 1 ? "Cancel" : "Back"}
            </Button>

            {step < STEPS ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={!canProceed}
                className="gap-2 bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={assignTeacher.isPending}
                className="gap-2 bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50"
              >
                {assignTeacher.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Confirm Assignment
                  </>
                )}
              </Button>
            )}
          </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
