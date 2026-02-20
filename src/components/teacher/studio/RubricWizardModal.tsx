"use client";

import * as React from "react";
import { Check, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useBusyToast } from "@/hooks/useBusyToast";
import { Modal } from "@/components/ui/responsive-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type RubricWizardResult = {
  id: string;
  title: string;
  description: string | null;
  criteria: Array<{
    title: string;
    description?: string | null;
    maxScore: number;
    weight?: number | null;
  }>;
};

type RubricWizardModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (rubric: RubricWizardResult) => void;
};

type CriterionDraft = {
  title: string;
  description: string;
  maxScore: number;
  weight: number | null;
};

const EMPTY_CRITERION: CriterionDraft = {
  title: "",
  description: "",
  maxScore: 10,
  weight: null,
};

export function RubricWizardModal({
  open,
  onOpenChange,
  onCreated,
}: RubricWizardModalProps) {
  const busyToast = useBusyToast();
  const [step, setStep] = React.useState(1);
  const [isSaving, setIsSaving] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [criteria, setCriteria] = React.useState<CriterionDraft[]>([
    { ...EMPTY_CRITERION },
  ]);

  React.useEffect(() => {
    if (!open) return;
    setStep(1);
    setIsSaving(false);
    setTitle("");
    setDescription("");
    setCriteria([{ ...EMPTY_CRITERION }]);
  }, [open]);

  const updateCriterion = (index: number, patch: Partial<CriterionDraft>) => {
    setCriteria((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const addCriterion = () => {
    setCriteria((prev) => [...prev, { ...EMPTY_CRITERION }]);
  };

  const removeCriterion = (index: number) => {
    setCriteria((prev) => {
      if (prev.length <= 1) return prev;
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  };

  const isStepOneValid = title.trim().length > 0;
  const isStepTwoValid =
    criteria.length > 0 &&
    criteria.every((criterion) => criterion.title.trim().length > 0);

  const canNext = step === 1 ? isStepOneValid : step === 2 ? isStepTwoValid : true;

  const handleNext = () => {
    if (!canNext) return;
    setStep((prev) => Math.min(prev + 1, 3));
  };

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleCreate = async () => {
    if (!isStepOneValid || !isStepTwoValid) return;
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      criteria: criteria.map((criterion) => ({
        title: criterion.title.trim(),
        description: criterion.description.trim() || null,
        maxScore: Number(criterion.maxScore || 0),
        weight: criterion.weight ?? null,
      })),
    };

    setIsSaving(true);
    try {
      const result = await busyToast.promise(
        fetch("/api/teacher/studio/rubrics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).then(async (res) => {
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data?.error || "Failed to create rubric");
          }
          return data;
        }),
        {
          loading: "Creating rubric...",
          success: "Rubric created",
          error: "Failed to create rubric",
        }
      );

      const createdRubric = result?.data?.rubric as RubricWizardResult | undefined;
      if (createdRubric) {
        onCreated?.(createdRubric);
      }
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="New Rubric"
      description="Create a reusable grading rubric in guided steps."
      className="sm:max-w-3xl"
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="text-sm text-white/70">
            Step <span className="font-semibold">{step}</span> of 3
          </div>
          <div className="flex gap-1">
            {[1, 2, 3].map((item) => (
              <span
                key={item}
                className={`h-1.5 w-8 rounded-full transition-all ${
                  item <= step ? "bg-brand" : "bg-white/20"
                }`}
              />
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                Title
              </label>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Essay Writing Rubric"
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                Description
              </label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Optional context for this rubric"
                className="min-h-[90px] border-white/10 bg-white/5 text-white"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                Criteria
              </p>
              <Button
                type="button"
                variant="ghost"
                onClick={addCriterion}
                className="text-white/70 hover:bg-white/10"
              >
                <Plus className="h-4 w-4" />
                Add criterion
              </Button>
            </div>

            <div className="space-y-3">
              {criteria.map((criterion, index) => (
                <div
                  key={`criterion-${index}`}
                  className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-[1.2fr_1.4fr_0.6fr_0.6fr_auto]"
                >
                  <Input
                    value={criterion.title}
                    onChange={(event) =>
                      updateCriterion(index, { title: event.target.value })
                    }
                    placeholder="Criterion title"
                    className="border-white/10 bg-white/5 text-white"
                  />
                  <Input
                    value={criterion.description}
                    onChange={(event) =>
                      updateCriterion(index, { description: event.target.value })
                    }
                    placeholder="Description"
                    className="border-white/10 bg-white/5 text-white"
                  />
                  <Input
                    type="number"
                    min={0}
                    value={criterion.maxScore}
                    onChange={(event) =>
                      updateCriterion(index, {
                        maxScore: Math.max(0, Number(event.target.value || 0)),
                      })
                    }
                    className="border-white/10 bg-white/5 text-white"
                  />
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={criterion.weight ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      updateCriterion(index, {
                        weight: value === "" ? null : Number(value),
                      });
                    }}
                    placeholder="Weight %"
                    className="border-white/10 bg-white/5 text-white"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCriterion(index)}
                    className="text-white/60 hover:bg-white/10"
                    disabled={criteria.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/40">Title</p>
              <p className="mt-1 text-sm text-white">{title}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/40">Description</p>
              <p className="mt-1 text-sm text-white/75">
                {description || "No description"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/40">Criteria</p>
              <div className="mt-2 space-y-2">
                {criteria.map((criterion, index) => (
                  <div
                    key={`review-criterion-${index}`}
                    className="rounded-lg border border-white/10 bg-black/20 p-3"
                  >
                    <p className="text-sm font-medium text-white">{criterion.title}</p>
                    <p className="text-xs text-white/55">
                      Max score: {criterion.maxScore}
                      {criterion.weight !== null ? ` • Weight: ${criterion.weight}%` : ""}
                    </p>
                    {criterion.description ? (
                      <p className="mt-1 text-xs text-white/65">{criterion.description}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={step === 1 ? () => onOpenChange(false) : handleBack}
            className="border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
          >
            <ChevronLeft className="h-4 w-4" />
            {step === 1 ? "Cancel" : "Back"}
          </Button>

          {step < 3 ? (
            <Button
              type="button"
              onClick={handleNext}
              disabled={!canNext}
              className="bg-brand text-brand-foreground hover:bg-brand/90"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleCreate}
              disabled={isSaving || !isStepOneValid || !isStepTwoValid}
              className="bg-brand text-brand-foreground hover:bg-brand/90"
            >
              <Check className="h-4 w-4" />
              Create rubric
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
