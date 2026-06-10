"use client";

import * as React from "react";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import {
  resolvePeriodOptions,
} from "@/lib/academics/profile/academic-period-selector-utils";
import type { AcademicProfilePeriodDTO } from "@/types/academics/student-academic-profile";
import type { StudentTermOverview } from "@/types/admin/student-academics";
import { TermSelectorHelpButton } from "@/components/academics/TermSelectorHelpButton";
import { OfficialStatusBadge } from "./OfficialStatusBadge";

type Props = {
  /** Profile periods with status badges (preferred). */
  periods?: AcademicProfilePeriodDTO[];
  /** Legacy term list — used when profile periods are not yet loaded. */
  terms?: StudentTermOverview[];
  currentPeriodId: string | null;
  onChange: (periodId: string) => void;
  schoolLevel?: "Basic" | "SHS" | null;
};

export function TermSelector({
  periods,
  terms,
  currentPeriodId,
  onChange,
  schoolLevel,
}: Props) {
  const periodOptions = React.useMemo(
    () => resolvePeriodOptions({ profilePeriods: periods, legacyTerms: terms }),
    [periods, terms]
  );

  const selectedPeriod = periodOptions.find(
    (period) => period.academicPeriodId === currentPeriodId
  );

  if (!periodOptions.length) {
    return (
      <div className="flex items-center justify-end">
        <TermSelectorHelpButton schoolLevel={schoolLevel} noTermsAvailable />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {selectedPeriod ? (
        <OfficialStatusBadge
          status={selectedPeriod.status}
          isOfficial={selectedPeriod.isOfficial}
          compact
          className="hidden sm:inline-flex"
        />
      ) : null}
      <TermSelectorHelpButton schoolLevel={schoolLevel} />
      <PremiumSelect
        value={currentPeriodId ?? undefined}
        onValueChange={(value) => onChange(value)}
      >
        <PremiumSelectTrigger className="h-8 min-w-56 max-w-72 rounded-full text-xs">
          <PremiumSelectValue placeholder="Select period">
            {selectedPeriod ? selectedPeriod.label : "Select period"}
          </PremiumSelectValue>
        </PremiumSelectTrigger>
        <PremiumSelectContent className="min-w-72">
          {periodOptions.map((period) => (
            <PremiumSelectItem
              key={period.academicPeriodId}
              value={period.academicPeriodId}
            >
              <span className="flex w-full items-center justify-between gap-3 pr-6">
                <span className="min-w-0 truncate text-left">{period.label}</span>
                <OfficialStatusBadge
                  status={period.status}
                  isOfficial={period.isOfficial}
                  compact
                />
              </span>
            </PremiumSelectItem>
          ))}
        </PremiumSelectContent>
      </PremiumSelect>
    </div>
  );
}
