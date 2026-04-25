"use client";

import * as React from "react";
import {
  ArrowRight,
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  GraduationCap,
  Layers3,
  Loader2,
  MapPin,
  Sparkles,
  Wand2,
} from "lucide-react";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { LeoIcon } from "@/components/icons/LeoIcon";
import { cn } from "@/lib/utils";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useAcademicPeriods } from "@/hooks/admin/useAcademicPeriods";
import { useGradeOptions } from "@/hooks/admin/useGradeOptions";
import { usePromotionPreview } from "@/hooks/admin/usePromotionPreview";
import { usePromotionPolicyActive } from "@/hooks/admin/usePromotionPolicies";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";

type WorkspaceTab = "review" | "placement" | "finalize" | "history";

type PromotionPreviewWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJumpToWorkspace?: (tab: WorkspaceTab) => void;
};

const STEPS = [
  {
    id: "period",
    title: "Academic period",
    description: "Choose the source period students are being promoted out of.",
    icon: CalendarDays,
  },
  {
    id: "policy",
    title: "Policy and scope",
    description: "Tell Leo which active policy should guide this preview.",
    icon: Layers3,
  },
  {
    id: "preview",
    title: "Leo preview",
    description: "Review the promotion logic before generating a safe preview run.",
    icon: Bot,
  },
  {
    id: "results",
    title: "Results",
    description: "Inspect the totals and move into review or placement.",
    icon: CheckCircle2,
  },
] as const;

function toTimestamp(value?: string) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function formatDateRange(startDate?: string, endDate?: string) {
  if (!startDate && !endDate) return "Dates not set";
  const format = (value?: string) =>
    value
      ? new Date(value).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "Unknown";
  return `${format(startDate)} - ${format(endDate)}`;
}

export function PromotionPreviewWizard({
  open,
  onOpenChange,
  onJumpToWorkspace,
}: PromotionPreviewWizardProps) {
  const busy = useBusyToast();
  const previewMutation = usePromotionPreview();
  const { data: periodsData } = useAcademicPeriods();
  const { data: gradesData } = useGradeOptions();
  const { data: policyData } = usePromotionPolicyActive();

  const periods = React.useMemo(() => {
    return [...(periodsData?.periods ?? [])].sort((a, b) => toTimestamp(a.startDate) - toTimestamp(b.startDate));
  }, [periodsData?.periods]);
  const grades = gradesData ?? [];
  const activePolicies = policyData?.policies ?? [];
  const gradeNameById = React.useMemo(
    () => new Map(grades.map((grade) => [grade._id, grade.name])),
    [grades]
  );

  const [currentStep, setCurrentStep] = React.useState(1);
  const [sourcePeriodId, setSourcePeriodId] = React.useState("");
  const [targetPeriodId, setTargetPeriodId] = React.useState("");
  const [policyId, setPolicyId] = React.useState("");
  const [gradeIds, setGradeIds] = React.useState<string[]>([]);
  const [lastResult, setLastResult] = React.useState<{
    cycleId: string;
    status: string;
    totals: {
      studentsEvaluated: number;
      promote: number;
      repeat: number;
      graduate: number;
      hold: number;
      overrides: number;
      errors: number;
    };
  } | null>(null);

  const currentStepMeta = STEPS[currentStep - 1];
  const progressPercent = Math.round((currentStep / STEPS.length) * 100);

  const sourcePeriod = periods.find((period) => String(period._id) === sourcePeriodId) ?? null;
  const targetPeriod = periods.find((period) => String(period._id) === targetPeriodId) ?? null;
  const selectedPolicy = activePolicies.find((policy) => policy.id === policyId) ?? null;
  const policySelectValue =
    policyId ||
    (activePolicies.length === 0 ? "__fallback__" : activePolicies.length > 1 ? "__select__" : "");

  React.useEffect(() => {
    if (!open) return;
    if (periods.length === 0 || sourcePeriodId) return;
    const current = periods.find((period) => period.isCurrent) ?? periods[periods.length - 1];
    if (!current) return;
    setSourcePeriodId(String(current._id));

    const currentIndex = periods.findIndex((period) => String(period._id) === String(current._id));
    const nextPeriod = currentIndex >= 0 ? periods[currentIndex + 1] : undefined;
    setTargetPeriodId(nextPeriod ? String(nextPeriod._id) : "");
  }, [open, periods, sourcePeriodId]);

  React.useEffect(() => {
    if (!open) return;
    if (activePolicies.length === 1 && !policyId) {
      setPolicyId(activePolicies[0]?.id ?? "");
    }
  }, [activePolicies, open, policyId]);

  React.useEffect(() => {
    if (!selectedPolicy?.appliesTo.gradeIds?.length) return;
    setGradeIds((current) => {
      if (current.length > 0) return current;
      return selectedPolicy.appliesTo.gradeIds ?? [];
    });
  }, [selectedPolicy?.appliesTo.gradeIds]);

  React.useEffect(() => {
    if (targetPeriodId && targetPeriodId === sourcePeriodId) {
      setTargetPeriodId("");
    }
  }, [sourcePeriodId, targetPeriodId]);

  const resetWizard = React.useCallback(() => {
    setCurrentStep(1);
    setSourcePeriodId("");
    setTargetPeriodId("");
    setPolicyId("");
    setGradeIds([]);
    setLastResult(null);
  }, []);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) resetWizard();
      onOpenChange(nextOpen);
    },
    [onOpenChange, resetWizard]
  );

  const needsExplicitPolicy = activePolicies.length > 1 && !policyId;
  const canContinue = React.useMemo(() => {
    if (currentStep === 1) return Boolean(sourcePeriodId);
    if (currentStep === 2) return !needsExplicitPolicy;
    if (currentStep === 3) return Boolean(sourcePeriodId) && !needsExplicitPolicy;
    return true;
  }, [currentStep, needsExplicitPolicy, sourcePeriodId]);

  const gradeScopeLabel =
    gradeIds.length > 0
      ? gradeIds.map((gradeId) => gradeNameById.get(gradeId) ?? "Unknown grade").join(", ")
      : selectedPolicy?.appliesTo.gradeIds?.length
        ? selectedPolicy.appliesTo.gradeIds
            .map((gradeId) => gradeNameById.get(gradeId) ?? "Unknown grade")
            .join(", ")
        : "All grades";

  const leoGuidance = React.useMemo(() => {
    if (currentStep === 1) {
      return {
        title: "Pick the period students are finishing",
        body:
          "Leo will evaluate student evidence from the source academic period you choose here. The target period is optional but useful when the next year or term already exists.",
        actions: [
          sourcePeriod
            ? `Source period: ${sourcePeriod.yearLabel} • ${sourcePeriod.term}`
            : "Choose the completed academic period first.",
          targetPeriod
            ? `Target period: ${targetPeriod.yearLabel} • ${targetPeriod.term}`
            : "You can leave target period empty if the next period has not been created yet.",
          "Promotion previews are academic-period aware and do not change live student records.",
        ],
      };
    }
    if (currentStep === 2) {
      return {
        title: "Tell Leo which rules to follow",
        body:
          activePolicies.length === 0
            ? "There is no active promotion policy, so Leo will fall back to school attendance and grading settings if they exist."
            : "Active policies let Leo explain why each student was promoted, repeated, held, or graduated.",
        actions: [
          selectedPolicy
            ? `Selected policy: ${selectedPolicy.name}`
            : activePolicies.length > 1
              ? "Select the active policy you want to use for this preview."
              : activePolicies.length === 1
                ? `Using active policy: ${activePolicies[0]?.name ?? "Promotion policy"}`
                : "Fallback mode will be used if the school has minimum attendance and pass threshold configured.",
          `Grade scope: ${gradeScopeLabel}`,
          "Leave the grade chips empty only if you want the preview to cover the full policy scope.",
        ],
      };
    }
    if (currentStep === 3) {
      return {
        title: "Leo is ready to simulate the promotion run",
        body:
          "This preview will classify students, suggest placements, and create a reviewable cycle without moving anyone yet.",
        actions: [
          "Same-section promotion is preferred when possible, like JHS 1 A -> JHS 2 A.",
          "If the matching section is full or missing, Leo falls back to the least-loaded class and flags conflicts for review.",
          "After preview, move into Review, Placement, and Finalize only when the outcomes look right.",
        ],
      };
    }
    return {
      title: "Preview complete",
      body:
        "Leo has prepared a promotion cycle for human review. You can now inspect decisions, fix placements, and finalize only after approval.",
      actions: [
        `${lastResult?.totals.studentsEvaluated ?? 0} students evaluated`,
        `${lastResult?.totals.promote ?? 0} promote • ${lastResult?.totals.repeat ?? 0} repeat • ${lastResult?.totals.hold ?? 0} hold`,
        "Open Review first if you expect exceptions or policy-based holds.",
      ],
    };
  }, [
    activePolicies,
    currentStep,
    gradeScopeLabel,
    lastResult?.totals.hold,
    lastResult?.totals.promote,
    lastResult?.totals.repeat,
    lastResult?.totals.studentsEvaluated,
    selectedPolicy,
    sourcePeriod,
    targetPeriod,
  ]);

  const handleRunPreview = async () => {
    if (!sourcePeriodId) return;
    try {
      const result = await busy.promise(
        previewMutation.mutateAsync({
          sourceAcademicPeriodId: sourcePeriodId,
          targetAcademicPeriodId: targetPeriodId || undefined,
          policyId: policyId || undefined,
          scope: gradeIds.length > 0 ? { gradeIds } : undefined,
        }),
        {
          loading: "Leo is running the promotion preview...",
          success: "Promotion preview completed",
          error: (error: Error) => error.message,
        }
      );

      if (result?.data) {
        setLastResult(result.data);
        setCurrentStep(4);
      }
    } catch {
      // busy toast handles the error state
    }
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={handleOpenChange}
      title="Run promotion preview"
      description="Let Leo evaluate the selected academic period and prepare a reviewable promotion cycle."
      className="sm:max-w-5xl"
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-[1.5rem] border border-white/10 bg-linear-to-br from-slate-900/90 via-slate-950 to-black p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">
              <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
              Step {currentStep} of {STEPS.length}
            </div>
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-white/40">
              {progressPercent}% complete
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-white">{currentStepMeta.title}</h2>
                <p className="mt-1 text-sm text-white/55">{currentStepMeta.description}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                {STEPS.map((step, index) => {
                  const StepIcon = step.icon;
                  const isCurrent = index + 1 === currentStep;
                  const isComplete = index + 1 < currentStep;
                  return (
                    <div
                      key={step.id}
                      className={cn(
                        "rounded-2xl border p-3",
                        isCurrent
                          ? "border-cyan-400/30 bg-cyan-500/10"
                          : isComplete
                            ? "border-emerald-500/20 bg-emerald-500/10"
                            : "border-white/10 bg-white/[0.03]"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-xl border",
                            isCurrent
                              ? "border-cyan-400/30 bg-cyan-500/20 text-cyan-100"
                              : isComplete
                                ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-100"
                                : "border-white/10 bg-white/5 text-white/50"
                          )}
                        >
                          <StepIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/35">
                            Step {index + 1}
                          </p>
                          <p className="truncate text-sm font-medium text-white">{step.title}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {currentStep === 1 && (
                <div className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-white/72">Source academic period</Label>
                      <PremiumSelect value={sourcePeriodId} onValueChange={setSourcePeriodId}>
                        <PremiumSelectTrigger className="h-11 rounded-xl">
                          <PremiumSelectValue placeholder="Select the completed period" />
                        </PremiumSelectTrigger>
                        <PremiumSelectContent>
                          {periods.map((period) => (
                            <PremiumSelectItem key={String(period._id)} value={String(period._id)}>
                              {period.yearLabel} • {period.term}
                            </PremiumSelectItem>
                          ))}
                        </PremiumSelectContent>
                      </PremiumSelect>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white/72">Target academic period</Label>
                      <PremiumSelect
                        value={targetPeriodId || "__none__"}
                        onValueChange={(value) => setTargetPeriodId(value === "__none__" ? "" : value)}
                      >
                        <PremiumSelectTrigger className="h-11 rounded-xl">
                          <PremiumSelectValue placeholder="Optional" />
                        </PremiumSelectTrigger>
                        <PremiumSelectContent>
                          <PremiumSelectItem value="__none__">None</PremiumSelectItem>
                          {periods
                            .filter((period) => String(period._id) !== sourcePeriodId)
                            .map((period) => (
                              <PremiumSelectItem key={String(period._id)} value={String(period._id)}>
                                {period.yearLabel} • {period.term}
                              </PremiumSelectItem>
                            ))}
                        </PremiumSelectContent>
                      </PremiumSelect>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/35">
                        Source period
                      </p>
                      <p className="mt-2 text-base font-semibold text-white">
                        {sourcePeriod ? `${sourcePeriod.yearLabel} • ${sourcePeriod.term}` : "Not selected"}
                      </p>
                      <p className="mt-1 text-sm text-white/55">
                        {sourcePeriod
                          ? formatDateRange(sourcePeriod.startDate, sourcePeriod.endDate)
                          : "Choose the period students are finishing."}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/35">
                        Target period
                      </p>
                      <p className="mt-2 text-base font-semibold text-white">
                        {targetPeriod ? `${targetPeriod.yearLabel} • ${targetPeriod.term}` : "Not set"}
                      </p>
                      <p className="mt-1 text-sm text-white/55">
                        {targetPeriod
                          ? formatDateRange(targetPeriod.startDate, targetPeriod.endDate)
                          : "Optional when the next year or term has not been created yet."}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-white/72">Active promotion policy</Label>
                    <PremiumSelect
                      value={policySelectValue}
                      onValueChange={(value) => {
                        const nextPolicyId =
                          value === "__fallback__" || value === "__select__" ? "" : value;
                        setPolicyId(nextPolicyId);
                        setGradeIds([]);
                      }}
                    >
                      <PremiumSelectTrigger className="h-11 rounded-xl">
                        <PremiumSelectValue placeholder="Select the policy Leo should use" />
                      </PremiumSelectTrigger>
                      <PremiumSelectContent>
                        {activePolicies.length > 1 ? (
                          <PremiumSelectItem value="__select__">
                            Select a policy
                          </PremiumSelectItem>
                        ) : null}
                        {activePolicies.length === 0 ? (
                          <PremiumSelectItem value="__fallback__">
                            Use fallback school settings
                          </PremiumSelectItem>
                        ) : null}
                        {activePolicies.map((policy) => (
                          <PremiumSelectItem
                            key={policy.id}
                            value={policy.id}
                            description={
                              policy.appliesTo.gradeIds?.length
                                ? policy.appliesTo.gradeIds
                                    .map((gradeId) => gradeNameById.get(gradeId) ?? "Unknown grade")
                                    .join(", ")
                                : "All grades"
                            }
                          >
                            {policy.name}
                          </PremiumSelectItem>
                        ))}
                      </PremiumSelectContent>
                    </PremiumSelect>
                    {needsExplicitPolicy ? (
                      <p className="text-sm text-amber-200">
                        Multiple active policies exist. Pick the exact policy Leo should use for this preview.
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Label className="text-white/72">Limit preview to grades</Label>
                      <p className="mt-1 text-sm text-white/45">
                        Leave all grades unselected to cover the full policy scope.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {grades.map((grade) => {
                        const checked = gradeIds.includes(grade._id);
                        return (
                          <button
                            key={grade._id}
                            type="button"
                            onClick={() =>
                              setGradeIds((current) =>
                                checked
                                  ? current.filter((gradeId) => gradeId !== grade._id)
                                  : [...current, grade._id]
                              )
                            }
                            className={cn(
                              "rounded-full border px-4 py-2 text-sm transition-colors",
                              checked
                                ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
                                : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]"
                            )}
                          >
                            {grade.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/35">
                      Effective scope
                    </p>
                    <p className="mt-2 text-sm text-white/70">{gradeScopeLabel}</p>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/35">
                        Promotion period
                      </p>
                      <p className="mt-2 text-base font-semibold text-white">
                        {sourcePeriod ? `${sourcePeriod.yearLabel} • ${sourcePeriod.term}` : "Not selected"}
                      </p>
                      <p className="mt-1 text-sm text-white/55">
                        Leo will use this academic period as the evidence window.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/35">
                        Promotion policy
                      </p>
                      <p className="mt-2 text-base font-semibold text-white">
                        {selectedPolicy?.name ?? "Fallback school settings"}
                      </p>
                      <p className="mt-1 text-sm text-white/55">{gradeScopeLabel}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
                        <MapPin className="h-4 w-4 text-emerald-100" />
                      </div>
                      <div>
                        <p className="font-medium text-white">Smart placement is already built in</p>
                        <p className="mt-1 text-sm text-white/70">
                          Leo prefers the next grade with the same class section, for example
                          <span className="font-medium text-white"> JHS 1 A → JHS 2 A</span>.
                          If that exact section is full or missing, the preview falls back to the
                          least-loaded target class and flags the placement for human review.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 4 && lastResult && (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/35">
                        Evaluated
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {lastResult.totals.studentsEvaluated}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/70">
                        Promote
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-emerald-100">
                        {lastResult.totals.promote}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-100/70">
                        Repeat
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-amber-100">
                        {lastResult.totals.repeat}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-500/20 bg-slate-500/10 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-100/70">
                        Hold
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {lastResult.totals.hold}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/10 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-100/70">
                        Graduate
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-fuchsia-100">
                        {lastResult.totals.graduate}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      className="gap-2"
                      onClick={() => {
                        handleOpenChange(false);
                        onJumpToWorkspace?.("review");
                      }}
                    >
                      Review decisions
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2 border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]"
                      onClick={() => {
                        handleOpenChange(false);
                        onJumpToWorkspace?.("placement");
                      }}
                    >
                      Check placements
                      <MapPin className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2 border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]"
                      onClick={() => {
                        handleOpenChange(false);
                        onJumpToWorkspace?.("history");
                      }}
                    >
                      Open history
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <aside className="rounded-[1.5rem] border border-cyan-500/20 bg-cyan-500/10 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
                  <LeoIcon className="h-5 w-5 text-cyan-100" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Wand2 className="h-4 w-4 text-cyan-100" />
                    <p className="text-sm font-semibold text-white">Leo promotion guide</p>
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-white">{leoGuidance.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/70">{leoGuidance.body}</p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/35">
                  What Leo is checking
                </p>
                <ul className="mt-3 space-y-2 text-sm text-white/72">
                  {leoGuidance.actions.map((action) => (
                    <li key={action} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-100" />
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>

          <div className="h-2 rounded-full bg-white/8">
            <div
              className="h-2 rounded-full bg-linear-to-r from-cyan-400 to-emerald-300 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            className="gap-2 border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]"
            onClick={() => {
              if (currentStep === 1) handleOpenChange(false);
              else if (currentStep === 4) setCurrentStep(3);
              else setCurrentStep((step) => Math.max(1, step - 1));
            }}
          >
            <ChevronLeft className="h-4 w-4" />
            {currentStep === 1 ? "Cancel" : "Back"}
          </Button>

          {currentStep < 3 && (
            <Button
              type="button"
              onClick={() => setCurrentStep((step) => Math.min(3, step + 1))}
              disabled={!canContinue}
              className="gap-2"
            >
              Continue
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}

          {currentStep === 3 && (
            <Button
              type="button"
              onClick={handleRunPreview}
              disabled={!canContinue || previewMutation.isPending}
              className="gap-2"
            >
              {previewMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GraduationCap className="h-4 w-4" />
              )}
              Let Leo run preview
            </Button>
          )}

          {currentStep === 4 && (
            <Button type="button" onClick={() => handleOpenChange(false)} className="gap-2">
              Close
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </ResponsiveModal>
  );
}
