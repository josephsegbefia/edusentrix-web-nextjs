"use client";

// src/components/admissions/cycle/AdmissionsOnboardingTour.tsx
// Lightweight first-run tour for school admins and admissions officers.
// Shipped as a stub for Phase 5 — single-school local-storage flag, no
// backend persistence. Promote to a proper user-pref backed flow once we
// have signal that admins want it.

import * as React from "react";
import {
  ArrowRight,
  ClipboardList,
  FormInput,
  HelpCircle,
  Inbox,
  Share2,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "edusentrix:admissions:tour:dismissed";

type TourStep = {
  title: string;
  body: string;
  icon: React.ComponentType<{ className?: string }>;
  hashTarget?: string;
};

const STEPS: TourStep[] = [
  {
    title: "Welcome to Admissions",
    body: "This is your home base for every admission cycle. Each cycle has its own form, application inbox, and analytics.",
    icon: Sparkles,
  },
  {
    title: "Start with the Overview",
    body: "Track top-line numbers and reviewer progress at a glance. Open Leo's coaching cards on the right when you want context.",
    icon: ClipboardList,
    hashTarget: "overview",
  },
  {
    title: "Build the form",
    body: "Drag sections into place, mark required fields, and choose which documents you need. Validations help catch issues before parents apply.",
    icon: FormInput,
    hashTarget: "form",
  },
  {
    title: "Distribute the link",
    body: "Share the public link, embed the form on your site, or invite specific guardians from the Distribution tab.",
    icon: Share2,
    hashTarget: "distribution",
  },
  {
    title: "Review applications",
    body: "Switch to the Applications inbox to triage submissions, assign reviewers, decide outcomes, and provision accepted students.",
    icon: Inbox,
    hashTarget: "applications",
  },
];

export function AdmissionsOnboardingTour() {
  const [open, setOpen] = React.useState(false);
  const [stepIdx, setStepIdx] = React.useState(0);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const dismissed = window.localStorage.getItem(STORAGE_KEY);
      if (!dismissed) setOpen(true);
    } catch {
      // localStorage may be unavailable (Safari private mode) — silently skip.
    }
  }, []);

  const launch = React.useCallback(() => {
    setStepIdx(0);
    setOpen(true);
  }, []);

  const dismiss = React.useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      // noop
    }
    setOpen(false);
  }, []);

  const advance = () => {
    const step = STEPS[stepIdx];
    if (step.hashTarget && typeof window !== "undefined") {
      window.location.hash = step.hashTarget;
    }
    if (stepIdx < STEPS.length - 1) {
      setStepIdx((i) => i + 1);
    } else {
      dismiss();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={launch}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full border border-white/15 bg-slate-900/80 px-3 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur transition hover:bg-slate-900"
        aria-label="Open admissions onboarding tour"
      >
        <HelpCircle className="h-4 w-4" />
        Tour
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="admissions-tour-title"
          className="fixed inset-0 z-50 flex items-end justify-end bg-slate-950/40 p-4 sm:items-center sm:justify-end sm:p-6"
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-950 p-5 text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Header
              stepIdx={stepIdx}
              totalSteps={STEPS.length}
              onClose={dismiss}
            />
            <Body step={STEPS[stepIdx]} />
            <Footer
              stepIdx={stepIdx}
              totalSteps={STEPS.length}
              onSkip={dismiss}
              onAdvance={advance}
              onBack={() => setStepIdx((i) => Math.max(0, i - 1))}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

function Header({
  stepIdx,
  totalSteps,
  onClose,
}: {
  stepIdx: number;
  totalSteps: number;
  onClose: () => void;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
        Step {stepIdx + 1} of {totalSteps}
      </p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close tour"
        className="rounded-full p-1 text-white/55 hover:bg-white/10 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function Body({ step }: { step: TourStep }) {
  const Icon = step.icon;
  return (
    <div className="space-y-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300">
        <Icon className="h-5 w-5" />
      </div>
      <h2
        id="admissions-tour-title"
        className="text-lg font-semibold leading-tight"
      >
        {step.title}
      </h2>
      <p className="text-sm leading-relaxed text-white/75">{step.body}</p>
    </div>
  );
}

function Footer({
  stepIdx,
  totalSteps,
  onSkip,
  onAdvance,
  onBack,
}: {
  stepIdx: number;
  totalSteps: number;
  onSkip: () => void;
  onAdvance: () => void;
  onBack: () => void;
}) {
  const last = stepIdx === totalSteps - 1;
  return (
    <div className="mt-5 flex items-center justify-between gap-3">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="text-white/60 hover:bg-white/5 hover:text-white"
        onClick={stepIdx === 0 ? onSkip : onBack}
      >
        {stepIdx === 0 ? "Skip tour" : "Back"}
      </Button>
      <Button
        type="button"
        size="sm"
        onClick={onAdvance}
        className="bg-indigo-500 hover:bg-indigo-400"
      >
        {last ? "Got it" : "Next"}
        {!last ? <ArrowRight className="ml-1 h-3.5 w-3.5" /> : null}
      </Button>
    </div>
  );
}
