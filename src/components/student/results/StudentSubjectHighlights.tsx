"use client";

import { GlassPanel } from "@/components/ui/glass-panel";
import { glassInsetClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";
import type { StudentAcademicProfileDTO } from "@/types/academics/student-academic-profile";
import { Sparkles, Target } from "lucide-react";

type Props = {
  profile: StudentAcademicProfileDTO;
};

export function StudentSubjectHighlights({ profile }: Props) {
  const { strongestSubject, weakestSubject } = profile.summary;

  if (!strongestSubject && !weakestSubject) {
    return null;
  }

  return (
    <GlassPanel className="p-4 sm:p-5" glow="cyan">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-300" />
        <h3 className="text-sm font-semibold text-white">Subject highlights</h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {strongestSubject ? (
          <div className={cn(glassInsetClass, "p-3")}>
            <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-300/80">
              Strongest subject
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              {strongestSubject.subjectName}
            </p>
            <p className="text-xs text-white/55">
              {strongestSubject.score.toFixed(1)}%
            </p>
          </div>
        ) : null}
        {weakestSubject ? (
          <div className={cn(glassInsetClass, "p-3")}>
            <p className="text-[11px] font-medium uppercase tracking-wide text-amber-300/80">
              <Target className="mr-1 inline h-3 w-3" />
              Focus area
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              {weakestSubject.subjectName}
            </p>
            <p className="text-xs text-white/55">
              {weakestSubject.score.toFixed(1)}% — keep practising
            </p>
          </div>
        ) : null}
      </div>
    </GlassPanel>
  );
}
