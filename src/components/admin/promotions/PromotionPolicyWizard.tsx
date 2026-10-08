"use client";

import * as React from "react";
import {
  BookOpenCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Loader2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Wand2,
} from "lucide-react";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { LeoIcon } from "@/components/icons/LeoIcon";
import { cn } from "@/lib/utils";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useGradeOptions } from "@/hooks/admin/useGradeOptions";
import {
  useActivatePromotionPolicy,
  useCreatePromotionPolicy,
} from "@/hooks/admin/usePromotionPolicies";

type PromotionPolicyWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const STEPS = [
  {
    id: "scope",
    title: "Policy scope",
    description: "Name the policy and choose the grades it should control.",
    icon: GraduationCap,
  },
  {
    id: "criteria",
    title: "Core rules",
    description: "Set the academic and attendance thresholds Leo should use.",
    icon: SlidersHorizontal,
  },
  {
    id: "safeguards",
    title: "Safeguards",
    description: "Choose how excused absences and finance holds should behave.",
    icon: ShieldCheck,
  },
  {
    id: "review",
    title: "Review",
    description: "Confirm the policy before saving it for promotions.",
    icon: BookOpenCheck,
  },
] as const;

function clampPercent(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, value));
}

export function PromotionPolicyWizard({
  open,
  onOpenChange,
}: PromotionPolicyWizardProps) {
  const busy = useBusyToast();
  const { data: gradesData } = useGradeOptions();
  const createPolicy = useCreatePromotionPolicy();
  const activatePolicy = useActivatePromotionPolicy();

  const grades = gradesData ?? [];
  const gradeNameById = React.useMemo(
    () => new Map(grades.map((grade) => [grade._id, grade.name])),
    [grades]
  );

  const [currentStep, setCurrentStep] = React.useState(1);
  const [name, setName] = React.useState("End-of-Year Promotion Policy");
  const [gradeIds, setGradeIds] = React.useState<string[]>([]);
  const [attendanceMin, setAttendanceMin] = React.useState(75);
  const [averageMin, setAverageMin] = React.useState(50);
  const [treatExcused, setTreatExcused] = React.useState(true);
  const [financeEnabled, setFinanceEnabled] = React.useState(false);
  const [activateNow, setActivateNow] = React.useState(true);

  const currentStepMeta = STEPS[currentStep - 1];
  const progressPercent = Math.round((currentStep / STEPS.length) * 100);
  const selectedGradeNames = gradeIds
    .map((gradeId) => gradeNameById.get(gradeId))
    .filter((value): value is string => Boolean(value));

  const resetWizard = React.useCallback(() => {
    setCurrentStep(1);
    setName("End-of-Year Promotion Policy");
    setGradeIds([]);
    setAttendanceMin(75);
    setAverageMin(50);
    setTreatExcused(true);
    setFinanceEnabled(false);
    setActivateNow(true);
  }, []);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) resetWizard();
      onOpenChange(nextOpen);
    },
    [onOpenChange, resetWizard]
  );

  const canContinue = React.useMemo(() => {
    if (currentStep === 1) return name.trim().length > 0;
    if (currentStep === 2) {
      return (
        attendanceMin >= 0 &&
        attendanceMin <= 100 &&
        averageMin >= 0 &&
        averageMin <= 100
      );
    }
    return true;
  }, [attendanceMin, averageMin, currentStep, name]);

  const leoGuidance = React.useMemo(() => {
    if (currentStep === 1) {
      return {
        title: "Start with a clear scope",
        body:
          selectedGradeNames.length === 0
            ? "Leo recommends starting with a whole-school policy only if your grades follow the same promotion rules."
            : "Leo will treat this as a scoped policy and use it only for the selected grades during preview runs.",
        actions: [
          "Give the policy a name the team will recognize next year.",
          "Scope by grade when lower and upper sections promote differently.",
          "Leave the grade list empty only for a true whole-school default.",
        ],
      };
    }
    if (currentStep === 2) {
      return {
        title: "Keep the first live policy simple",
        body:
          "Attendance and academic average usually cover most cases. Leo can surface exceptions later during review.",
        actions: [
          `Attendance minimum is currently ${attendanceMin}%`,
          `Academic average minimum is currently ${averageMin}%`,
          "You can still override individual students during review before finalizing.",
        ],
      };
    }
    if (currentStep === 3) {
      return {
        title: "Add only the safeguards you really want enforced",
        body:
          "Finance holds and excused-absence handling should match your real school policy, because Leo will explain these decisions to admins later.",
        actions: [
          treatExcused
            ? "Excused absences will count as present for attendance."
            : "Excused absences will not count as present for attendance.",
          financeEnabled
            ? "Students with outstanding fees can be held for review."
            : "Fees will not block promotion in this policy.",
          activateNow
            ? "This policy will become active immediately after it is created."
            : "The policy will be saved as draft until you activate it later.",
        ],
      };
    }
    return {
      title: "Ready to save",
      body:
        "Once saved, Leo can use this policy when running promotion previews for the selected academic period.",
      actions: [
        selectedGradeNames.length > 0
          ? `Scope: ${selectedGradeNames.join(", ")}`
          : "Scope: all grades",
        `Rules: attendance >= ${attendanceMin}%, average >= ${averageMin}%`,
        activateNow
          ? "Activation will replace any overlapping active policy for the same scope."
          : "You can activate this policy later from the active policies section.",
      ],
    };
  }, [
    activateNow,
    attendanceMin,
    averageMin,
    currentStep,
    financeEnabled,
    selectedGradeNames,
    treatExcused,
  ]);

  const handleSubmit = async () => {
    try {
      const created = await busy.promise(
        createPolicy.mutateAsync({
          name: name.trim() || "Promotion Policy",
          appliesTo: { gradeIds: gradeIds.length > 0 ? gradeIds : undefined },
          criteria: [
            {
              key: "attendance_percent",
              operator: ">=",
              value: clampPercent(attendanceMin, 75),
              required: true,
            },
            {
              key: "overall_average",
              operator: ">=",
              value: clampPercent(averageMin, 50),
              required: true,
            },
            ...(financeEnabled
              ? [
                  {
                    key: "fee_outstanding_minor" as const,
                    operator: "<=" as const,
                    value: 0,
                    required: false,
                  },
                ]
              : []),
          ],
          logic: "all_required_pass",
          thresholds: { promote: 100 },
          tieBreaker: "overall_average",
          attendanceComputation: { treatExcusedAsPresent: treatExcused },
          financeHold: { enabled: financeEnabled, maxOutstandingMinor: 0 },
          manualOverrideRules: { requireReason: true, requireApprover: false },
        }),
        {
          loading: "Saving promotion policy...",
          success: activateNow ? "Policy saved. Activating now..." : "Policy saved",
          error: (error: Error) => error.message,
        }
      );

      if (activateNow && created?.data?.id) {
        await busy.promise(activatePolicy.mutateAsync(created.data.id), {
          loading: "Activating promotion policy...",
          success: "Promotion policy activated",
          error: (error: Error) => error.message,
        });
      }

      handleOpenChange(false);
    } catch {
      // busy toast handles the error state
    }
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={handleOpenChange}
      title="Create promotion policy"
      description="Build a promotion rule set Leo can use during end-of-year promotion previews."
      className="sm:max-w-5xl"
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-[1.5rem] border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-(--ws-line) bg-(--ws-fill) px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-(--ws-fg-50)">
              <Sparkles className="h-3.5 w-3.5 text-(--ws-cyan)" />
              Step {currentStep} of {STEPS.length}
            </div>
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-(--ws-fg-40)">
              {progressPercent}% complete
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-(--ws-fg)">{currentStepMeta.title}</h2>
                <p className="mt-1 text-sm text-(--ws-fg-50)">{currentStepMeta.description}</p>
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
                            : "border-(--ws-line) bg-(--ws-fill)"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-xl border",
                            isCurrent
                              ? "border-cyan-400/30 bg-cyan-500/20 text-(--ws-cyan)"
                              : isComplete
                                ? "border-emerald-500/30 bg-emerald-500/20 text-(--ws-emerald)"
                                : "border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-50)"
                          )}
                        >
                          <StepIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--ws-fg-40)">
                            Step {index + 1}
                          </p>
                          <p className="truncate text-sm font-medium text-(--ws-fg)">{step.title}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {currentStep === 1 && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="promotion-policy-name" className="text-(--ws-fg)/72">
                      Policy name
                    </Label>
                    <Input
                      id="promotion-policy-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="e.g. 2026 End-of-Year Promotion Policy"
                      className="border-(--ws-line) bg-(--ws-fill) text-(--ws-fg)"
                    />
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Label className="text-(--ws-fg)/72">Apply to grades</Label>
                      <p className="mt-1 text-sm text-(--ws-fg-40)">
                        Leave this empty only when the same promotion rules should apply to the whole school.
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
                                ? "border-cyan-400/40 bg-cyan-500/15 text-(--ws-cyan)"
                                : "border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-70) hover:bg-(--ws-fill-strong)"
                            )}
                          >
                            {grade.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="promotion-attendance-min" className="text-(--ws-fg)/72">
                      Minimum attendance (%)
                    </Label>
                    <Input
                      id="promotion-attendance-min"
                      type="number"
                      min={0}
                      max={100}
                      value={attendanceMin}
                      onChange={(event) => setAttendanceMin(Number(event.target.value))}
                      className="border-(--ws-line) bg-(--ws-fill) text-(--ws-fg)"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="promotion-average-min" className="text-(--ws-fg)/72">
                      Minimum overall average (%)
                    </Label>
                    <Input
                      id="promotion-average-min"
                      type="number"
                      min={0}
                      max={100}
                      value={averageMin}
                      onChange={(event) => setAverageMin(Number(event.target.value))}
                      className="border-(--ws-line) bg-(--ws-fill) text-(--ws-fg)"
                    />
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-4">
                  <label className="flex items-start gap-3 rounded-2xl border border-(--ws-line) bg-(--ws-fill) p-4">
                    <Switch checked={treatExcused} onCheckedChange={setTreatExcused} />
                    <span className="space-y-1">
                      <span className="block text-sm font-medium text-(--ws-fg)">
                        Treat excused absences as present
                      </span>
                      <span className="block text-sm text-(--ws-fg-50)">
                        Use excused absence records to protect a student&apos;s attendance percentage.
                      </span>
                    </span>
                  </label>

                  <label className="flex items-start gap-3 rounded-2xl border border-(--ws-line) bg-(--ws-fill) p-4">
                    <Switch checked={financeEnabled} onCheckedChange={setFinanceEnabled} />
                    <span className="space-y-1">
                      <span className="block text-sm font-medium text-(--ws-fg)">
                        Hold students with outstanding fees
                      </span>
                      <span className="block text-sm text-(--ws-fg-50)">
                        Leo will flag them for review instead of promoting them automatically.
                      </span>
                    </span>
                  </label>

                  <label className="flex items-start gap-3 rounded-2xl border border-(--ws-line) bg-(--ws-fill) p-4">
                    <Switch checked={activateNow} onCheckedChange={setActivateNow} />
                    <span className="space-y-1">
                      <span className="block text-sm font-medium text-(--ws-fg)">
                        Activate this policy now
                      </span>
                      <span className="block text-sm text-(--ws-fg-50)">
                        If another active policy overlaps with this scope, it will be replaced.
                      </span>
                    </span>
                  </label>
                </div>
              )}

              {currentStep === 4 && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-(--ws-line) bg-(--ws-fill) p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--ws-fg-40)">
                      Policy
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-(--ws-fg)">{name.trim() || "Promotion Policy"}</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedGradeNames.length > 0 ? (
                        selectedGradeNames.map((gradeName) => (
                          <Badge
                            key={gradeName}
                            variant="outline"
                            className="border-cyan-400/30 bg-cyan-500/10 text-(--ws-cyan)"
                          >
                            {gradeName}
                          </Badge>
                        ))
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-70)"
                        >
                          All grades
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-(--ws-line) bg-(--ws-fill) p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--ws-fg-40)">
                        Academic rule
                      </p>
                      <p className="mt-2 text-sm text-(--ws-fg-70)">
                        Students need at least{" "}
                        <span className="font-semibold text-(--ws-fg)">{averageMin}%</span> overall
                        average to pass this policy.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-(--ws-line) bg-(--ws-fill) p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--ws-fg-40)">
                        Attendance rule
                      </p>
                      <p className="mt-2 text-sm text-(--ws-fg-70)">
                        Students need at least{" "}
                        <span className="font-semibold text-(--ws-fg)">{attendanceMin}%</span>{" "}
                        attendance to pass this policy.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-(--ws-line) bg-(--ws-fill) p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--ws-fg-40)">
                        Excused absences
                      </p>
                      <p className="mt-2 text-sm text-(--ws-fg-70)">
                        {treatExcused
                          ? "Excused absences count as present."
                          : "Excused absences do not count as present."}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-(--ws-line) bg-(--ws-fill) p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--ws-fg-40)">
                        Finance hold
                      </p>
                      <p className="mt-2 text-sm text-(--ws-fg-70)">
                        {financeEnabled
                          ? "Students with outstanding fees are held for review."
                          : "Fees do not block promotion in this policy."}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <aside className="rounded-[1.5rem] border border-cyan-500/20 bg-cyan-500/10 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-(--ws-line) bg-(--ws-fill-strong)">
                  <LeoIcon className="h-5 w-5 text-(--ws-cyan)" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Wand2 className="h-4 w-4 text-(--ws-cyan)" />
                    <p className="text-sm font-semibold text-(--ws-fg)">Leo policy guidance</p>
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-(--ws-fg)">{leoGuidance.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-(--ws-fg-70)">{leoGuidance.body}</p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-(--ws-line) bg-(--ws-fill) p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--ws-fg-40)">
                  What Leo is watching
                </p>
                <ul className="mt-3 space-y-2 text-sm text-(--ws-fg)/72">
                  {leoGuidance.actions.map((action) => (
                    <li key={action} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-(--ws-cyan)" />
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>

          <div className="h-2 rounded-full bg-(--ws-fill)">
            <div
              className="h-2 rounded-full bg-linear-to-r from-cyan-400 to-emerald-300 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-(--ws-line) pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            className="gap-2 border-(--ws-line) bg-(--ws-fill) text-(--ws-fg) hover:bg-(--ws-fill-strong)"
            onClick={() => {
              if (currentStep === 1) handleOpenChange(false);
              else setCurrentStep((step) => Math.max(1, step - 1));
            }}
          >
            <ChevronLeft className="h-4 w-4" />
            {currentStep === 1 ? "Cancel" : "Back"}
          </Button>

          {currentStep < STEPS.length ? (
            <Button
              type="button"
              onClick={() => setCurrentStep((step) => Math.min(STEPS.length, step + 1))}
              disabled={!canContinue}
              className="gap-2"
            >
              Continue
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={createPolicy.isPending || activatePolicy.isPending}
              className="gap-2"
            >
              {createPolicy.isPending || activatePolicy.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Save policy
            </Button>
          )}
        </div>
      </div>
    </ResponsiveModal>
  );
}
