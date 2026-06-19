"use client";

import * as React from "react";
import { BookOpen, Compass, Layers, MessageCircle, Sparkles, ClipboardList } from "lucide-react";
import { ResponsiveModal } from "@/components/modals/ResponsiveModal";
import { cn } from "@/lib/utils";
import type { LearnPackageJourneyStep } from "@/lib/lessons/learn-package-readiness";

const STEP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  notebook_notes: BookOpen,
  flashcards: Layers,
  explore: Compass,
  extra_ai: Sparkles,
  assignment: ClipboardList,
  reflection: MessageCircle,
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionTitle: string;
  classLabel: string;
  steps: LearnPackageJourneyStep[];
};

export function TeacherSessionLearnPreviewModal({
  open,
  onOpenChange,
  sessionTitle,
  classLabel,
  steps,
}: Props) {
  return (
    <ResponsiveModal
      open={open}
      onClose={() => onOpenChange(false)}
      title="Student preview — Today's Journey"
    >
      <div className="space-y-4">
        <p className="text-sm text-white/55">
          What {classLabel} will see for &quot;{sessionTitle}&quot; in EduSentrix Learn.
        </p>
        <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100/90">
          Leo turns this lesson into a calm after-class subject journey. Students move step by step —
          notes, practice, optional Explore, Leo help, assignment when linked, then reflection.
        </div>

        <ol className="space-y-2">
          {steps.map((step, index) => {
            const Icon = STEP_ICONS[step.key] ?? BookOpen;
            const active = step.included;
            return (
              <li
                key={step.key}
                className={cn(
                  "flex items-start gap-3 rounded-xl border px-3 py-3",
                  active
                    ? "border-emerald-400/20 bg-emerald-500/8"
                    : "border-white/8 bg-black/20 opacity-60",
                )}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/8 text-white/70">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">
                    {index + 1}. {step.label}
                    {step.required ? (
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-emerald-300/80">
                        Required
                      </span>
                    ) : (
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-white/35">
                        Optional
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-white/50">
                    {active
                      ? "Included in this subject journey"
                      : "Not included until you add or publish this resource"}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </ResponsiveModal>
  );
}
