"use client";

import * as React from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { GlassPanel } from "@/components/ui/glass-panel";
import { glassInsetClass, glassPrimaryButtonClass, glassSecondaryButtonClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";
import { COMPONENT_WEIGHT_TOTAL } from "@/constants/academics/assessment-engine";
import type { AcademicGradingPolicyDTO } from "@/types/academics/assessment-engine";
import {
  useCreateGradingPolicy,
  useUpdateGradingPolicy,
} from "@/hooks/admin/useGradingPolicies";
import { useBusyToast } from "@/hooks/useBusyToast";
import {
  COMMON_ASSESSMENT_TYPE_OPTIONS,
  createDefaultGradingPolicyForm,
  createEmptyBoundary,
  createEmptyComponent,
  GRADE_LABEL_MODE_OPTIONS,
  policyToFormState,
  ROUNDING_RULE_OPTIONS,
  slugifyComponentKey,
  sumComponentWeights,
  type GradingPolicyFormState,
} from "@/components/admin/academics/grading/grading-policy-form";

type GradingPolicyDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policy?: AcademicGradingPolicyDTO | null;
  onSaved?: (policy: AcademicGradingPolicyDTO) => void;
};

export function GradingPolicyDrawer({
  open,
  onOpenChange,
  policy,
  onSaved,
}: GradingPolicyDrawerProps) {
  const busy = useBusyToast();
  const createPolicy = useCreateGradingPolicy();
  const updatePolicy = useUpdateGradingPolicy();
  const [form, setForm] = React.useState<GradingPolicyFormState>(
    createDefaultGradingPolicyForm()
  );

  React.useEffect(() => {
    if (!open) return;
    setForm(policy ? policyToFormState(policy) : createDefaultGradingPolicyForm());
  }, [open, policy]);

  const weightTotal = sumComponentWeights(form.scoreComponents);
  const weightsValid = Math.abs(weightTotal - COMPONENT_WEIGHT_TOTAL) < 0.001;
  const isEditing = Boolean(policy?._id);
  const isArchived = policy?.status === "archived";
  const isSaving = createPolicy.isPending || updatePolicy.isPending;

  function updateForm(patch: Partial<GradingPolicyFormState>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function updateComponent(index: number, patch: Partial<GradingPolicyFormState["scoreComponents"][number]>) {
    setForm((current) => ({
      ...current,
      scoreComponents: current.scoreComponents.map((component, idx) =>
        idx === index ? { ...component, ...patch } : component
      ),
    }));
  }

  function updateBoundary(index: number, patch: Partial<GradingPolicyFormState["gradeBoundaries"][number]>) {
    setForm((current) => ({
      ...current,
      gradeBoundaries: current.gradeBoundaries.map((boundary, idx) =>
        idx === index ? { ...boundary, ...patch } : boundary
      ),
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) {
      busy.error("Policy name is required.");
      return;
    }

    const payload: GradingPolicyFormState = {
      ...form,
      name: form.name.trim(),
      description: form.description?.trim() || null,
      curriculumCode: form.curriculumCode?.trim() || null,
    };

    try {
      const saved = await busy.promise(
        isEditing && policy?._id
          ? updatePolicy.mutateAsync({ id: policy._id, input: payload })
          : createPolicy.mutateAsync(payload),
        {
          loading: isEditing ? "Saving grading policy…" : "Creating grading policy…",
          success: isEditing ? "Grading policy saved." : "Grading policy created.",
          error: (error) => error.message,
        }
      );
      onSaved?.(saved);
      onOpenChange(false);
    } catch {
      // toast handled by busy.promise
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full border-white/10 bg-slate-950 text-white sm:max-w-2xl"
      >
        <SheetHeader className="border-b border-white/10 pb-4">
          <SheetTitle className="text-white">
            {isEditing ? "Edit grading policy" : "Create grading policy"}
          </SheetTitle>
          <SheetDescription className="text-white/60">
            Define score breakdowns, grade labels, and report-card display rules.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex h-[calc(100%-5rem)] flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-1 py-4">
            <GlassPanel glow="teal" className="p-4">
              <h3 className="text-sm font-semibold text-white">Policy details</h3>
              <div className="mt-4 grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="policy-name">Name</Label>
                  <Input
                    id="policy-name"
                    value={form.name}
                    onChange={(event) => updateForm({ name: event.target.value })}
                    placeholder="Primary Term Grading Policy"
                    disabled={isArchived}
                    className="border-white/10 bg-white/5 text-white"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="policy-description">Description</Label>
                  <Textarea
                    id="policy-description"
                    value={form.description ?? ""}
                    onChange={(event) => updateForm({ description: event.target.value })}
                    placeholder="Used for primary and JHS report cards."
                    disabled={isArchived}
                    className="min-h-20 border-white/10 bg-white/5 text-white"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Grade label mode</Label>
                    <PremiumSelect
                      value={form.gradeLabelMode}
                      onValueChange={(value) =>
                        updateForm({ gradeLabelMode: value as GradingPolicyFormState["gradeLabelMode"] })
                      }
                      disabled={isArchived}
                    >
                      <PremiumSelectTrigger>
                        <PremiumSelectValue placeholder="Select mode" />
                      </PremiumSelectTrigger>
                      <PremiumSelectContent>
                        {GRADE_LABEL_MODE_OPTIONS.map((option) => (
                          <PremiumSelectItem key={option.value} value={option.value}>
                            {option.label}
                          </PremiumSelectItem>
                        ))}
                      </PremiumSelectContent>
                    </PremiumSelect>
                  </div>
                  <div className="grid gap-2">
                    <Label>Rounding rule</Label>
                    <PremiumSelect
                      value={form.roundingRule}
                      onValueChange={(value) =>
                        updateForm({ roundingRule: value as GradingPolicyFormState["roundingRule"] })
                      }
                      disabled={isArchived}
                    >
                      <PremiumSelectTrigger>
                        <PremiumSelectValue placeholder="Select rounding" />
                      </PremiumSelectTrigger>
                      <PremiumSelectContent>
                        {ROUNDING_RULE_OPTIONS.map((option) => (
                          <PremiumSelectItem key={option.value} value={option.value}>
                            {option.label}
                          </PremiumSelectItem>
                        ))}
                      </PremiumSelectContent>
                    </PremiumSelect>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="pass-mark">Pass mark (%)</Label>
                    <Input
                      id="pass-mark"
                      type="number"
                      min={0}
                      max={100}
                      value={form.passMark}
                      onChange={(event) =>
                        updateForm({ passMark: Number(event.target.value) || 0 })
                      }
                      disabled={isArchived}
                      className="border-white/10 bg-white/5 text-white"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="curriculum-code">Curriculum code (optional)</Label>
                    <Input
                      id="curriculum-code"
                      value={form.curriculumCode ?? ""}
                      onChange={(event) =>
                        updateForm({ curriculumCode: event.target.value || null })
                      }
                      placeholder="ghana_nacca"
                      disabled={isArchived}
                      className="border-white/10 bg-white/5 text-white"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-white">Default school policy</p>
                    <p className="text-xs text-white/55">
                      Use when no grade-specific policy matches.
                    </p>
                  </div>
                  <Switch
                    checked={form.isDefault ?? false}
                    onCheckedChange={(checked) => updateForm({ isDefault: checked })}
                    disabled={isArchived}
                  />
                </div>
              </div>
            </GlassPanel>

            <GlassPanel glow="cyan" className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">Score components</h3>
                  <p className="mt-1 text-xs text-white/55">
                    Weights must total {COMPONENT_WEIGHT_TOTAL}%.
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium",
                    weightsValid
                      ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                      : "border border-amber-500/30 bg-amber-500/10 text-amber-100"
                  )}
                >
                  Total: {weightTotal.toFixed(1)}%
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {form.scoreComponents.map((component, index) => (
                  <div key={`${component.key}-${index}`} className={cn(glassInsetClass, "p-3")}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label>Label</Label>
                        <Input
                          value={component.label}
                          onChange={(event) => {
                            const label = event.target.value;
                            updateComponent(index, {
                              label,
                              key: slugifyComponentKey(label) || component.key,
                            });
                          }}
                          disabled={isArchived}
                          className="border-white/10 bg-white/5 text-white"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Weight (%)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={component.weight}
                          onChange={(event) =>
                            updateComponent(index, {
                              weight: Number(event.target.value) || 0,
                            })
                          }
                          disabled={isArchived}
                          className="border-white/10 bg-white/5 text-white"
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {COMMON_ASSESSMENT_TYPE_OPTIONS.map((type) => {
                        const selected = component.allowedAssessmentTypes.includes(type);
                        return (
                          <button
                            key={type}
                            type="button"
                            disabled={isArchived}
                            onClick={() => {
                              const next = selected
                                ? component.allowedAssessmentTypes.filter((entry) => entry !== type)
                                : [...component.allowedAssessmentTypes, type];
                              updateComponent(index, { allowedAssessmentTypes: next });
                            }}
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-xs capitalize transition",
                              selected
                                ? "border-teal-400/30 bg-teal-500/15 text-teal-100"
                                : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                            )}
                          >
                            {type.replace(/_/g, " ")}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs text-white/70">
                        <Switch
                          checked={component.required}
                          onCheckedChange={(checked) =>
                            updateComponent(index, { required: checked })
                          }
                          disabled={isArchived}
                        />
                        Required component
                      </label>
                      {!isArchived && form.scoreComponents.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-rose-200 hover:bg-rose-500/10 hover:text-rose-100"
                          onClick={() =>
                            updateForm({
                              scoreComponents: form.scoreComponents.filter((_, idx) => idx !== index),
                            })
                          }
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              {!isArchived ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn("mt-3", glassSecondaryButtonClass)}
                  onClick={() =>
                    updateForm({
                      scoreComponents: [
                        ...form.scoreComponents,
                        createEmptyComponent(form.scoreComponents.length + 1),
                      ],
                    })
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add component
                </Button>
              ) : null}
            </GlassPanel>

            <GlassPanel className="p-4">
              <h3 className="text-sm font-semibold text-white">Grade boundaries</h3>
              <p className="mt-1 text-xs text-white/55">
                Define how final percentages map to grade labels.
              </p>
              <div className="mt-4 space-y-3">
                {form.gradeBoundaries.map((boundary, index) => (
                  <div key={`boundary-${index}`} className={cn(glassInsetClass, "p-3")}>
                    <div className="grid gap-3 sm:grid-cols-4">
                      <div className="grid gap-2 sm:col-span-1">
                        <Label>Label</Label>
                        <Input
                          value={boundary.gradeLabel}
                          onChange={(event) =>
                            updateBoundary(index, { gradeLabel: event.target.value })
                          }
                          disabled={isArchived}
                          className="border-white/10 bg-white/5 text-white"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Min %</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={boundary.minPercentage}
                          onChange={(event) =>
                            updateBoundary(index, {
                              minPercentage: Number(event.target.value) || 0,
                            })
                          }
                          disabled={isArchived}
                          className="border-white/10 bg-white/5 text-white"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Max %</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={boundary.maxPercentage}
                          onChange={(event) =>
                            updateBoundary(index, {
                              maxPercentage: Number(event.target.value) || 0,
                            })
                          }
                          disabled={isArchived}
                          className="border-white/10 bg-white/5 text-white"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Descriptor</Label>
                        <Input
                          value={boundary.descriptor ?? ""}
                          onChange={(event) =>
                            updateBoundary(index, {
                              descriptor: event.target.value || null,
                            })
                          }
                          disabled={isArchived}
                          className="border-white/10 bg-white/5 text-white"
                        />
                      </div>
                    </div>
                    {!isArchived && form.gradeBoundaries.length > 1 ? (
                      <div className="mt-3 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-rose-200 hover:bg-rose-500/10 hover:text-rose-100"
                          onClick={() =>
                            updateForm({
                              gradeBoundaries: form.gradeBoundaries.filter((_, idx) => idx !== index),
                            })
                          }
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Remove
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              {!isArchived ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn("mt-3", glassSecondaryButtonClass)}
                  onClick={() =>
                    updateForm({
                      gradeBoundaries: [...form.gradeBoundaries, createEmptyBoundary()],
                    })
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add boundary
                </Button>
              ) : null}
            </GlassPanel>
          </div>

          <SheetFooter className="border-t border-white/10 pt-4">
            <Button
              type="button"
              variant="outline"
              className={glassSecondaryButtonClass}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isArchived || isSaving || !weightsValid}
              className={glassPrimaryButtonClass}
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing ? "Save policy" : "Create policy"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
