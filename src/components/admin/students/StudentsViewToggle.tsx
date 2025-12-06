// src/components/admin/students/StudentsViewToggle.tsx
"use client";

import * as React from "react";
import { LayoutGrid, List } from "lucide-react";
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
    <div className="inline-flex items-center rounded-full border bg-muted/40 p-0.5 text-xs">
      <button
        type="button"
        onClick={() => onChange("cards")}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-3 py-1 font-medium transition-all",
          isCards
            ? "bg-background shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        <span>Cards</span>
      </button>
      <button
        type="button"
        onClick={() => onChange("table")}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-3 py-1 font-medium transition-all",
          !isCards
            ? "bg-background shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <List className="h-3.5 w-3.5" />
        <span>Table</span>
      </button>
    </div>
  );
}
