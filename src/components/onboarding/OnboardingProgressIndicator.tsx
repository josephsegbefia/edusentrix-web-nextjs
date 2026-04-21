"use client";

import React from "react";
import { Check, Sparkles } from "lucide-react";
import { OnboardingStep } from "@/hooks/admin/useOnboardingProgress";
import { cn } from "@/lib/utils";

type StepInfo = {
  id: OnboardingStep;
  label: string;
  shortLabel: string;
};

const STEPS: StepInfo[] = [
  { id: "academic_period", label: "Academic Period", shortLabel: "Period" },
  { id: "class_groups", label: "Class Groups", shortLabel: "Classes" },
  { id: "teachers", label: "Teachers", shortLabel: "Teachers" },
  { id: "students", label: "Students", shortLabel: "Students" },
];

type OnboardingProgressIndicatorProps = {
  currentStep: OnboardingStep;
  progressPercentage: number;
};

export function OnboardingProgressIndicator({
  currentStep,
  progressPercentage,
}: OnboardingProgressIndicatorProps) {
  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/10",
        "bg-linear-to-br from-white/[0.07] via-white/[0.02] to-transparent",
        "shadow-[0_24px_56px_-28px_rgba(0,0,0,0.9)] backdrop-blur-md"
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-sky-400/35 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-40 w-40 rounded-full bg-brand/10 blur-3xl"
      />
      <div className="relative p-5 sm:p-6">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-brand/25 bg-brand/10 text-brand shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
                School setup
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-white sm:text-xl">
                Finish onboarding your workspace
              </h2>
              <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-white/50">
                Work through each step in order. Sidebar navigation stays on
                Dashboard until setup is complete—use the quick actions for your
                current step.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-baseline gap-1.5 rounded-xl border border-white/10 bg-black/30 px-4 py-3 shadow-inner shadow-black/20">
            <span className="text-3xl font-bold tabular-nums tracking-tight text-white">
              {progressPercentage}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
              % done
            </span>
          </div>
        </div>

        <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-inset ring-white/[0.06]">
          <div
            className="h-full rounded-full bg-linear-to-r from-brand via-sky-400 to-violet-400/90 transition-[width] duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-[min(100%,520px)] items-center gap-2 sm:min-w-0 sm:gap-3">
            {STEPS.map((step, index) => {
              const isCompleted = index < currentStepIndex;
              const isCurrent = step.id === currentStep;
              const isLast = index === STEPS.length - 1;

              return (
                <React.Fragment key={step.id}>
                  <div className="flex w-[4.75rem] shrink-0 flex-col items-center gap-2 sm:w-auto sm:flex-1 sm:min-w-0">
                    <div
                      className={cn(
                        "relative flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all duration-300",
                        isCompleted &&
                          "border-brand bg-brand text-black shadow-md shadow-brand/20",
                        isCurrent &&
                          "border-sky-400/70 bg-sky-400/12 text-sky-100 ring-2 ring-sky-400/20",
                        !isCompleted &&
                          !isCurrent &&
                          "border-white/14 bg-white/[0.04] text-white/38"
                      )}
                    >
                      {isCompleted ? (
                        <Check className="h-4 w-4 stroke-[2.5]" />
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </div>
                    <div className="w-full text-center">
                      <p
                        className={cn(
                          "text-[11px] font-semibold leading-snug sm:text-xs",
                          isCurrent ? "text-sky-200" : "text-white/55"
                        )}
                      >
                        {step.shortLabel}
                      </p>
                      <p className="mt-0.5 hidden text-[10px] leading-tight text-white/38 sm:block">
                        {step.label}
                      </p>
                    </div>
                  </div>
                  {!isLast ? (
                    <div
                      className={cn(
                        "hidden h-0.5 min-w-[0.75rem] flex-1 rounded-full sm:block",
                        index < currentStepIndex ? "bg-brand/60" : "bg-white/10"
                      )}
                      aria-hidden
                    />
                  ) : null}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
