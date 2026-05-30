"use client";

import type { AcademicProfileScoreComponentDTO } from "@/types/academics/student-academic-profile";
import { formatComponentCellValue } from "@/lib/academics/profile/subject-results-table-utils";
import { cn } from "@/lib/utils";

type Props = {
  components: AcademicProfileScoreComponentDTO[];
  className?: string;
};

export function ScoreComponentChips({ components, className }: Props) {
  if (components.length === 0) {
    return <span className="text-[11px] text-white/40">No components</span>;
  }

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {components.map((component) => (
        <span
          key={component.componentKey}
          title={
            component.weight > 0
              ? `${component.label} (${component.weight}% weight)`
              : component.label
          }
          className={cn(
            "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
            component.status === "missing"
              ? "border-amber-400/30 bg-amber-500/10 text-amber-100"
              : "border-white/10 bg-white/5 text-white/75"
          )}
        >
          <span className="truncate text-white/50">{component.label}</span>
          <span className="text-white/90">{formatComponentCellValue(component)}</span>
        </span>
      ))}
    </div>
  );
}
