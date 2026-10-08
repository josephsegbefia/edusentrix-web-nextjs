// src/components/admin/students/StudentsViewToggle.tsx
"use client";

import * as React from "react";
import { LayoutGrid, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type StudentsViewMode = "cards" | "table";

type StudentsViewToggleProps = {
  value: StudentsViewMode;
  onChange: (mode: StudentsViewMode) => void;
};

export function StudentsViewToggle({
  value,
  onChange,
}: StudentsViewToggleProps) {
  const isCards = value === "cards";

  return (
    <div className="inline-flex items-center rounded-full border border-(--ws-line) bg-(--ws-fill) p-1 text-xs">
      <button
        type="button"
        onClick={() => onChange("cards")}
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-medium transition",
          isCards
            ? "bg-(--ws-fill-strong) text-(--ws-fg) shadow-sm shadow-black/30"
            : "text-(--ws-fg-60) hover:text-(--ws-fg)"
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        <span>Cards</span>
      </button>
      <button
        type="button"
        onClick={() => onChange("table")}
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-medium transition",
          !isCards
            ? "bg-(--ws-fill-strong) text-(--ws-fg) shadow-sm shadow-black/30"
            : "text-(--ws-fg-60) hover:text-(--ws-fg)"
        )}
      >
        <Table2 className="h-3.5 w-3.5" />
        <span>Table</span>
      </button>
    </div>
  );
}
