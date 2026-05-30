"use client";

import * as React from "react";
import { Loader2, Smartphone } from "lucide-react";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import {
  ASSESSMENT_SOURCE_TYPE_LABELS,
  CONTRIBUTION_MODE_LABELS,
} from "@/constants/academics/assessment-engine";
import {
  buildCreateAssessmentItemPayload,
  createDefaultItemFormState,
  getAssessmentTypeOptions,
  itemToFormState,
  validateAssessmentItemForm,
  type AssessmentItemFormState,
} from "@/components/teacher/marks/assessment-item-form";
import {
  useCreateAssessmentItem,
  useUpdateAssessmentItem,
} from "@/hooks/teacher/useTeacherAssessmentItems";
import { useBusyToast } from "@/hooks/useBusyToast";
import {
  getComponentContributionUi,
  humanizeAssessmentType,
} from "@/lib/academics/assessment-engine/assessment-item-rules";
import {
  glassInsetClass,
  glassPrimaryButtonClass,
  glassSecondaryButtonClass,
} from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";
import type { AssessmentItemDTO, TeacherGradebookV2DTO } from "@/types/academics/assessment-engine";

type AssessmentItemDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gradebook: TeacherGradebookV2DTO;
  classGroupId: string;
  subjectId: string;
  item?: AssessmentItemDTO | null;
  onSaved?: () => void;
};

export function AssessmentItemDrawer({
  open,
  onOpenChange,
  gradebook,
  classGroupId,
  subjectId,
  item,
  onSaved,
}: AssessmentItemDrawerProps) {
  const busy = useBusyToast();
  const isEditing = Boolean(item?._id);
  const createItem = useCreateAssessmentItem();
  const updateItem = useUpdateAssessmentItem();
  const [form, setForm] = React.useState<AssessmentItemFormState>(
    createDefaultItemFormState(gradebook)
  );

  const plan = gradebook.assessmentPlan;
  const policy = gradebook.gradingPolicy;
  const components = policy?.scoreComponents ?? [];

  React.useEffect(() => {
    if (!open) return;
    setForm(item ? itemToFormState(item) : createDefaultItemFormState(gradebook));
  }, [open, item, gradebook]);

  const typeOptions = getAssessmentTypeOptions(gradebook, form.componentKey);
  const contributionUi =
    plan && form.componentKey
      ? getComponentContributionUi({
          componentKey: form.componentKey,
          assessmentType: form.assessmentType,
          title: form.title,
          requestedContributesToReport: form.contributesToReport,
          assessmentPlan: plan,
        })
      : null;

  React.useEffect(() => {
    if (!contributionUi || contributionUi.canToggleContribution) return;
    if (form.contributesToReport === contributionUi.contributesToReport) return;
    setForm((current) => ({
      ...current,
      contributesToReport: contributionUi.contributesToReport,
    }));
  }, [contributionUi, form.contributesToReport]);

  React.useEffect(() => {
    if (typeOptions.includes(form.assessmentType)) return;
    if (typeOptions.length === 0) return;
    setForm((current) => ({ ...current, assessmentType: typeOptions[0] }));
  }, [form.assessmentType, typeOptions]);

  function updateForm(patch: Partial<AssessmentItemFormState>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  async function handleSubmit() {
    const error = validateAssessmentItemForm(form);
    if (error) {
      busy.error(error);
      return;
    }

    if (!plan?.allowOfflineMarks && !isEditing) {
      busy.error("This assessment plan does not allow offline/manual items.");
      return;
    }

    try {
      if (isEditing && item?._id) {
        await busy.promise(
          updateItem.mutateAsync({
            id: item._id,
            classGroupId,
            subjectId,
            input: {
              title: form.title.trim(),
              description: form.description.trim() ? form.description.trim() : null,
              assessmentType: form.assessmentType,
              maxScore: form.maxScore,
              componentKey: form.componentKey || null,
              contributesToReport: contributionUi?.contributesToReport ?? form.contributesToReport,
              assessedAt: form.assessedAt ? form.assessedAt.toISOString() : null,
              status: form.status,
            },
          }),
          {
            loading: "Saving assessment item…",
            success: "Assessment item saved.",
            error: (err) => err.message,
          }
        );
      } else {
        await busy.promise(
          createItem.mutateAsync(
            buildCreateAssessmentItemPayload(gradebook, classGroupId, subjectId, {
              ...form,
              contributesToReport: contributionUi?.contributesToReport ?? form.contributesToReport,
            })
          ),
          {
            loading: "Creating assessment item…",
            success: "Assessment item created.",
            error: (err) => err.message,
          }
        );
      }

      onSaved?.();
      onOpenChange(false);
    } catch {
      // handled by busy.promise
    }
  }

  const selectedComponent = components.find((entry) => entry.key === form.componentKey);
  const pending = createItem.isPending || updateItem.isPending;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Edit assessment item" : "Create assessment item"}
      description="Add an offline assessment column for this class and subject."
      className="max-w-xl border-white/10 bg-slate-950 text-white"
    >
      <div className="space-y-4">
        <div className={cn(glassInsetClass, "p-3 text-sm text-white/60")}>
          <div className="flex items-start gap-3">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />
            <div>
              <p className="font-medium text-white/75">
                {ASSESSMENT_SOURCE_TYPE_LABELS.app_assignment}
              </p>
              <p className="mt-1 text-xs leading-5">
                Import from Teacher Studio is planned for a later slice. This form creates manual
                offline items only.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="item-title">Title</Label>
          <Input
            id="item-title"
            value={form.title}
            onChange={(event) => updateForm({ title: event.target.value })}
            placeholder="Week 3 Class Exercise"
            className="border-white/10 bg-white/5 text-white"
          />
        </div>

        <div className="grid gap-2">
          <Label>Score component</Label>
          <PremiumSelect
            value={form.componentKey || undefined}
            onValueChange={(value) => updateForm({ componentKey: value })}
          >
            <PremiumSelectTrigger>
              <PremiumSelectValue placeholder="Select component" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              {components.map((component) => (
                <PremiumSelectItem key={component.key} value={component.key}>
                  {component.label} ({component.weight}%)
                </PremiumSelectItem>
              ))}
            </PremiumSelectContent>
          </PremiumSelect>
          {selectedComponent ? (
            <p className="text-xs text-white/45">
              Allowed types:{" "}
              {selectedComponent.allowedAssessmentTypes.length > 0
                ? selectedComponent.allowedAssessmentTypes.join(", ")
                : "Any assessment type"}
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Assessment type</Label>
            <PremiumSelect
              value={form.assessmentType}
              onValueChange={(value) => updateForm({ assessmentType: value })}
            >
              <PremiumSelectTrigger>
                <PremiumSelectValue placeholder="Select type" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {typeOptions.map((type) => (
                  <PremiumSelectItem key={type} value={type}>
                    {humanizeAssessmentType(type)}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="item-max-score">Max score</Label>
            <Input
              id="item-max-score"
              type="number"
              min={1}
              value={form.maxScore}
              onChange={(event) =>
                updateForm({ maxScore: Number(event.target.value) || 0 })
              }
              className="border-white/10 bg-white/5 text-white"
            />
          </div>
        </div>

        <CustomDatePicker
          label="Assessed on"
          value={form.assessedAt}
          onChange={(date) => updateForm({ assessedAt: date })}
        />

        {contributionUi ? (
          <div className={cn(glassInsetClass, "space-y-3 p-3")}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-white">Contributes to report card</p>
                <p className="text-xs text-white/50">
                  {CONTRIBUTION_MODE_LABELS[contributionUi.mode] ?? contributionUi.mode}
                </p>
              </div>
              <Switch
                checked={contributionUi.contributesToReport}
                disabled={!contributionUi.canToggleContribution}
                onCheckedChange={(value) => updateForm({ contributesToReport: value })}
              />
            </div>
            <p className="text-xs leading-5 text-white/50">{contributionUi.helpText}</p>
          </div>
        ) : null}

        <div className="grid gap-2">
          <Label>Status</Label>
          <PremiumSelect
            value={form.status}
            onValueChange={(value) =>
              updateForm({ status: value as AssessmentItemFormState["status"] })
            }
          >
            <PremiumSelectTrigger>
              <PremiumSelectValue />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              <PremiumSelectItem value="draft">Draft</PremiumSelectItem>
              <PremiumSelectItem value="open">Open</PremiumSelectItem>
            </PremiumSelectContent>
          </PremiumSelect>
        </div>

        <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
          <Button
            type="button"
            variant="outline"
            className={glassSecondaryButtonClass}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className={glassPrimaryButtonClass}
            disabled={pending || (!plan?.allowOfflineMarks && !isEditing)}
            onClick={() => void handleSubmit()}
          >
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEditing ? "Save item" : "Create item"}
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}
