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
    <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 p-1 text-xs">
      <button
        type="button"
        onClick={() => onChange("cards")}
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-medium transition",
          isCards
            ? "bg-white/10 text-white shadow-sm shadow-black/30"
            : "text-white/60 hover:text-white"
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
            ? "bg-white/10 text-white shadow-sm shadow-black/30"
            : "text-white/60 hover:text-white"
        )}
      >
        <Table2 className="h-3.5 w-3.5" />
        <span>Table</span>
      </button>
    </div>
  );
}
