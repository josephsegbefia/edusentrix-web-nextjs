"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type GradebookCellProps = {
  value: number | null;
  maxScore: number;
  status?: "draft" | "published";
  disabled?: boolean;
  onSave: (score: number | null) => void;
  onInvalid?: (message: string) => void;
};

export function GradebookCell({
  value,
  maxScore,
  status = "draft",
  disabled,
  onSave,
  onInvalid,
}: GradebookCellProps) {
  const [draft, setDraft] = React.useState<string>(value === null ? "" : String(value));
  const [focused, setFocused] = React.useState(false);

  React.useEffect(() => {
    if (!focused) {
      setDraft(value === null ? "" : String(value));
    }
  }, [value, focused]);

  const handleBlur = () => {
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
        disabled={disabled}
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
          "focus:border-indigo-400/60 focus:outline-none focus:ring-1 focus:ring-indigo-500/40",
          "disabled:cursor-not-allowed disabled:opacity-50",
          status === "published" ? "border-emerald-500/40" : "border-amber-500/30"
        )}
      />
      <span
        className={cn(
          "pointer-events-none absolute right-2 top-2 h-2 w-2 rounded-full",
          statusTone,
          disabled ? "opacity-40" : "opacity-90"
        )}
        title={status === "published" ? "Published" : "Draft"}
      />
    </div>
  );
}
