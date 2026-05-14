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
import { Input } from "@/components/ui/input";
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
  Plus,
  ExternalLink,
} from "lucide-react";
import { useGrades } from "@/hooks/admin/useGrades";
import { useCreateCustomSubjectOffering, useSubjectOfferings } from "@/hooks/admin/useSubjectOfferings";
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
import { Label } from "@/components/ui/label";
import Link from "next/link";
import {
  deriveGradeBand,
  stageFromGradeBand,
} from "@/lib/subject-offerings/grade-bands";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";

type BulkGradeSubjectAssignmentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-select this grade when opening from grade detail page */
  initialGradeId?: string | null;
};

const GRADE_BAND_LABEL: Record<string, string> = {
  preschool: "Preschool / KG",
  lower_primary: "Lower primary",
  upper_primary: "Upper primary",
  jhs: "Junior High (JHS)",
  shs: "Senior High (SHS)",
  custom: "Custom band",
};

export function BulkGradeSubjectAssignmentModal({
  open,
  onOpenChange,
  initialGradeId,
}: BulkGradeSubjectAssignmentModalProps) {
  const [selectedGradeId, setSelectedGradeId] = React.useState<string | null>(null);
  const [selectedOfferingIds, setSelectedOfferingIds] = React.useState<string[]>([]);
  const [customOpen, setCustomOpen] = React.useState(false);
  const [customForm, setCustomForm] = React.useState({
    subjectFamily: "",
    displayName: "",
    shortName: "",
    code: "",
    curriculumCode: "ghana_nacca",
    category: "core" as "core" | "elective" | "optional" | "foundation" | "learning_area" | "co_curricular" | "custom",
  });
  const [autoAssignNewOffering, setAutoAssignNewOffering] = React.useState(true);

  const queryClient = useQueryClient();
  const busy = useBusyToast();

  React.useEffect(() => {
    if (open) {
      setSelectedGradeId(initialGradeId ?? null);
      setSelectedOfferingIds([]);
      setCustomOpen(false);
      setCustomForm({
        subjectFamily: "",
        displayName: "",
        shortName: "",
        code: "",
        curriculumCode: "ghana_nacca",
        category: "core",
      });
      setAutoAssignNewOffering(true);
    }
  }, [open, initialGradeId]);

  const { data: gradesData, isLoading: gradesLoading } = useGrades(true);
  const grades = gradesData?.data || [];

  const selectedGrade = grades.find((g) => g.id === selectedGradeId);
  const gradeBand = selectedGrade
    ? deriveGradeBand({
        code: selectedGrade.code,
        name: selectedGrade.name,
        stage: selectedGrade.stage,
        order: selectedGrade.order,
      })
    : null;

  const { data: offeringsData, isLoading: offeringsLoading } = useSubjectOfferings({
    gradeBand: gradeBand ?? undefined,
    isActive: true,
    enabled: open && !!selectedGradeId && !!gradeBand,
  });
  const offerings = offeringsData?.data ?? [];

  const { data: classesData, isLoading: classesLoading } = useClasses({
    gradeId: selectedGradeId || undefined,
    isActive: true,
  });
  const classesInGrade = classesData?.data || [];

  const createCustomOffering = useCreateCustomSubjectOffering();

  const bulkAssignMutation = useMutation({
    mutationFn: async ({
      classIds,
      offeringIds,
    }: {
      classIds: string[];
      offeringIds: string[];
    }) => {
      for (const offeringId of offeringIds) {
        const res = await fetch(
          `/api/admin/subject-offerings/${encodeURIComponent(offeringId)}/assign-class-groups`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              classGroupIds: classIds,
              allowIncompatible: true,
            }),
          }
        );
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(
            typeof json?.error === "string"
              ? json.error
              : `Failed to assign offering ${offeringId}`
          );
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["subject-offerings"] });
      queryClient.invalidateQueries({ queryKey: ["grade-overview"] });
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
    },
  });

  const toggleOffering = (offeringId: string) => {
    setSelectedOfferingIds((prev) =>
      prev.includes(offeringId)
        ? prev.filter((id) => id !== offeringId)
        : [...prev, offeringId]
    );
  };

  const selectAllOfferings = () => {
    setSelectedOfferingIds(offerings.map((o) => o.id));
  };

  const clearAllOfferings = () => {
    setSelectedOfferingIds([]);
  };

  const handleAssign = async () => {
    if (!selectedGradeId || selectedOfferingIds.length === 0 || classesInGrade.length === 0) {
      return;
    }
    const classIds = classesInGrade.map((c) => c.id);
    try {
      await busy.promise(
        bulkAssignMutation.mutateAsync({ classIds, offeringIds: selectedOfferingIds }),
        {
          loading: `Assigning ${selectedOfferingIds.length} offering${selectedOfferingIds.length !== 1 ? "s" : ""}…`,
          success: "Subject offerings assigned to all classes in this grade.",
          error: (e: Error) => e.message || "Failed to assign offerings",
        }
      );
      onOpenChange(false);
    } catch {
      // busy toast
    }
  };

  async function handleCreateCustom() {
    if (!selectedGradeId || !gradeBand) return;
    const subjectFamily = customForm.subjectFamily.trim();
    const displayName = customForm.displayName.trim() || subjectFamily;
    const shortName = customForm.shortName.trim() || subjectFamily;
    const code = customForm.code.trim().toUpperCase();
    if (!subjectFamily || !code) return;

    const stage = stageFromGradeBand(gradeBand);
    try {
      await createCustomOffering.mutateAsync({
        subjectFamily,
        displayName,
        shortName,
        code,
        curriculumCode: customForm.curriculumCode,
        stage,
        gradeBand,
        gradeIds: [selectedGradeId],
        category: customForm.category,
        lessonNoteTemplateVariant:
          gradeBand === "jhs"
            ? "nacca_jhs"
            : gradeBand === "preschool"
              ? "early_years_activity_plan"
              : gradeBand === "lower_primary" || gradeBand === "upper_primary"
                ? "nacca_primary"
                : "classic",
        reportCardGroup: customForm.category === "elective" ? "Electives" : null,
        autoAssignToMatchingClassGroups: autoAssignNewOffering,
      });
      setCustomForm((f) => ({
        ...f,
        subjectFamily: "",
        displayName: "",
        shortName: "",
        code: "",
      }));
    } catch {
      // hook shows error
    }
  }

  const canAssign =
    selectedGradeId &&
    selectedOfferingIds.length > 0 &&
    classesInGrade.length > 0 &&
    !bulkAssignMutation.isPending;

  const bandLabel = gradeBand ? GRADE_BAND_LABEL[gradeBand] ?? gradeBand : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border border-white/10 bg-linear-to-br from-slate-900 via-slate-950 to-black p-0 text-white shadow-2xl">
        <DialogHeader className="border-b border-white/10 p-6 pb-4">
          <DialogTitle className="flex items-center gap-3 text-xl font-bold">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20">
              <GraduationCap className="h-5 w-5 text-violet-300" />
            </div>
            Assign subject offerings to grade
          </DialogTitle>
          <p className="mt-2 text-sm text-white/60">
            Only offerings for this grade&apos;s band are listed. If the list is empty, define offerings on{" "}
            <Link href="/admin/subjects" className="text-violet-300 underline-offset-2 hover:underline">
              Subjects
            </Link>{" "}
            or create a custom offering below.
          </p>
        </DialogHeader>

        <div className="space-y-6 p-6">
          <div className="space-y-3">
            <Label className="text-sm font-medium text-white">1. Select grade</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-between border-white/15 bg-white/5 text-left hover:bg-white/10",
                    selectedGrade ? "text-white" : "text-white/50"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-violet-400" />
                    {selectedGrade?.name || "Select a grade"}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] border border-white/10 bg-slate-900/95 backdrop-blur-xl">
                <DropdownMenuLabel className="text-xs text-white/60">
                  Available grades
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
                        <span className="ml-2 text-xs text-white/50">({grade.stage})</span>
                      )}
                    </DropdownMenuCheckboxItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {selectedGradeId && gradeBand && (
              <p className="text-xs text-white/45">
                Grade band for subject catalog:{" "}
                <span className="font-medium text-violet-200/90">{bandLabel}</span>
              </p>
            )}

            {selectedGradeId && (
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="flex items-center gap-2 text-sm">
                  <School className="h-4 w-4 text-violet-400" />
                  <span className="text-white/70">Classes in this grade</span>
                </div>
                {classesLoading ? (
                  <div className="mt-2 flex items-center gap-2 text-xs text-white/50">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading classes…
                  </div>
                ) : classesInGrade.length === 0 ? (
                  <p className="mt-2 text-xs text-amber-400">No active classes in this grade</p>
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

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-sm font-medium text-white">2. Select subject offerings</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={selectAllOfferings}
                  disabled={!offerings.length}
                  className="h-7 text-xs text-white/60 hover:text-white"
                >
                  Select all
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearAllOfferings}
                  className="h-7 text-xs text-white/60 hover:text-white"
                >
                  Clear
                </Button>
                <Button type="button" variant="outline" size="sm" asChild className="h-7 border-white/15 text-xs">
                  <Link href="/admin/subjects" className="gap-1">
                    <ExternalLink className="h-3 w-3" />
                    Subjects
                  </Link>
                </Button>
              </div>
            </div>

            {!selectedGradeId ? (
              <p className="text-sm text-white/45">Choose a grade to load offerings for its band.</p>
            ) : offeringsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
              </div>
            ) : offerings.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-black/25 py-8 text-center">
                <AlertCircle className="mx-auto h-8 w-8 text-white/30" />
                <p className="mt-2 text-sm text-white/55">
                  No subject offerings for {bandLabel || "this band"} yet.
                </p>
                <p className="mt-1 text-xs text-white/40">
                  Set up curriculum offerings on Subjects, or add a custom offering below.
                </p>
              </div>
            ) : (
              <div className="grid max-h-[220px] gap-2 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-3 sm:grid-cols-2">
                {offerings.map((offering) => {
                  const isSelected = selectedOfferingIds.includes(offering.id);
                  return (
                    <label
                      key={offering.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 text-left transition-all",
                        isSelected
                          ? "border-violet-500/50 bg-violet-500/10"
                          : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleOffering(offering.id)}
                        className="h-4 w-4 border-white/30 data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-500"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-white">
                          {offering.displayName}
                        </span>
                        <span className="block text-[10px] text-white/50">
                          {offering.code}
                          {offering.shortName && offering.shortName !== offering.displayName
                            ? ` · ${offering.shortName}`
                            : ""}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {selectedOfferingIds.length > 0 && (
              <div className="rounded-lg bg-violet-500/10 p-3 text-sm text-violet-200">
                <strong>{selectedOfferingIds.length}</strong> offering
                {selectedOfferingIds.length !== 1 ? "s" : ""} selected
              </div>
            )}
          </div>

          {selectedGradeId && gradeBand && (
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/3 p-4">
              <button
                type="button"
                onClick={() => setCustomOpen((v) => !v)}
                className="flex w-full items-center justify-between text-left text-sm font-medium text-white"
              >
                <span className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-emerald-300" />
                  Create custom subject offering
                </span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", customOpen && "rotate-180")} />
              </button>
              {customOpen && (
                <div className="space-y-3 border-t border-white/10 pt-4">
                  <p className="text-xs text-white/45">
                    Creates an offering for <span className="text-white/70">{selectedGrade?.name}</span> ({bandLabel}
                    ). Required fields match the Subjects page.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs text-white/60">Subject family / name</Label>
                      <Input
                        value={customForm.subjectFamily}
                        onChange={(e) =>
                          setCustomForm((f) => ({ ...f, subjectFamily: e.target.value }))
                        }
                        placeholder="e.g. Computing"
                        className="border-white/10 bg-white/5 text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-white/60">Display name (optional)</Label>
                      <Input
                        value={customForm.displayName}
                        onChange={(e) =>
                          setCustomForm((f) => ({ ...f, displayName: e.target.value }))
                        }
                        placeholder="Defaults to family"
                        className="border-white/10 bg-white/5 text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-white/60">Short name (optional)</Label>
                      <Input
                        value={customForm.shortName}
                        onChange={(e) =>
                          setCustomForm((f) => ({ ...f, shortName: e.target.value }))
                        }
                        placeholder="Defaults to family"
                        className="border-white/10 bg-white/5 text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-white/60">Code</Label>
                      <Input
                        value={customForm.code}
                        onChange={(e) =>
                          setCustomForm((f) => ({
                            ...f,
                            code: e.target.value.toUpperCase(),
                          }))
                        }
                        placeholder="e.g. COMP"
                        className="border-white/10 bg-white/5 font-mono text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-white/60">Category</Label>
                      <PremiumSelect
                        value={customForm.category}
                        onValueChange={(v) =>
                          setCustomForm((f) => ({
                            ...f,
                            category: v as typeof f.category,
                          }))
                        }
                      >
                        <PremiumSelectTrigger className="border-white/10 bg-white/5">
                          <PremiumSelectValue />
                        </PremiumSelectTrigger>
                        <PremiumSelectContent>
                          <PremiumSelectItem value="core">Core</PremiumSelectItem>
                          <PremiumSelectItem value="elective">Elective</PremiumSelectItem>
                          <PremiumSelectItem value="optional">Optional</PremiumSelectItem>
                          <PremiumSelectItem value="foundation">Foundation</PremiumSelectItem>
                          <PremiumSelectItem value="learning_area">Learning area</PremiumSelectItem>
                          <PremiumSelectItem value="co_curricular">Co-curricular</PremiumSelectItem>
                          <PremiumSelectItem value="custom">Custom</PremiumSelectItem>
                        </PremiumSelectContent>
                      </PremiumSelect>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs text-white/60">Curriculum</Label>
                      <PremiumSelect
                        value={customForm.curriculumCode}
                        onValueChange={(v) =>
                          setCustomForm((f) => ({ ...f, curriculumCode: v }))
                        }
                      >
                        <PremiumSelectTrigger className="border-white/10 bg-white/5">
                          <PremiumSelectValue />
                        </PremiumSelectTrigger>
                        <PremiumSelectContent>
                          <PremiumSelectItem value="ghana_nacca">Ghana NaCCA</PremiumSelectItem>
                          <PremiumSelectItem value="custom">Custom</PremiumSelectItem>
                        </PremiumSelectContent>
                      </PremiumSelect>
                    </div>
                  </div>
                  <label className="flex cursor-pointer items-start gap-3 text-sm text-white/70">
                    <Checkbox
                      checked={autoAssignNewOffering}
                      onCheckedChange={(c) => setAutoAssignNewOffering(c === true)}
                      className="mt-0.5"
                    />
                    <span>
                      After creation, assign this offering to all classes in{" "}
                      <span className="text-white">{selectedGrade?.name}</span>.
                    </span>
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15"
                    disabled={
                      createCustomOffering.isPending ||
                      !customForm.subjectFamily.trim() ||
                      !customForm.code.trim()
                    }
                    onClick={() => void handleCreateCustom()}
                  >
                    {createCustomOffering.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating…
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Create offering
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          {selectedGradeId && selectedOfferingIds.length > 0 && classesInGrade.length > 0 && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20">
                  <BookOpen className="h-5 w-5 text-emerald-300" />
                </div>
                <div>
                  <p className="font-medium text-emerald-200">
                    Assign {selectedOfferingIds.length} offering
                    {selectedOfferingIds.length !== 1 ? "s" : ""} to {classesInGrade.length} class
                    {classesInGrade.length !== 1 ? "es" : ""}
                  </p>
                  <p className="text-xs text-emerald-300/70">
                    Classes in {selectedGrade?.name} receive the selected offerings (and base subjects).
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-white/10 p-6 pt-4">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-white/60 hover:text-white"
          >
            Cancel
          </Button>

          <Button
            onClick={() => void handleAssign()}
            disabled={!canAssign}
            className="gap-2 bg-linear-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20 hover:from-violet-600 hover:to-purple-700 disabled:opacity-50"
          >
            {bulkAssignMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Assigning…
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Assign to all classes
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
