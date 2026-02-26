// src/components/modals/BulkGradeSubjectAssignmentModal.tsx
"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  GraduationCap,
  BookOpen,
  Check,
  Loader2,
  AlertCircle,
  School,
  Users,
  ChevronDown,
} from "lucide-react";
import { useGrades } from "@/hooks/admin/useGrades";
import { useSubjects } from "@/hooks/admin/useSubjects";
import { useClasses } from "@/hooks/admin/useClasses";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBusyToast } from "@/hooks/useBusyToast";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

type BulkGradeSubjectAssignmentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-select this grade when opening from grade detail page */
  initialGradeId?: string | null;
};

type AssignmentMode = "same-for-all" | "individual";

export function BulkGradeSubjectAssignmentModal({
  open,
  onOpenChange,
  initialGradeId,
}: BulkGradeSubjectAssignmentModalProps) {
  const [selectedGradeId, setSelectedGradeId] = React.useState<string | null>(null);
  const [selectedSubjectIds, setSelectedSubjectIds] = React.useState<string[]>([]);
  const [assignmentMode, setAssignmentMode] = React.useState<AssignmentMode>("same-for-all");

  const queryClient = useQueryClient();
  const busy = useBusyToast();

  // Reset when modal opens, or pre-select grade when initialGradeId provided
  React.useEffect(() => {
    if (open) {
      setSelectedGradeId(initialGradeId ?? null);
      setSelectedSubjectIds([]);
      setAssignmentMode("same-for-all");
    }
  }, [open, initialGradeId]);

  // Fetch grades
  const { data: gradesData, isLoading: gradesLoading } = useGrades(true);
  const grades = gradesData?.data || [];

  // Fetch subjects
  const { data: subjectsData, isLoading: subjectsLoading } = useSubjects();
  const allSubjects = subjectsData?.data || [];

  // Fetch classes for selected grade
  const { data: classesData, isLoading: classesLoading } = useClasses({
    gradeId: selectedGradeId || undefined,
    isActive: true,
  });
  const classesInGrade = classesData?.data || [];

  const selectedGrade = grades.find((g) => g.id === selectedGradeId);

  // Bulk assign mutation
  const bulkAssignMutation = useMutation({
    mutationFn: async ({
      classIds,
      subjectIds,
    }: {
      classIds: string[];
      subjectIds: string[];
    }) => {
      // Assign subjects to each class
      const results = await Promise.all(
        classIds.map(async (classId) => {
          const res = await fetch(`/api/admin/classes/${classId}/assign-subjects`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subjectIds }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || `Failed to assign subjects to class ${classId}`);
          }
          return res.json();
        })
      );
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
    },
  });

  const toggleSubject = (subjectId: string) => {
    setSelectedSubjectIds((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId]
    );
  };

  const selectAllSubjects = () => {
    setSelectedSubjectIds(allSubjects.map((s) => s.id));
  };

  const clearAllSubjects = () => {
    setSelectedSubjectIds([]);
  };

  const handleAssign = async () => {
    if (!selectedGradeId || selectedSubjectIds.length === 0 || classesInGrade.length === 0) {
      return;
    }

    const classIds = classesInGrade.map((c) => c.id);

    try {
      await busy.promise(
        bulkAssignMutation.mutateAsync({ classIds, subjectIds: selectedSubjectIds }),
        {
          loading: `Assigning ${selectedSubjectIds.length} subject${selectedSubjectIds.length !== 1 ? "s" : ""} to ${classIds.length} class${classIds.length !== 1 ? "es" : ""}...`,
          success: "Subjects assigned successfully!",
          error: (e: Error) => e.message || "Failed to assign subjects",
        }
      );
      onOpenChange(false);
    } catch {
      // Error handled by busy toast
    }
  };

  const canAssign =
    selectedGradeId &&
    selectedSubjectIds.length > 0 &&
    classesInGrade.length > 0 &&
    !bulkAssignMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-black p-0 text-white shadow-2xl">
        {/* Header */}
        <DialogHeader className="border-b border-white/10 p-6 pb-4">
          <DialogTitle className="flex items-center gap-3 text-xl font-bold">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20">
              <GraduationCap className="h-5 w-5 text-violet-300" />
            </div>
            Bulk Assign Subjects to Grade
          </DialogTitle>
          <p className="mt-2 text-sm text-white/60">
            Assign subjects to all classes within a grade at once
          </p>
        </DialogHeader>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-6 space-y-6">
          {/* Step 1: Select Grade */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-white">
              1. Select Grade
            </Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-between border-white/15 bg-white/5 text-left hover:bg-white/10",
                    selectedGrade
                      ? "text-white"
                      : "text-white/50"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-violet-400" />
                    {selectedGrade?.name || "Select a grade"}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] border border-white/10 bg-slate-900/95 backdrop-blur-xl"
              >
                <DropdownMenuLabel className="text-xs text-white/60">
                  Available Grades
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
                {gradesLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                  </div>
                ) : grades.length === 0 ? (
                  <div className="py-4 text-center text-xs text-white/50">
                    No grades available
                  </div>
                ) : (
                  grades.map((grade) => (
                    <DropdownMenuCheckboxItem
                      key={grade.id}
                      checked={selectedGradeId === grade.id}
                      onCheckedChange={() => setSelectedGradeId(grade.id)}
                      className="text-sm"
                    >
                      {grade.name}
                      {grade.stage && (
                        <span className="ml-2 text-xs text-white/50">
                          ({grade.stage})
                        </span>
                      )}
                    </DropdownMenuCheckboxItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Show classes in selected grade */}
            {selectedGradeId && (
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="flex items-center gap-2 text-sm">
                  <School className="h-4 w-4 text-violet-400" />
                  <span className="text-white/70">Classes in this grade:</span>
                </div>
                {classesLoading ? (
                  <div className="mt-2 flex items-center gap-2 text-xs text-white/50">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading classes...
                  </div>
                ) : classesInGrade.length === 0 ? (
                  <p className="mt-2 text-xs text-amber-400">
                    No active classes in this grade
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {classesInGrade.map((cls) => (
                      <span
                        key={cls.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs text-violet-200"
                      >
                        {cls.fullLabel}
                        <Users className="h-3 w-3 text-violet-400" />
                        {cls.studentCount}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Select Subjects */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-white">
                2. Select Subjects
              </Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={selectAllSubjects}
                  className="h-7 text-xs text-white/60 hover:text-white"
                >
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearAllSubjects}
                  className="h-7 text-xs text-white/60 hover:text-white"
                >
                  Clear
                </Button>
              </div>
            </div>

            {subjectsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
              </div>
            ) : allSubjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <AlertCircle className="h-8 w-8 text-white/30" />
                <p className="mt-2 text-sm text-white/50">No subjects available</p>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 max-h-[200px] overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-3">
                {allSubjects.map((subject) => {
                  const isSelected = selectedSubjectIds.includes(subject.id);

                  return (
                    <label
                      key={subject.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 text-left transition-all",
                        isSelected
                          ? "border-violet-500/50 bg-violet-500/10"
                          : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSubject(subject.id)}
                        className="h-4 w-4 border-white/30 data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-500"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-white truncate">
                          {subject.name}
                        </span>
                        {subject.code && (
                          <span className="block text-[10px] text-white/50">{subject.code}</span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {selectedSubjectIds.length > 0 && (
              <div className="rounded-lg bg-violet-500/10 p-3 text-sm text-violet-200">
                <strong>{selectedSubjectIds.length}</strong> subject
                {selectedSubjectIds.length !== 1 ? "s" : ""} selected
              </div>
            )}
          </div>

          {/* Summary */}
          {selectedGradeId && selectedSubjectIds.length > 0 && classesInGrade.length > 0 && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20">
                  <BookOpen className="h-5 w-5 text-emerald-300" />
                </div>
                <div>
                  <p className="font-medium text-emerald-200">
                    Ready to assign {selectedSubjectIds.length} subject
                    {selectedSubjectIds.length !== 1 ? "s" : ""} to{" "}
                    {classesInGrade.length} class
                    {classesInGrade.length !== 1 ? "es" : ""}
                  </p>
                  <p className="text-xs text-emerald-300/70">
                    All classes in {selectedGrade?.name} will receive these subjects
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 p-6 pt-4">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-white/60 hover:text-white"
          >
            Cancel
          </Button>

          <Button
            onClick={handleAssign}
            disabled={!canAssign}
            className="gap-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20 hover:from-violet-600 hover:to-purple-700 disabled:opacity-50"
          >
            {bulkAssignMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Assign to All Classes
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
