"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StudentTermOverview } from "@/types/admin/student-academics";

type Props = {
  terms: StudentTermOverview[];
  currentTermId: string | null;
  onChange: (termId: string) => void;
};

export function TermSelector({ terms, currentTermId, onChange }: Props) {
  if (!terms.length) return null;

  return (
    <div className="flex items-center justify-end">
      <Select
        value={currentTermId ?? undefined}
        onValueChange={(value) => onChange(value)}
      >
        <SelectTrigger className="h-8 w-[220px] rounded-full border-white/10 bg-white/5 text-xs text-slate-100 hover:bg-white/10">
          <SelectValue placeholder="Select term" />
        </SelectTrigger>
        <SelectContent className="text-xs">
          {terms.map((t) => (
            <SelectItem key={t.termId} value={t.termId}>
              {t.label}
              {typeof t.averageScore === "number"
                ? ` • ${t.averageScore.toFixed(1)}%`
                : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
