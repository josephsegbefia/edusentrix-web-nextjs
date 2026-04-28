"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type GradebookCellProps = {
  value: number | null;
  maxScore: number;
  status?: "draft" | "published";
  disabled?: boolean;
  /** True while this cell's score is being persisted */
  isSaving?: boolean;
  onSave: (score: number | null) => void;
  onInvalid?: (message: string) => void;
};

export function GradebookCell({
  value,
  maxScore,
  status = "draft",
  disabled,
  isSaving = false,
  onSave,
  onInvalid,
}: GradebookCellProps) {
  const [draft, setDraft] = React.useState<string>(value === null ? "" : String(value));
  const [focused, setFocused] = React.useState(false);

  React.useEffect(() => {
    // While saving, keep showing the user's draft so the value doesn't flicker on refetch.
    if (focused || isSaving) return;
    setDraft(value === null ? "" : String(value));
  }, [value, focused, isSaving]);

  const handleBlur = () => {
    if (isSaving) return;
    setFocused(false);
    const trimmed = draft.trim();
    if (!trimmed) {
      if (value !== null) {
        onSave(null);
      }
      return;
    }

    const numeric = Number(trimmed);
    if (Number.isNaN(numeric)) {
      setDraft(value === null ? "" : String(value));
      onInvalid?.("Score must be a number");
      return;
    }

    if (numeric < 0) {
      setDraft(value === null ? "" : String(value));
      onInvalid?.("Score cannot be negative");
      return;
    }

    if (numeric > maxScore) {
      setDraft(value === null ? "" : String(value));
      onInvalid?.(`Score cannot exceed ${maxScore}`);
      return;
    }

    if (numeric !== value) {
      onSave(Number(numeric.toFixed(2)));
    }
  };

  const inputLocked = Boolean(disabled || isSaving);
  const statusTone = status === "published" ? "bg-emerald-400" : "bg-amber-400";

  return (
    <div className="relative">
      <input
        type="number"
        inputMode="decimal"
        step="0.1"
        min={0}
        max={maxScore}
        value={draft}
        disabled={inputLocked}
        aria-busy={isSaving}
        onFocus={() => setFocused(true)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={handleBlur}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            (event.target as HTMLInputElement).blur();
          }
        }}
        className={cn(
          "h-9 w-full rounded-lg border border-white/10 bg-white/5 px-2 text-center text-sm text-white",
          isSaving && "pr-8",
          "focus:border-indigo-400/60 focus:outline-none focus:ring-1 focus:ring-indigo-500/40",
          "disabled:cursor-not-allowed",
          disabled && !isSaving && "disabled:opacity-50",
          isSaving && "disabled:opacity-100 disabled:text-white",
          status === "published" ? "border-emerald-500/40" : "border-amber-500/30"
        )}
      />
      {isSaving ? (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-300" aria-hidden />
        </span>
      ) : (
        <span
          className={cn(
            "pointer-events-none absolute right-2 top-2 h-2 w-2 rounded-full",
            statusTone,
            disabled ? "opacity-40" : "opacity-90"
          )}
          title={status === "published" ? "Published" : "Draft"}
        />
      )}
    </div>
  );
}
