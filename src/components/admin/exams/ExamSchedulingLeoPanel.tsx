"use client";

import * as React from "react";
import { Copy, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { glassInsetClass, glassSecondaryButtonClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";
import {
  useDraftExamParentMessageWithLeo,
  useExplainExamConflictWithLeo,
  useSuggestExamInvigilatorReplacementsWithLeo,
  useSuggestExamScheduleImprovementsWithLeo,
} from "@/hooks/admin/useExamSchedulingLeo";
import { useBusyToast } from "@/hooks/useBusyToast";

type ExamSchedulingLeoPanelProps = {
  sessionId: string;
  mode: "improvements" | "parent-message" | "conflict-explain" | "invigilator-suggest";
  conflictKey?: string;
  assignmentId?: string;
  className?: string;
  onSelectInvigilator?: (teacherId: string) => void;
};

export function ExamSchedulingLeoPanel({
  sessionId,
  mode,
  conflictKey,
  assignmentId,
  className,
  onSelectInvigilator,
}: ExamSchedulingLeoPanelProps) {
  const busy = useBusyToast();
  const explainConflict = useExplainExamConflictWithLeo(sessionId);
  const suggestImprovements = useSuggestExamScheduleImprovementsWithLeo(sessionId);
  const draftParentMessage = useDraftExamParentMessageWithLeo(sessionId);
  const suggestInvigilators = useSuggestExamInvigilatorReplacementsWithLeo(sessionId);

  const mutation =
    mode === "conflict-explain"
      ? explainConflict
      : mode === "parent-message"
        ? draftParentMessage
        : mode === "invigilator-suggest"
          ? suggestInvigilators
          : suggestImprovements;

  const label =
    mode === "conflict-explain"
      ? "Explain with Leo"
      : mode === "parent-message"
        ? "Draft parent notice"
        : mode === "invigilator-suggest"
          ? "Suggest replacements"
          : "Ask Leo for improvements";

  async function handleRun() {
    if (mode === "conflict-explain" && !conflictKey) {
      busy.error("Select a conflict first.");
      return;
    }
    if (mode === "invigilator-suggest" && !assignmentId) {
      busy.error("Select an invigilator assignment first.");
      return;
    }

    await busy.promise(
      mode === "conflict-explain"
        ? explainConflict.mutateAsync(conflictKey!)
        : mode === "invigilator-suggest"
          ? suggestInvigilators.mutateAsync(assignmentId!)
          : mode === "parent-message"
            ? draftParentMessage.mutateAsync()
            : suggestImprovements.mutateAsync(),
      {
        loading: "Leo is reviewing the timetable…",
        success: "Leo suggestions ready",
        error: (error) => (error instanceof Error ? error.message : "Leo request failed"),
      }
    );
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      busy.success("Copied to clipboard");
    } catch {
      busy.error("Could not copy to clipboard");
    }
  }

  const result = mutation.data;

  return (
    <GlassPanel className={cn("p-4", className)} glow="cyan">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-cyan-100">
            <Sparkles className="h-4 w-4" />
            Leo advisory
          </div>
          <p className="mt-1 text-xs text-white/50">
            Suggestions are draft-only. Confirm changes yourself before publishing or assigning.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={glassSecondaryButtonClass}
          disabled={mutation.isPending}
          onClick={() => void handleRun()}
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              Working…
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-3.5 w-3.5" />
              {label}
            </>
          )}
        </Button>
      </div>

      {result ? (
        <div className={cn(glassInsetClass, "mt-4 space-y-3 p-3 text-sm text-white/75")}>
          <p className="text-xs text-white/45">{result.disclaimer}</p>

          {mode === "conflict-explain" && "explanation" in result ? (
            <>
              <p className="text-white/85">{result.explanation}</p>
              {result.likelyCauses.length > 0 ? (
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/45">Likely causes</p>
                  <ul className="mt-1 list-disc pl-5">
                    {result.likelyCauses.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {result.suggestedFixes.length > 0 ? (
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/45">Suggested fixes</p>
                  <ul className="mt-1 list-disc pl-5">
                    {result.suggestedFixes.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : null}

          {mode === "improvements" && "proposals" in result ? (
            <>
              <p className="text-white/85">{result.summary}</p>
              {result.proposals.map((proposal) => (
                <div
                  key={`${proposal.title}-${proposal.description}`}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  <p className="font-medium text-white">{proposal.title}</p>
                  <p className="mt-1">{proposal.description}</p>
                  <p className="mt-1 text-xs text-white/45">{proposal.rationale}</p>
                </div>
              ))}
            </>
          ) : null}

          {mode === "parent-message" && "subject" in result && "body" in result ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-white">{result.subject}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-white/60 hover:text-white"
                  onClick={() => void copyText(`${result.subject}\n\n${result.body}`)}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" />
                  Copy
                </Button>
              </div>
              <pre className="whitespace-pre-wrap text-sm text-white/75">{result.body}</pre>
            </>
          ) : null}

          {mode === "invigilator-suggest" && "candidates" in result ? (
            <>
              <p className="text-white/85">{result.summary}</p>
              {result.candidates.map((candidate) => (
                <div
                  key={candidate.teacherId}
                  className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-white">
                      {candidate.teacherName ?? "Teacher"}
                    </p>
                    <p className="mt-1 text-sm">{candidate.rationale}</p>
                    <p className="mt-1 text-xs text-white/45">{candidate.workloadNote}</p>
                  </div>
                  {onSelectInvigilator ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={glassSecondaryButtonClass}
                      onClick={() => onSelectInvigilator(candidate.teacherId)}
                    >
                      Use suggestion
                    </Button>
                  ) : null}
                </div>
              ))}
            </>
          ) : null}
        </div>
      ) : null}
    </GlassPanel>
  );
}
