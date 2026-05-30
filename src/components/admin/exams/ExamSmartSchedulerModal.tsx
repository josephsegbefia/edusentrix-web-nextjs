"use client";

import * as React from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  Wand2,
} from "lucide-react";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  glassInsetClass,
  glassPrimaryButtonClass,
  glassSecondaryButtonClass,
} from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";
import type {
  ExamSessionDTO,
  ExamSmartScheduleProposalDTO,
} from "@/types/academics/exam-scheduling-engine";
import {
  useApplySmartExamSchedule,
  useGenerateSmartExamSchedule,
} from "@/hooks/admin/useExamSmartScheduler";
import { useExamTimetableEntries } from "@/hooks/admin/useExamTimetableEntries";
import { useBusyToast } from "@/hooks/useBusyToast";

const STEPS = [
  { id: 1, label: "Scope" },
  { id: 2, label: "Preferences" },
  { id: 3, label: "Review draft" },
  { id: 4, label: "Apply" },
];

type ExamSmartSchedulerModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: ExamSessionDTO;
  onApplied?: () => void;
};

type PreferencesForm = {
  dayStartTime: string;
  dayEndTime: string;
  slotGapMinutes: number;
  onlyUnscheduledEntries: boolean;
};

function createDefaultPreferences(): PreferencesForm {
  return {
    dayStartTime: "08:00",
    dayEndTime: "15:00",
    slotGapMinutes: 15,
    onlyUnscheduledEntries: true,
  };
}

export function ExamSmartSchedulerModal({
  open,
  onOpenChange,
  session,
  onApplied,
}: ExamSmartSchedulerModalProps) {
  const busy = useBusyToast();
  const [step, setStep] = React.useState(1);
  const [preferences, setPreferences] = React.useState<PreferencesForm>(createDefaultPreferences());
  const [proposal, setProposal] = React.useState<ExamSmartScheduleProposalDTO | null>(null);

  const generateSchedule = useGenerateSmartExamSchedule(session.id);
  const applySchedule = useApplySmartExamSchedule(session.id);
  const { data: entriesData } = useExamTimetableEntries(open ? session.id : null);

  const entries = entriesData?.data ?? [];
  const unscheduledCount = entries.filter((entry) => entry.isUnscheduled).length;
  const scopeCount = preferences.onlyUnscheduledEntries ? unscheduledCount : entries.length;

  React.useEffect(() => {
    if (!open) return;
    setStep(1);
    setPreferences(createDefaultPreferences());
    setProposal(null);
  }, [open, session.id]);

  async function handleGenerate() {
    const result = await busy.promise(
      generateSchedule.mutateAsync({
        dayStartTime: preferences.dayStartTime,
        dayEndTime: preferences.dayEndTime,
        slotGapMinutes: preferences.slotGapMinutes,
        onlyUnscheduledEntries: preferences.onlyUnscheduledEntries,
      }),
      {
        loading: "Generating smart schedule draft…",
        success: "Smart schedule draft ready for review",
        error: (error) =>
          error instanceof Error ? error.message : "Could not generate smart schedule",
      }
    );
    setProposal(result);
    setStep(3);
  }

  async function handleApply() {
    if (!proposal) return;

    await busy.promise(
      applySchedule.mutateAsync({ proposal }),
      {
        loading: "Applying smart schedule draft…",
        success: (data) =>
          `Applied ${data.updatedEntryCount} slot(s)${
            data.invigilatorSuggestionsCount > 0
              ? ` and ${data.invigilatorSuggestionsCount} invigilator suggestion(s)`
              : ""
          }`,
        error: (error) =>
          error instanceof Error ? error.message : "Could not apply smart schedule",
      }
    );

    onOpenChange(false);
    onApplied?.();
  }

  const isBusy = generateSchedule.isPending || applySchedule.isPending;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Smart schedule assistant"
      description="Generate a policy-aware draft timetable. You stay in control—review, adjust, or discard before publishing."
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {STEPS.map((item) => (
          <Badge
            key={item.id}
            variant="outline"
            className={cn(
              "border-white/10 bg-white/5 text-white/60",
              step === item.id && "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
              step > item.id && "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
            )}
          >
            {item.label}
          </Badge>
        ))}
      </div>

      {step === 1 ? (
        <div className={cn(glassInsetClass, "space-y-4 p-4")}>
          <div>
            <p className="text-sm text-white/70">
              Choose which exam papers Leo should try to place into open slots within the session
              range.
            </p>
            <p className="mt-2 text-sm text-white/50">
              {scopeCount} paper{scopeCount === 1 ? "" : "s"} in scope · {unscheduledCount}{" "}
              currently unscheduled
            </p>
          </div>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
            <div>
              <p className="text-sm font-medium text-white">Only unscheduled papers</p>
              <p className="text-xs text-white/50">
                Leave scheduled papers unchanged and fill gaps only.
              </p>
            </div>
            <Switch
              checked={preferences.onlyUnscheduledEntries}
              onCheckedChange={(checked) =>
                setPreferences((prev) => ({ ...prev, onlyUnscheduledEntries: checked }))
              }
            />
          </label>
        </div>
      ) : null}

      {step === 2 ? (
        <div className={cn(glassInsetClass, "grid gap-4 p-4 sm:grid-cols-3")}>
          <div className="space-y-2 sm:col-span-3">
            <Label className="text-white/70">Daily window</Label>
            <p className="text-xs text-white/45">
              The scheduler searches for conflict-free slots between these times on working days.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="smart-day-start">Day starts</Label>
            <Input
              id="smart-day-start"
              value={preferences.dayStartTime}
              onChange={(event) =>
                setPreferences((prev) => ({ ...prev, dayStartTime: event.target.value }))
              }
              placeholder="08:00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smart-day-end">Day ends</Label>
            <Input
              id="smart-day-end"
              value={preferences.dayEndTime}
              onChange={(event) =>
                setPreferences((prev) => ({ ...prev, dayEndTime: event.target.value }))
              }
              placeholder="15:00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smart-gap">Gap between slots (minutes)</Label>
            <Input
              id="smart-gap"
              type="number"
              min={0}
              max={180}
              value={preferences.slotGapMinutes}
              onChange={(event) =>
                setPreferences((prev) => ({
                  ...prev,
                  slotGapMinutes: Number(event.target.value) || 15,
                }))
              }
            />
          </div>
        </div>
      ) : null}

      {step === 3 && proposal ? (
        <div className="space-y-4">
          <div className={cn(glassInsetClass, "grid gap-3 p-4 sm:grid-cols-3")}>
            <div>
              <p className="text-xs uppercase tracking-wide text-white/45">Confidence</p>
              <p className="mt-1 text-2xl font-semibold text-white">{proposal.confidenceScore}%</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-white/45">Scheduled</p>
              <p className="mt-1 text-sm text-white/80">
                {proposal.scheduledDrafts.length} of {scopeCount} in scope
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-white/45">Unscheduled</p>
              <p className="mt-1 text-sm text-white/80">{proposal.unscheduledItems.length} remaining</p>
            </div>
            <div className="sm:col-span-3">
              <p className="text-sm text-white/70">{proposal.explanationSummary}</p>
            </div>
          </div>

          {proposal.warnings.length > 0 ? (
            <div className="space-y-2">
              <Label className="text-amber-100">Warnings</Label>
              {proposal.warnings.slice(0, 4).map((warning) => (
                <div
                  key={warning}
                  className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-50"
                >
                  {warning}
                </div>
              ))}
            </div>
          ) : null}

          <div className="max-h-56 space-y-2 overflow-y-auto">
            {proposal.scheduledDrafts.slice(0, 8).map((draft) => (
              <div
                key={draft.entryId}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80"
              >
                <p className="font-medium text-white">
                  {draft.subjectName ?? "Subject"} · {draft.classGroupNames.join(", ") || "Class"}
                </p>
                <p className="mt-1 text-white/60">
                  {draft.date} · {draft.startTime} – {draft.endTime}
                  {draft.venueName ? ` · ${draft.venueName}` : ""}
                </p>
                <p className="mt-1 text-xs text-white/45">{draft.explanation}</p>
              </div>
            ))}
            {proposal.scheduledDrafts.length > 8 ? (
              <p className="text-xs text-white/45">
                + {proposal.scheduledDrafts.length - 8} more scheduled draft(s)
              </p>
            ) : null}
          </div>

          {proposal.unscheduledItems.length > 0 ? (
            <div className={cn(glassInsetClass, "p-3 text-sm text-amber-100")}>
              {proposal.unscheduledItems.length} paper(s) could not be placed automatically. You can
              schedule them manually after applying the draft.
            </div>
          ) : null}
        </div>
      ) : null}

      {step === 4 && proposal ? (
        <div className={cn(glassInsetClass, "space-y-3 p-4")}>
          <div className="flex items-start gap-2 text-sm text-white/75">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            <span>
              Applying writes draft slots and suggested invigilators to the timetable builder. This
              does not publish the timetable.
            </span>
          </div>
          <div className="flex items-start gap-2 text-sm text-white/60">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <span>
              Review conflicts and assessment links after applying. You can discard changes by
              editing individual papers.
            </span>
          </div>
        </div>
      ) : null}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="outline"
          className={glassSecondaryButtonClass}
          onClick={() => {
            if (step === 1) {
              onOpenChange(false);
              return;
            }
            setStep((current) => Math.max(1, current - 1));
          }}
          disabled={isBusy}
        >
          {step === 1 ? "Cancel" : (
            <>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back
            </>
          )}
        </Button>

        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          {step === 3 ? (
            <Button
              type="button"
              variant="outline"
              className={glassSecondaryButtonClass}
              onClick={() => {
                setProposal(null);
                setStep(2);
              }}
              disabled={isBusy}
            >
              Discard draft
            </Button>
          ) : null}

          {step === 1 ? (
            <Button
              type="button"
              className={glassPrimaryButtonClass}
              disabled={scopeCount === 0}
              onClick={() => setStep(2)}
            >
              Continue
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : null}

          {step === 2 ? (
            <Button
              type="button"
              className={glassPrimaryButtonClass}
              disabled={isBusy || scopeCount === 0}
              onClick={() => void handleGenerate()}
            >
              {generateSchedule.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Generate draft
                </>
              )}
            </Button>
          ) : null}

          {step === 3 ? (
            <Button
              type="button"
              className={glassPrimaryButtonClass}
              disabled={!proposal || proposal.scheduledDrafts.length === 0}
              onClick={() => setStep(4)}
            >
              Continue to apply
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : null}

          {step === 4 ? (
            <Button
              type="button"
              className={glassPrimaryButtonClass}
              disabled={isBusy || !proposal}
              onClick={() => void handleApply()}
            >
              {applySchedule.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Applying…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Apply draft slots
                </>
              )}
            </Button>
          ) : null}
        </div>
      </div>
    </ResponsiveModal>
  );
}
