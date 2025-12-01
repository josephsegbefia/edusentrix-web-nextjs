"use client";

import React from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { OnboardingStep } from "@/hooks/admin/useOnboardingProgress";

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
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-white/90">
          Setup Progress
        </span>
        <span className="text-xs text-white/60">{progressPercentage}%</span>
      </div>
      <div className="flex items-center gap-2">
        {STEPS.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = step.id === currentStep;
          const isUpcoming = index > currentStepIndex;

          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center gap-1 flex-1">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all ${
                    isCompleted
                      ? "border-brand bg-brand text-black"
                      : isCurrent
                      ? "border-brand bg-brand/20 text-brand"
                      : "border-white/20 bg-white/5 text-white/40"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={`text-[10px] text-center ${
                    isCurrent ? "text-brand font-medium" : "text-white/60"
                  }`}
                >
                  {step.shortLabel}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`h-0.5 flex-1 transition-all ${
                    isCompleted ? "bg-brand" : "bg-white/10"
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
