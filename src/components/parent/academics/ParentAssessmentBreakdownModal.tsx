"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AssessmentBreakdownProfileContent } from "@/components/admin/students/detail/AssessmentBreakdownProfileContent";
import { useParentAcademicProfileBreakdown } from "@/hooks/parent/useParentAcademicProfile";
import type { AcademicProfileSubjectResultDTO } from "@/types/academics/student-academic-profile";
import { Loader2 } from "lucide-react";

type Props = {
  wardId: string;
  subjectId: string;
  periodId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectContext?: AcademicProfileSubjectResultDTO | null;
  periodLabel?: string | null;
  periodIsReleased?: boolean;
};

export function ParentAssessmentBreakdownModal({
  wardId,
  subjectId,
  periodId,
  open,
  onOpenChange,
  subjectContext,
  periodLabel,
  periodIsReleased = false,
}: Props) {
  const profileQuery = useParentAcademicProfileBreakdown({
    wardId,
    subjectId,
    periodId,
    enabled: open,
  });

  const breakdown = profileQuery.data?.data;
  const isLoading = profileQuery.isLoading;
  const isError = profileQuery.isError && !isLoading;

  const title =
    subjectContext?.subjectName ?? breakdown?.subjectName ?? "Assessment breakdown";

  const subtitle = periodLabel ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-white/10 bg-slate-950/95 backdrop-blur">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-white/90">
            {isLoading ? "Loading breakdown…" : `${title} breakdown`}
          </DialogTitle>
          {subtitle ? <p className="text-sm text-white/50">{subtitle}</p> : null}
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : null}

        {isError ? (
          <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-8 text-center">
            <p className="text-sm text-destructive">
              {profileQuery.error instanceof Error
                ? profileQuery.error.message
                : "Failed to load assessment breakdown"}
            </p>
            <p className="mt-2 text-xs text-white/50">
              Detailed breakdown is available after the school releases the official
              report card.
            </p>
          </div>
        ) : null}

        {!isLoading && !isError && breakdown ? (
          <AssessmentBreakdownProfileContent
            breakdown={breakdown}
            subjectContext={subjectContext}
            periodIsReleased={periodIsReleased}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
