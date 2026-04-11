"use client";

import * as React from "react";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import type { StudentTermOverview } from "@/types/admin/student-academics";
import { TermSelectorHelpButton } from "@/components/academics/TermSelectorHelpButton";

type Props = {
  terms: StudentTermOverview[];
  currentTermId: string | null;
  onChange: (termId: string) => void;
  schoolLevel?: "Basic" | "SHS" | null;
};

export function TermSelector({
  terms,
  currentTermId,
  onChange,
  schoolLevel,
}: Props) {
  if (!terms.length) {
    return (
      <div className="flex items-center justify-end">
        <TermSelectorHelpButton schoolLevel={schoolLevel} noTermsAvailable />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <TermSelectorHelpButton schoolLevel={schoolLevel} />
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
