"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  parseMarkEntryInput,
  validateMarkEntryScore,
} from "@/components/teacher/marks/mark-entry-utils";
import type { AssessmentScoreStatus } from "@/types/academics/assessment-engine";

export type MarksScoreCellProps = {
  value: number | null;
  maxScore: number;
  status?: AssessmentScoreStatus;
  disabled?: boolean;
  isSaving?: boolean;
  invalidMessage?: string | null;
  onDraftChange?: (score: number | null, invalidMessage: string | null) => void;
  onCommit?: (score: number | null) => void;
};

export function MarksScoreCell({
  value,
  maxScore,
  status = "draft",
  disabled,
  isSaving = false,
  invalidMessage,
  onDraftChange,
  onCommit,
}: MarksScoreCellProps) {
  const [draft, setDraft] = React.useState<string>(value === null ? "" : String(value));
  const [focused, setFocused] = React.useState(false);

  React.useEffect(() => {
    if (focused || isSaving) return;
    setDraft(value === null ? "" : String(value));
  }, [value, focused, isSaving]);

  function commitDraft() {
    if (isSaving || disabled) return;

    const trimmed = draft.trim();
    if (!trimmed) {
      onDraftChange?.(null, null);
      onCommit?.(null);
      return;
    }

    const parsed = parseMarkEntryInput(trimmed);
    if (parsed === "invalid") {
      const message = "Score must be a number.";
      onDraftChange?.(value, message);
      setDraft(value === null ? "" : String(value));
      return;
    }

    const error = validateMarkEntryScore(parsed, maxScore);
    if (error) {
      onDraftChange?.(parsed, error);
      return;
    }

    onDraftChange?.(parsed, null);
    if (parsed !== value) {
      onCommit?.(parsed);
    }
  }

  const inputLocked = Boolean(disabled || isSaving || status === "locked");
  const showMissing = value == null && !focused && !draft.trim();
  const hasError = Boolean(invalidMessage);

  return (
    <div className="relative min-w-[72px]">
      <input
        type="number"
        inputMode="decimal"
        step="0.1"
        min={0}
        max={maxScore}
        value={draft}
        disabled={inputLocked}
        aria-busy={isSaving}
        aria-invalid={hasError}
        onFocus={() => setFocused(true)}
        onChange={(event) => {
          const nextDraft = event.target.value;
          setDraft(nextDraft);
          const parsed = parseMarkEntryInput(nextDraft);
          if (parsed === "invalid") {
            onDraftChange?.(value, "Score must be a number.");
            return;
          }
          const error = validateMarkEntryScore(parsed, maxScore);
          onDraftChange?.(parsed, error);
        }}
        onBlur={() => {
          setFocused(false);
          commitDraft();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            (event.target as HTMLInputElement).blur();
          }
        }}
        className={cn(
          "h-9 w-full rounded-lg border bg-white/5 px-2 text-center text-sm text-white",
          showMissing && !hasError && "border-dashed border-white/15 text-white/45",
          !showMissing && !hasError && "border-white/10",
          hasError && "border-rose-500/50 bg-rose-500/5 text-rose-100",
          isSaving && "pr-8",
          "focus:border-teal-400/60 focus:outline-none focus:ring-1 focus:ring-teal-500/40",
          inputLocked && !isSaving && "cursor-not-allowed opacity-50",
          status === "locked" && "opacity-60"
        )}
        placeholder={showMissing ? "—" : undefined}
      />
      {isSaving ? (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-300" aria-hidden />
        </span>
      ) : null}
      {hasError ? (
        <p className="mt-1 text-[10px] leading-4 text-rose-200">{invalidMessage}</p>
      ) : null}
    </div>
  );
}
