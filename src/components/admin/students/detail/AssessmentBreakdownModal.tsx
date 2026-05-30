"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AssessmentBreakdownLegacyContent } from "@/components/admin/students/detail/AssessmentBreakdownLegacyContent";
import { AssessmentBreakdownProfileContent } from "@/components/admin/students/detail/AssessmentBreakdownProfileContent";
import { useAssessmentBreakdown } from "@/hooks/admin/useAssessmentBreakdown";
import { useStudentAcademicProfileBreakdown } from "@/hooks/admin/useStudentAcademicProfile";
import { shouldUseLegacyAssessmentBreakdown } from "@/lib/academics/profile/assessment-breakdown-view-utils";
import type { AcademicProfileSubjectResultDTO } from "@/types/academics/student-academic-profile";
import { Loader2 } from "lucide-react";

type Props = {
  studentId: string;
  subjectId: string;
  /** Academic period id (legacy prop name: termId). */
  termId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectContext?: AcademicProfileSubjectResultDTO | null;
  periodLabel?: string | null;
  periodIsReleased?: boolean;
};

export function AssessmentBreakdownModal({
  studentId,
  subjectId,
  termId,
  open,
  onOpenChange,
  subjectContext,
  periodLabel,
  periodIsReleased = false,
}: Props) {
  const profileQuery = useStudentAcademicProfileBreakdown({
    studentId,
    subjectId,
    periodId: termId,
    enabled: open,
  });

  const useLegacy = shouldUseLegacyAssessmentBreakdown({
    profileError: profileQuery.isError,
    breakdown: profileQuery.data?.data,
  });

  const legacyQuery = useAssessmentBreakdown(
    studentId,
    subjectId,
    termId,
    open && useLegacy
  );

  const breakdown = profileQuery.data?.data;
  const legacyData = legacyQuery.data?.data;
  const isLoading =
    (profileQuery.isLoading && !useLegacy) || (useLegacy && legacyQuery.isLoading);
  const isError =
    useLegacy && legacyQuery.isError && !legacyQuery.isLoading && !legacyData;

  const title =
    subjectContext?.subjectName ??
    breakdown?.subjectName ??
    legacyData?.subjectName ??
    "Assessment breakdown";

  const subtitle = periodLabel ?? legacyData?.termLabel ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-white/10 bg-slate-950/95 backdrop-blur">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-white/90">
            {isLoading ? "Loading breakdown…" : `${title} breakdown`}
          </DialogTitle>
          {subtitle ? (
            <p className="text-sm text-white/50">{subtitle}</p>
          ) : null}
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : null}

        {isError ? (
          <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-8 text-center">
            <p className="text-sm text-destructive">
              Failed to load assessment breakdown
            </p>
          </div>
        ) : null}

        {!isLoading && !isError && breakdown && !useLegacy ? (
          <AssessmentBreakdownProfileContent
            breakdown={breakdown}
            subjectContext={subjectContext}
            periodIsReleased={periodIsReleased}
          />
        ) : null}

        {!isLoading && !isError && useLegacy && legacyData ? (
          <AssessmentBreakdownLegacyContent data={legacyData} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
