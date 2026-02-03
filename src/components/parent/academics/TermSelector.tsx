// src/components/parent/academics/TermSelector.tsx
"use client";

import * as React from "react";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";

type TermOverview = {
  termId: string;
  label: string;
  averageScore: number | null;
};

type Props = {
  terms: TermOverview[];
  currentTermId: string | null;
  onChange: (termId: string) => void;
};

export function TermSelector({ terms, currentTermId, onChange }: Props) {
  if (!terms.length) return null;

  return (
    <div className="flex items-center justify-end">
      <PremiumSelect
        value={currentTermId ?? undefined}
        onValueChange={(value) => onChange(value)}
      >
        <PremiumSelectTrigger className="h-8 w-56 rounded-full text-xs">
          <PremiumSelectValue placeholder="Select term" />
        </PremiumSelectTrigger>
        <PremiumSelectContent>
          {terms.map((t) => (
            <PremiumSelectItem key={t.termId} value={t.termId}>
              {t.label}
              {typeof t.averageScore === "number"
                ? ` • ${t.averageScore.toFixed(1)}%`
                : ""}
            </PremiumSelectItem>
          ))}
        </PremiumSelectContent>
      </PremiumSelect>
    </div>
  );
}
