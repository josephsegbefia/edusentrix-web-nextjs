"use client";

import * as React from "react";
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Globe,
  NotebookPen,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LessonDeliveryStatus } from "@/types/lessons-v2";

export type AfterClassStep = "notebook" | "wrap_up" | "share" | "reflect" | "follow_up";

type StepDef = {
  id: AfterClassStep;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
};

const STEPS: StepDef[] = [
  { id: "notebook", label: "Notebook notes", shortLabel: "Notes", icon: NotebookPen },
  { id: "wrap_up", label: "Wrap up", shortLabel: "Wrap up", icon: CheckCircle2 },
  { id: "share", label: "Share with class", shortLabel: "Share", icon: Globe },
  { id: "reflect", label: "Reflect", shortLabel: "Reflect", icon: Sparkles },
  { id: "follow_up", label: "Follow-up", shortLabel: "Follow-up", icon: BookOpen },
];

function defaultStepForStatus(status: LessonDeliveryStatus): AfterClassStep {
  if (status === "delivered") return "wrap_up";
  if (status === "completed") return "follow_up";
  return "notebook";
}

type Props = {
  deliveryStatus: LessonDeliveryStatus;
  classLabel: string;
  showReflectStep: boolean;
  learnPackage?: React.ReactNode;
  notebook: React.ReactNode;
  wrapUp: React.ReactNode;
  share: React.ReactNode;
  reflect?: React.ReactNode;
  followUp: React.ReactNode;
};

export function TeacherSessionAfterClassWorkflow({
  deliveryStatus,
  classLabel,
  showReflectStep,
  learnPackage,
  notebook,
  wrapUp,
  share,
  reflect,
  followUp,
}: Props) {
  const visibleSteps = React.useMemo(
    () => STEPS.filter((step) => step.id !== "reflect" || showReflectStep),
    [showReflectStep],
  );

  const [activeStep, setActiveStep] = React.useState<AfterClassStep>(() =>
    defaultStepForStatus(deliveryStatus),
  );

  React.useEffect(() => {
    setActiveStep(defaultStepForStatus(deliveryStatus));
  }, [deliveryStatus]);

  const activeIndex = visibleSteps.findIndex((s) => s.id === activeStep);

  const panel = (() => {
    switch (activeStep) {
      case "notebook":
        return notebook;
      case "wrap_up":
        return wrapUp;
      case "share":
        return share;
      case "reflect":
        return reflect;
      case "follow_up":
        return followUp;
      default:
        return null;
    }
  })();

  return (
    <Card className="border border-emerald-400/25 bg-linear-to-br from-emerald-500/10 via-slate-950/40 to-transparent shadow-lg shadow-black/25 backdrop-blur-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-white">After class</CardTitle>
        <p className="text-xs text-white/55">
          Finish up for <span className="text-emerald-200/90">{classLabel}</span> — work through
          each step when you are ready.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {learnPackage ? <div>{learnPackage}</div> : null}

        <div className="flex gap-1 overflow-x-auto pb-1">
          {visibleSteps.map((step, index) => {
            const Icon = step.icon;
            const isActive = step.id === activeStep;
            const isPast = index < activeIndex;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStep(step.id)}
                className={cn(
                  "flex min-w-[108px] shrink-0 flex-col items-start gap-1 rounded-xl border px-3 py-2 text-left transition-colors",
                  isActive
                    ? "border-emerald-400/35 bg-emerald-500/15 text-emerald-50"
                    : isPast
                      ? "border-white/10 bg-white/5 text-white/70 hover:bg-white/8"
                      : "border-white/10 bg-black/20 text-white/55 hover:bg-white/5 hover:text-white/75",
                )}
              >
                <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide opacity-80">
                  <Icon className="h-3 w-3" />
                  Step {index + 1}
                </span>
                <span className="text-xs font-medium sm:text-sm">{step.shortLabel}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2 text-xs text-white/45">
          <span>
            {visibleSteps[activeIndex]?.label ?? "After class"}
          </span>
          {activeIndex < visibleSteps.length - 1 ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-emerald-200/80 hover:bg-emerald-500/10 hover:text-emerald-100"
              onClick={() => setActiveStep(visibleSteps[activeIndex + 1]!.id)}
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4">{panel}</div>
      </CardContent>
    </Card>
  );
}

export function AfterClassStepHeading({
  title,
  description,
  icon: Icon = ClipboardList,
}: {
  title: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="mb-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
        <Icon className="h-4 w-4 text-teal-300" />
        {title}
      </h3>
      <p className="mt-1 text-xs text-white/50">{description}</p>
    </div>
  );
}
