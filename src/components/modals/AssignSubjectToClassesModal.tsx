"use client";

import * as React from "react";
import { CheckSquare2, Loader2, School, Search, Shapes } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { SubjectDTO } from "@/hooks/admin/useSubjects";
import { useClasses, useAssignSubjectsToClass } from "@/hooks/admin/useClasses";
import { useBusyToast } from "@/hooks/useBusyToast";
import { resolveSubjectVisual } from "@/components/admin/subjects/subject-visuals";
import { cn } from "@/lib/utils";

type AssignSubjectToClassesModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: SubjectDTO | null;
};

export function AssignSubjectToClassesModal({
  open,
  onOpenChange,
  subject,
}: AssignSubjectToClassesModalProps) {
  const busy = useBusyToast();
  const assignSubjects = useAssignSubjectsToClass();
  const { data, isLoading } = useClasses({ isActive: true });

  const classes = data?.data ?? [];
  const [query, setQuery] = React.useState("");
  const [selectedClassIds, setSelectedClassIds] = React.useState<string[]>([]);
  const [hasInitialized, setHasInitialized] = React.useState(false);

  const initialSelectedClassIds = React.useMemo(() => {
    if (!subject) return [];
    return classes
      .filter((classGroup) =>
        classGroup.subjects.some((item) => item.id === subject.id)
      )
      .map((classGroup) => classGroup.id);
  }, [classes, subject]);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setSelectedClassIds([]);
      setHasInitialized(false);
      return;
    }

    if (!hasInitialized && subject) {
      setSelectedClassIds(initialSelectedClassIds);
      setHasInitialized(true);
    }
  }, [open, hasInitialized, initialSelectedClassIds, subject]);

  const visibleClasses = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return classes;

    return classes.filter((classGroup) => {
      const gradeName = classGroup.grade?.name ?? "";
      return (
        classGroup.fullLabel.toLowerCase().includes(normalizedQuery) ||
        classGroup.name.toLowerCase().includes(normalizedQuery) ||
        gradeName.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [classes, query]);

  const toggleClass = (classId: string) => {
    setSelectedClassIds((current) =>
      current.includes(classId)
        ? current.filter((id) => id !== classId)
        : [...current, classId]
    );
  };

  const toggleVisible = (checked: boolean) => {
    setSelectedClassIds((current) => {
      const next = new Set(current);
      for (const classGroup of visibleClasses) {
        if (checked) next.add(classGroup.id);
        else next.delete(classGroup.id);
      }
      return Array.from(next);
    });
  };

  const allVisibleSelected =
    visibleClasses.length > 0 &&
    visibleClasses.every((classGroup) => selectedClassIds.includes(classGroup.id));

  const selectedCount = selectedClassIds.length;
  const visual = subject ? resolveSubjectVisual(subject) : null;
  const SubjectIcon = visual?.icon ?? Shapes;

  async function handleSave() {
    if (!subject) return;

    const selectedSet = new Set(selectedClassIds);
    const changedClasses = classes.filter((classGroup) => {
      const currentlyAssigned = classGroup.subjects.some(
        (item) => item.id === subject.id
      );
      const shouldBeAssigned = selectedSet.has(classGroup.id);
      return currentlyAssigned !== shouldBeAssigned;
    });

    if (changedClasses.length === 0) {
      onOpenChange(false);
      return;
    }

    try {
      await busy.promise(
        (async () => {
          for (const classGroup of changedClasses) {
            const currentSubjectIds = classGroup.subjects.map((item) => item.id);
            const shouldInclude = selectedSet.has(classGroup.id);
            const nextSubjectIds = shouldInclude
              ? Array.from(new Set([...currentSubjectIds, subject.id]))
              : currentSubjectIds.filter((id) => id !== subject.id);

            await assignSubjects.mutateAsync({
              classId: classGroup.id,
              subjectIds: nextSubjectIds,
            });
          }
        })(),
        {
          loading: "Updating class assignments...",
          success: `Updated ${changedClasses.length} class assignment${
            changedClasses.length === 1 ? "" : "s"
          }`,
          error: (error: Error) =>
            error.message || "Failed to update class assignments",
        }
      );
      onOpenChange(false);
    } catch {
      // Error feedback is already handled by busy.promise.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl border-white/10 bg-linear-to-br from-slate-900 via-slate-950 to-black p-0 text-white shadow-2xl shadow-black/50">
        <div className="relative overflow-hidden rounded-lg">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-linear-to-br from-amber-400/15 via-orange-300/8 to-transparent blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-linear-to-tr from-teal-400/10 via-emerald-300/5 to-transparent blur-3xl"
            aria-hidden="true"
          />

          <div className="relative space-y-6 p-6">
            <DialogHeader className="space-y-3 text-left">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-2xl border",
                    visual?.iconShell ??
                      "border-amber-300/20 bg-linear-to-br from-amber-300/16 to-orange-300/10"
                  )}
                >
                  <SubjectIcon
                    className={cn(
                      "size-5",
                      visual?.iconColor ?? "text-amber-100"
                    )}
                  />
                </div>
                <div className="min-w-0 space-y-1">
                  <DialogTitle className="text-xl font-semibold text-white">
                    Assign subject to classes
                  </DialogTitle>
                  <DialogDescription className="max-w-xl text-sm leading-relaxed text-white/55">
                    Choose which active classes should offer{" "}
                    <span className="font-medium text-white/80">
                      {subject?.name ?? "this subject"}
                    </span>
                    . Existing class subjects are preserved.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-white">
                    Selected classes
                  </p>
                  <p className="text-sm text-white/50">
                    {selectedCount} class{selectedCount === 1 ? "" : "es"} will
                    include this subject.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => toggleVisible(true)}
                    className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                    disabled={visibleClasses.length === 0}
                  >
                    Select visible
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => toggleVisible(false)}
                    className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                    disabled={visibleClasses.length === 0}
                  >
                    Clear visible
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/35" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search classes by name or grade"
                  className="h-11 rounded-xl border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/35 focus-visible:border-amber-300/40 focus-visible:ring-amber-300/25"
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-white/55">
                <CheckSquare2 className="size-3.5" />
                <span>
                  {allVisibleSelected
                    ? "All visible classes are selected"
                    : `${visibleClasses.length} visible class${
                        visibleClasses.length === 1 ? "" : "es"
                      }`}
                </span>
              </div>

              <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-10 text-sm text-white/60">
                    <Loader2 className="size-4 animate-spin" />
                    Loading classes...
                  </div>
                ) : visibleClasses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 py-12 text-center">
                    <School className="size-8 text-white/25" />
                    <p className="mt-3 text-sm font-medium text-white/70">
                      {query ? "No classes match your search" : "No active classes yet"}
                    </p>
                    <p className="mt-1 max-w-sm text-xs text-white/45">
                      {query
                        ? "Try a different class name or grade."
                        : "Create a class first, then come back to attach this subject."}
                    </p>
                  </div>
                ) : (
                  visibleClasses.map((classGroup) => {
                    const isSelected = selectedClassIds.includes(classGroup.id);
                    const currentSubjectCount = classGroup.subjects.length;
                    return (
                      <button
                        key={classGroup.id}
                        type="button"
                        onClick={() => toggleClass(classGroup.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all",
                          isSelected
                            ? "border-amber-300/35 bg-amber-300/10 shadow-[0_18px_45px_-32px_rgba(251,191,36,0.75)]"
                            : "border-white/10 bg-white/5 hover:border-white/15 hover:bg-white/10"
                        )}
                      >
                        <Checkbox
                          checked={isSelected}
                          className="pointer-events-none h-4 w-4 border-white/30 bg-slate-900/80 data-[state=checked]:bg-amber-300 data-[state=checked]:text-slate-950"
                          aria-label={`Assign ${subject?.name ?? "subject"} to ${classGroup.fullLabel}`}
                        />
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                            <School className="size-4 text-white/70" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-white">
                              {classGroup.fullLabel}
                            </p>
                            <p className="truncate text-xs text-white/50">
                              {classGroup.grade.name} • {currentSubjectCount} subject
                              {currentSubjectCount === 1 ? "" : "s"} configured
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <DialogFooter className="gap-2 border-t border-white/10 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-white/10 bg-white/5 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={!subject || isLoading || assignSubjects.isPending}
                className="bg-linear-to-r from-amber-300 to-orange-400 text-slate-950 hover:from-amber-200 hover:to-orange-300"
              >
                Save Assignments
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
