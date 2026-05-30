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
import { Badge } from "@/components/ui/badge";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { cn } from "@/lib/utils";
import { glassInsetClass, glassPrimaryButtonClass, glassSecondaryButtonClass } from "@/lib/ui/glass-surfaces";
import type { AssessmentPlanDTO, ComponentRule } from "@/types/academics/assessment-engine";
import {
  ASSESSMENT_PLAN_WIZARD_STEPS,
  buildAssessmentPlanPayload,
  createDefaultWizardState,
  MVP_CONTRIBUTION_MODE_OPTIONS,
  planToWizardState,
  syncComponentRules,
  validateWizardStep,
  type AssessmentPlanWizardState,
} from "@/components/admin/academics/assessment-plans/assessment-plan-form";
import { useAcademicPeriods } from "@/hooks/admin/useAcademicPeriods";
import { useGradeOptions } from "@/hooks/admin/useGradeOptions";
import {
  useActivateAssessmentPlan,
  useCreateAssessmentPlan,
  useUpdateAssessmentPlan,
} from "@/hooks/admin/useAssessmentPlans";
import { useGradingPolicies } from "@/hooks/admin/useGradingPolicies";
import { useBusyToast } from "@/hooks/useBusyToast";

type AssessmentPlanWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan?: AssessmentPlanDTO | null;
  onCompleted?: () => void;
};

const STEP_ICONS = [Sparkles, CalendarRange, GraduationCap, SlidersHorizontal, BookOpenCheck];

export function AssessmentPlanWizard({
  open,
  onOpenChange,
  plan,
  onCompleted,
}: AssessmentPlanWizardProps) {
  const busy = useBusyToast();
  const isEditing = Boolean(plan?._id);
  const [currentStep, setCurrentStep] = React.useState(1);
  const [activateNow, setActivateNow] = React.useState(false);
  const [form, setForm] = React.useState<AssessmentPlanWizardState>(createDefaultWizardState());

  const { data: periodsData } = useAcademicPeriods();
  const { data: gradesData } = useGradeOptions();
  const { data: policiesData } = useGradingPolicies({ status: "all" });
  const createPlan = useCreateAssessmentPlan();
  const updatePlan = useUpdateAssessmentPlan();
  const activatePlan = useActivateAssessmentPlan();

  const periods = periodsData?.periods ?? [];
  const grades = gradesData ?? [];
  const policies = (policiesData?.data ?? []).filter((policy) => policy.status !== "archived");
  const selectedPolicy = policies.find((policy) => policy._id === form.gradingPolicyId) ?? null;

  const { data: classGroupsData, isLoading: classGroupsLoading } = useQuery({
    queryKey: ["assessment-plan-class-groups", form.appliesToGradeId],
    enabled: open && Boolean(form.appliesToGradeId),
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/class-groups/search?gradeId=${encodeURIComponent(form.appliesToGradeId)}&limit=50`,
        { cache: "no-store" }
      );
      const json = (await res.json()) as {
        success?: boolean;
        data?: Array<{ id: string; label: string; name: string }>;
      };
      if (!res.ok || !json.success) throw new Error("Failed to load class groups");
      return json.data ?? [];
    },
  });

  React.useEffect(() => {
    if (!open) return;
    setCurrentStep(1);
    setActivateNow(false);
    setForm(plan ? planToWizardState(plan) : createDefaultWizardState());
  }, [open, plan]);

  React.useEffect(() => {
    if (!selectedPolicy) return;
    setForm((current) => ({
      ...current,
      componentRules: syncComponentRules(selectedPolicy, current.componentRules),
    }));
  }, [selectedPolicy?._id]);

  const stepMeta = ASSESSMENT_PLAN_WIZARD_STEPS[currentStep - 1];
  const StepIcon = STEP_ICONS[currentStep - 1] ?? Sparkles;
  const progressPercent = Math.round((currentStep / ASSESSMENT_PLAN_WIZARD_STEPS.length) * 100);

  function updateForm(patch: Partial<AssessmentPlanWizardState>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function updateRule(componentKey: string, patch: Partial<ComponentRule>) {
    setForm((current) => ({
      ...current,
      componentRules: current.componentRules.map((rule) =>
        rule.componentKey === componentKey ? { ...rule, ...patch } : rule
      ),
    }));
  }

  function toggleClassGroup(classGroupId: string) {
    setForm((current) => ({
      ...current,
      appliesToClassGroupIds: current.appliesToClassGroupIds.includes(classGroupId)
        ? current.appliesToClassGroupIds.filter((id) => id !== classGroupId)
        : [...current.appliesToClassGroupIds, classGroupId],
    }));
  }

  function goNext() {
    const error = validateWizardStep(currentStep, form, selectedPolicy);
    if (error) {
      busy.error(error);
      return;
    }
    setCurrentStep((step) => Math.min(step + 1, ASSESSMENT_PLAN_WIZARD_STEPS.length));
  }

  function goBack() {
    setCurrentStep((step) => Math.max(step - 1, 1));
  }

  async function handleSubmit() {
    for (let step = 1; step <= 4; step += 1) {
      const error = validateWizardStep(step, form, selectedPolicy);
      if (error) {
        busy.error(error);
        setCurrentStep(step);
        return;
      }
    }

    const payload = buildAssessmentPlanPayload(form);

    try {
      const saved = await busy.promise(
        isEditing && plan?._id
          ? updatePlan.mutateAsync({ id: plan._id, input: payload })
          : createPlan.mutateAsync(payload),
        {
          loading: isEditing ? "Saving assessment plan…" : "Creating assessment plan…",
          success: isEditing ? "Assessment plan saved." : "Assessment plan created.",
          error: (error) => error.message,
        }
      );

      if (activateNow) {
        await busy.promise(activatePlan.mutateAsync(saved._id), {
          loading: "Activating assessment plan…",
          success: "Assessment plan activated.",
          error: (error) => error.message,
        });
      }

      onCompleted?.();
      onOpenChange(false);
    } catch {
      // handled by busy.promise
    }
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Edit assessment plan" : "Create assessment plan"}
      description="Set up how marks contribute to report cards for a grade and term."
      className="max-w-3xl border-white/10 bg-slate-950 text-white"
    >
      <div className="space-y-5">
        <div className={cn(glassInsetClass, "p-4")}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-teal-400/20 bg-teal-500/10">
                <StepIcon className="h-5 w-5 text-teal-200" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  Step {currentStep} of {ASSESSMENT_PLAN_WIZARD_STEPS.length}: {stepMeta.title}
                </p>
                <p className="text-xs text-white/55">{stepMeta.description}</p>
              </div>
            </div>
            <Badge variant="outline" className="border-white/10 bg-white/5 text-white/70">
              {progressPercent}%
            </Badge>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-linear-to-r from-teal-400 to-cyan-400 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {currentStep === 1 ? (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="plan-name">Plan name</Label>
              <Input
                id="plan-name"
                value={form.name}
                onChange={(event) => updateForm({ name: event.target.value })}
                placeholder="JHS 1 Term 1 Assessment Plan"
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["teacherCanCreateReportItems", "Teachers can create report items", form.teacherCanCreateReportItems],
                ["teacherCanMarkItemsAsReportContributing", "Teachers can mark report contributions", form.teacherCanMarkItemsAsReportContributing],
                ["allowOfflineMarks", "Allow offline marks", form.allowOfflineMarks],
                ["allowAppAssignmentImport", "Allow app assignment import", form.allowAppAssignmentImport],
              ].map(([key, label, checked]) => (
                <label
                  key={key}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  <span className="text-sm text-white/75">{label}</span>
                  <Switch
                    checked={checked as boolean}
                    onCheckedChange={(value) => updateForm({ [key]: value } as Partial<AssessmentPlanWizardState>)}
                  />
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {currentStep === 2 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Academic period</Label>
              <PremiumSelect
                value={form.academicPeriodId || undefined}
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
            <div className="grid gap-2">
              <Label>Grading policy</Label>
              <PremiumSelect
                value={form.gradingPolicyId || undefined}
                onValueChange={(value) => updateForm({ gradingPolicyId: value })}
              >
                <PremiumSelectTrigger>
                  <PremiumSelectValue placeholder="Select policy" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  {policies.map((policy) => (
                    <PremiumSelectItem key={policy._id} value={policy._id}>
                      {policy.name} ({policy.status})
                    </PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>
            </div>
            {selectedPolicy ? (
              <div className="sm:col-span-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/65">
                {selectedPolicy.scoreComponents
                  .map((component) => `${component.label} ${component.weight}%`)
                  .join(" · ")}
                {selectedPolicy.status !== "active" ? (
                  <p className="mt-2 text-xs text-amber-200">
                    This policy is not active yet. You can save the plan as draft, but activation requires an active policy.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {currentStep === 3 ? (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Grade</Label>
              <PremiumSelect
                value={form.appliesToGradeId || undefined}
                onValueChange={(value) =>
                  updateForm({ appliesToGradeId: value, appliesToClassGroupIds: [] })
                }
              >
                <PremiumSelectTrigger>
                  <PremiumSelectValue placeholder="Select grade" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  {grades.map((grade) => (
                    <PremiumSelectItem key={grade._id} value={grade._id}>
                      {grade.name}
                    </PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>
            </div>
            <div>
              <Label className="mb-2 block">Class groups</Label>
              {classGroupsLoading ? (
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading class groups…
                </div>
              ) : !form.appliesToGradeId ? (
                <p className="text-sm text-white/55">Select a grade first.</p>
              ) : (classGroupsData?.length ?? 0) === 0 ? (
                <p className="text-sm text-white/55">No active class groups found for this grade.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {classGroupsData?.map((classGroup) => {
                    const selected = form.appliesToClassGroupIds.includes(classGroup.id);
                    return (
                      <button
                        key={classGroup.id}
                        type="button"
                        onClick={() => toggleClassGroup(classGroup.id)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-sm transition",
                          selected
                            ? "border-teal-400/30 bg-teal-500/15 text-teal-100"
                            : "border-white/10 bg-white/5 text-white/65 hover:bg-white/10"
                        )}
                      >
                        {classGroup.label || classGroup.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {currentStep === 4 && selectedPolicy ? (
          <div className="space-y-4">
            <p className="text-sm text-white/60">
              Choose how each score component collects marks. Use teacher-selected when staff should pick contributing items, or a rule-based mode when the system should decide automatically.
            </p>
            {selectedPolicy.scoreComponents.map((component) => {
              const rule =
                form.componentRules.find((entry) => entry.componentKey === component.key) ??
                ({ componentKey: component.key, contributionMode: "average_all" } as ComponentRule);
              const selectedMode = MVP_CONTRIBUTION_MODE_OPTIONS.find(
                (option) => option.value === rule.contributionMode
              );

              return (
                <div key={component.key} className={cn(glassInsetClass, "p-4")}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-white">{component.label}</p>
                      <p className="text-xs text-white/50">Weight {component.weight}%</p>
                    </div>
                    <Badge variant="outline" className="border-white/10 bg-white/5 text-white/70">
                      {selectedMode?.group === "teacher" ? "Teacher selected" : "Rule-based"}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-2">
                    <Label>Contribution mode</Label>
                    <PremiumSelect
                      value={rule.contributionMode}
                      onValueChange={(value) =>
                        updateRule(component.key, {
                          contributionMode: value as ComponentRule["contributionMode"],
                        })
                      }
                    >
                      <PremiumSelectTrigger>
                        <PremiumSelectValue placeholder="Select mode" />
                      </PremiumSelectTrigger>
                      <PremiumSelectContent>
                        {MVP_CONTRIBUTION_MODE_OPTIONS.map((option) => (
                          <PremiumSelectItem key={option.value} value={option.value}>
                            {option.label}
                          </PremiumSelectItem>
                        ))}
                      </PremiumSelectContent>
                    </PremiumSelect>
                    {selectedMode ? (
                      <p className="text-xs text-white/50">{selectedMode.help}</p>
                    ) : null}
                  </div>

                  {rule.contributionMode === "teacher_selected" ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label>Minimum items</Label>
                        <Input
                          type="number"
                          min={0}
                          value={rule.minItems ?? ""}
                          onChange={(event) =>
                            updateRule(component.key, {
                              minItems: event.target.value ? Number(event.target.value) : undefined,
                            })
                          }
                          className="border-white/10 bg-white/5 text-white"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Maximum items</Label>
                        <Input
                          type="number"
                          min={0}
                          value={rule.maxItems ?? ""}
                          onChange={(event) =>
                            updateRule(component.key, {
                              maxItems: event.target.value ? Number(event.target.value) : undefined,
                            })
                          }
                          className="border-white/10 bg-white/5 text-white"
                        />
                      </div>
                    </div>
                  ) : null}

                  {rule.contributionMode === "best_n" ? (
                    <div className="mt-3 grid gap-2">
                      <Label>Best N</Label>
                      <Input
                        type="number"
                        min={1}
                        value={rule.bestN ?? ""}
                        onChange={(event) =>
                          updateRule(component.key, {
                            bestN: event.target.value ? Number(event.target.value) : undefined,
                          })
                        }
                        className="border-white/10 bg-white/5 text-white"
                      />
                    </div>
                  ) : null}

                  {rule.contributionMode === "fixed_required_item" ? (
                    <div className="mt-3 grid gap-2">
                      <Label>Required assessment types</Label>
                      <Input
                        value={(rule.requiredAssessmentTypes ?? []).join(", ")}
                        onChange={(event) =>
                          updateRule(component.key, {
                            requiredAssessmentTypes: event.target.value
                              .split(",")
                              .map((entry) => entry.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="exam, mock"
                        className="border-white/10 bg-white/5 text-white"
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        {currentStep === 5 ? (
          <div className="space-y-4">
            <div className={cn(glassInsetClass, "space-y-3 p-4 text-sm text-white/75")}>
              <p><span className="text-white/45">Name:</span> {form.name}</p>
              <p><span className="text-white/45">Period:</span> {periods.find((p) => p._id === form.academicPeriodId)?.yearLabel} · {periods.find((p) => p._id === form.academicPeriodId)?.term}</p>
              <p><span className="text-white/45">Policy:</span> {selectedPolicy?.name}</p>
              <p><span className="text-white/45">Grade:</span> {grades.find((g) => g._id === form.appliesToGradeId)?.name}</p>
              <p><span className="text-white/45">Class groups:</span> {form.appliesToClassGroupIds.length}</p>
              <div>
                <p className="text-white/45">Component rules</p>
                <ul className="mt-2 space-y-1">
                  {form.componentRules.map((rule) => {
                    const component = selectedPolicy?.scoreComponents.find(
                      (entry) => entry.key === rule.componentKey
                    );
                    const mode = MVP_CONTRIBUTION_MODE_OPTIONS.find(
                      (option) => option.value === rule.contributionMode
                    );
                    return (
                      <li key={rule.componentKey}>
                        {component?.label ?? rule.componentKey}: {mode?.label ?? rule.contributionMode}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
            <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-white">Activate after saving</p>
                <p className="text-xs text-white/55">
                  Requires an active grading policy. Overlapping active plans will be archived.
                </p>
              </div>
              <Switch checked={activateNow} onCheckedChange={setActivateNow} />
            </label>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <Button
            type="button"
            variant="outline"
            className={glassSecondaryButtonClass}
            onClick={() => (currentStep === 1 ? onOpenChange(false) : goBack())}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            {currentStep === 1 ? "Cancel" : "Back"}
          </Button>

          {currentStep < ASSESSMENT_PLAN_WIZARD_STEPS.length ? (
            <Button type="button" className={glassPrimaryButtonClass} onClick={goNext}>
              Continue
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              className={glassPrimaryButtonClass}
              onClick={() => void handleSubmit()}
              disabled={createPlan.isPending || updatePlan.isPending || activatePlan.isPending}
            >
              {(createPlan.isPending || updatePlan.isPending || activatePlan.isPending) ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              {isEditing ? "Save plan" : "Create plan"}
            </Button>
          )}
        </div>
      </div>
    </ResponsiveModal>
  );
}
