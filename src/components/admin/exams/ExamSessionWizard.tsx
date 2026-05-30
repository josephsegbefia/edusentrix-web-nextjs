"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpenCheck,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Loader2,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { cn } from "@/lib/utils";
import {
  glassInsetClass,
  glassPrimaryButtonClass,
  glassSecondaryButtonClass,
} from "@/lib/ui/glass-surfaces";
import type { ExamSessionDTO } from "@/types/academics/exam-scheduling-engine";
import {
  EXAM_SESSION_WIZARD_STEPS,
  EXAM_TYPE_OPTIONS,
  buildExamSessionPayload,
  createDefaultExamSessionWizardState,
  formatExamType,
  sessionToWizardState,
  validateExamSessionWizardStep,
  type ExamSessionWizardState,
} from "@/components/admin/exams/exam-session-form";
import { useAcademicPeriods } from "@/hooks/admin/useAcademicPeriods";
import { useGradeOptions } from "@/hooks/admin/useGradeOptions";
import {
  useCreateExamSession,
  useUpdateExamSession,
} from "@/hooks/admin/useExamSessions";
import { useBusyToast } from "@/hooks/useBusyToast";

type ExamSessionWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session?: ExamSessionDTO | null;
  onCompleted?: () => void;
};

const STEP_ICONS = [Sparkles, CalendarRange, GraduationCap, SlidersHorizontal, BookOpenCheck];

export function ExamSessionWizard({
  open,
  onOpenChange,
  session,
  onCompleted,
}: ExamSessionWizardProps) {
  const busy = useBusyToast();
  const isEditing = Boolean(session?.id);
  const [currentStep, setCurrentStep] = React.useState(1);
  const [form, setForm] = React.useState<ExamSessionWizardState>(
    createDefaultExamSessionWizardState()
  );

  const { data: periodsData } = useAcademicPeriods();
  const { data: gradesData } = useGradeOptions();
  const createSession = useCreateExamSession();
  const updateSession = useUpdateExamSession();

  const periods = periodsData?.periods ?? [];
  const grades = gradesData ?? [];

  const { data: classGroupsData, isLoading: classGroupsLoading } = useQuery({
    queryKey: ["exam-session-class-groups", form.appliesToGradeIds.join(",")],
    enabled: open && form.appliesToGradeIds.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        form.appliesToGradeIds.map(async (gradeId) => {
          const res = await fetch(
            `/api/admin/class-groups/search?gradeId=${encodeURIComponent(gradeId)}&limit=50`,
            { cache: "no-store" }
          );
          const json = (await res.json()) as {
            success?: boolean;
            data?: Array<{ id: string; label: string; name: string }>;
          };
          if (!res.ok || !json.success) throw new Error("Failed to load class groups");
          return json.data ?? [];
        })
      );
      const merged = new Map<string, { id: string; label: string; name: string }>();
      for (const group of results.flat()) {
        merged.set(group.id, group);
      }
      return Array.from(merged.values());
    },
  });

  React.useEffect(() => {
    if (!open) return;
    setCurrentStep(1);
    setForm(session ? sessionToWizardState(session) : createDefaultExamSessionWizardState());
  }, [open, session]);

  const selectedPeriod = periods.find((period) => period._id === form.academicPeriodId);
  const classGroups = classGroupsData ?? [];

  function updateForm(patch: Partial<ExamSessionWizardState>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function toggleGrade(gradeId: string) {
    setForm((prev) => {
      const exists = prev.appliesToGradeIds.includes(gradeId);
      const appliesToGradeIds = exists
        ? prev.appliesToGradeIds.filter((id) => id !== gradeId)
        : [...prev.appliesToGradeIds, gradeId];
      return { ...prev, appliesToGradeIds };
    });
  }

  function toggleClassGroup(classGroupId: string) {
    setForm((prev) => {
      const exists = prev.appliesToClassGroupIds.includes(classGroupId);
      const appliesToClassGroupIds = exists
        ? prev.appliesToClassGroupIds.filter((id) => id !== classGroupId)
        : [...prev.appliesToClassGroupIds, classGroupId];
      return { ...prev, appliesToClassGroupIds };
    });
  }

  function goNext() {
    const error = validateExamSessionWizardStep(currentStep, form);
    if (error) {
      busy.error(error);
      return;
    }
    setCurrentStep((step) => Math.min(step + 1, EXAM_SESSION_WIZARD_STEPS.length));
  }

  function goBack() {
    setCurrentStep((step) => Math.max(step - 1, 1));
  }

  async function handleSubmit() {
    for (let step = 1; step <= 2; step += 1) {
      const error = validateExamSessionWizardStep(step, form);
      if (error) {
        busy.error(error);
        setCurrentStep(step);
        return;
      }
    }

    const payload = buildExamSessionPayload(form);
    const promise = isEditing
      ? updateSession.mutateAsync({ id: session!.id, input: payload })
      : createSession.mutateAsync(payload);

    await busy.promise(promise, {
      loading: isEditing ? "Updating exam session…" : "Creating exam session…",
      success: isEditing ? "Exam session updated" : "Exam session created",
      error: (error) =>
        error instanceof Error ? error.message : "Could not save exam session",
    });

    onOpenChange(false);
    onCompleted?.();
  }

  const isSaving = createSession.isPending || updateSession.isPending;
  const StepIcon = STEP_ICONS[currentStep - 1] ?? Sparkles;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Edit exam session" : "Create exam session"}
      description="Set up an exam session before building the timetable."
    >
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {EXAM_SESSION_WIZARD_STEPS.map((step) => (
            <div
              key={step.id}
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                currentStep === step.id
                  ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-100"
                  : "border-white/10 bg-white/5 text-white/50"
              )}
            >
              {step.id}. {step.title}
            </div>
          ))}
        </div>

        <div className={cn(glassInsetClass, "p-4")}>
          <div className="mb-4 flex items-center gap-2 text-sm text-white/70">
            <StepIcon className="h-4 w-4 text-cyan-300" />
            {EXAM_SESSION_WIZARD_STEPS[currentStep - 1]?.description}
          </div>

          {currentStep === 1 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="exam-session-name">Session name</Label>
                <Input
                  id="exam-session-name"
                  value={form.name}
                  onChange={(event) => updateForm({ name: event.target.value })}
                  placeholder="2025/2026 Term 3 End of Term Exams"
                />
              </div>
              <div className="space-y-2">
                <Label>Exam type</Label>
                <PremiumSelect
                  value={form.examType}
                  onValueChange={(value) =>
                    updateForm({ examType: value as ExamSessionWizardState["examType"] })
                  }
                >
                  <PremiumSelectTrigger>
                    <PremiumSelectValue placeholder="Select type" />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    {EXAM_TYPE_OPTIONS.map((option) => (
                      <PremiumSelectItem key={option.value} value={option.value}>
                        {option.label}
                      </PremiumSelectItem>
                    ))}
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="exam-session-code">Code (optional)</Label>
                <Input
                  id="exam-session-code"
                  value={form.code}
                  onChange={(event) => updateForm({ code: event.target.value })}
                  placeholder="EOT-T3-2026"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Academic period</Label>
                <PremiumSelect
                  value={form.academicPeriodId}
                  onValueChange={(value) => updateForm({ academicPeriodId: value })}
                >
                  <PremiumSelectTrigger>
                    <PremiumSelectValue placeholder="Select period" />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    {periods.map((period) => (
                      <PremiumSelectItem key={period._id} value={period._id}>
                        {period.yearLabel} · {period.term}
                        {period.isCurrent ? " (Current)" : ""}
                      </PremiumSelectItem>
                    ))}
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>
              <div className="space-y-2">
                <CustomDatePicker
                  label="Start date"
                  value={form.startDate ? new Date(`${form.startDate}T00:00:00`) : null}
                  onChange={(date) =>
                    updateForm({
                      startDate: date ? date.toISOString().slice(0, 10) : "",
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <CustomDatePicker
                  label="End date"
                  value={form.endDate ? new Date(`${form.endDate}T00:00:00`) : null}
                  onChange={(date) =>
                    updateForm({
                      endDate: date ? date.toISOString().slice(0, 10) : "",
                    })
                  }
                />
              </div>
            </div>
          ) : null}

          {currentStep === 2 ? (
            <div className="space-y-5">
              <div>
                <Label className="mb-2 block">Grades</Label>
                <div className="flex flex-wrap gap-2">
                  {grades.map((grade) => {
                    const selected = form.appliesToGradeIds.includes(grade._id);
                    return (
                      <button
                        key={grade._id}
                        type="button"
                        onClick={() => toggleGrade(grade._id)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-sm transition",
                          selected
                            ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-100"
                            : "border-white/10 bg-white/5 text-white/60 hover:text-white"
                        )}
                      >
                        {grade.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Class groups</Label>
                {classGroupsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-white/50">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading class groups…
                  </div>
                ) : form.appliesToGradeIds.length === 0 ? (
                  <p className="text-sm text-white/50">Select at least one grade first.</p>
                ) : classGroups.length === 0 ? (
                  <p className="text-sm text-white/50">No class groups found for selected grades.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {classGroups.map((group) => {
                      const selected = form.appliesToClassGroupIds.includes(group.id);
                      return (
                        <button
                          key={group.id}
                          type="button"
                          onClick={() => toggleClassGroup(group.id)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-sm transition",
                            selected
                              ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-100"
                              : "border-white/10 bg-white/5 text-white/60 hover:text-white"
                          )}
                        >
                          {group.label || group.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {currentStep === 3 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
                <div>
                  <p className="text-sm font-medium text-white">Parent/student visibility</p>
                  <p className="text-xs text-white/50">
                    When published, parents and students can see this exam timetable.
                  </p>
                </div>
                <Switch
                  checked={form.allowParentStudentVisibility}
                  onCheckedChange={(checked) =>
                    updateForm({ allowParentStudentVisibility: checked })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exam-session-notes">Notes (optional)</Label>
                <Textarea
                  id="exam-session-notes"
                  value={form.notes}
                  onChange={(event) => updateForm({ notes: event.target.value })}
                  placeholder="Any instructions for exam officers or admins."
                  rows={4}
                />
              </div>
            </div>
          ) : null}

          {currentStep === 4 ? (
            <div className="space-y-3 text-sm text-white/70">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                <div>
                  <p className="font-medium text-white">{form.name || "Untitled session"}</p>
                  <p>{formatExamType(form.examType)}</p>
                </div>
              </div>
              <p>
                Period:{" "}
                {selectedPeriod
                  ? `${selectedPeriod.yearLabel} · ${selectedPeriod.term}`
                  : "Not selected"}
              </p>
              <p>
                Dates: {form.startDate || "—"} to {form.endDate || "—"}
              </p>
              <p>
                Scope: {form.appliesToGradeIds.length} grade
                {form.appliesToGradeIds.length === 1 ? "" : "s"},{" "}
                {form.appliesToClassGroupIds.length} class group
                {form.appliesToClassGroupIds.length === 1 ? "" : "s"}
              </p>
              <p>
                Visibility:{" "}
                {form.allowParentStudentVisibility
                  ? "Parents and students can view when published"
                  : "Admin and staff only"}
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            className={glassSecondaryButtonClass}
            onClick={() => (currentStep === 1 ? onOpenChange(false) : goBack())}
            disabled={isSaving}
          >
            {currentStep === 1 ? (
              "Cancel"
            ) : (
              <>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </>
            )}
          </Button>

          {currentStep < EXAM_SESSION_WIZARD_STEPS.length ? (
            <Button type="button" className={glassPrimaryButtonClass} onClick={goNext}>
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              className={glassPrimaryButtonClass}
              onClick={() => void handleSubmit()}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : isEditing ? (
                "Save changes"
              ) : (
                "Create session"
              )}
            </Button>
          )}
        </div>
      </div>
    </ResponsiveModal>
  );
}
